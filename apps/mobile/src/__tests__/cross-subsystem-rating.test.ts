/**
 * Cross-subsystem contract tests for the rating pipeline (006R task 1.6).
 *
 * These tests exercise the full flow from difficulty selection through
 * session completion to rating persistence, using canonical lowercase
 * difficulty values (easy/normal/hard/expert/adaptive). They verify that
 * the rating pipeline, DB layer, and session-completion boundary work
 * together correctly across subsystem boundaries.
 *
 * Per the spec: "Unit tests of each part independently are insufficient."
 */
import { describe, expect, it } from '@jest/globals';
import type { GameSessionRecord } from '@/db';
import { SessionRepository } from '@/db/sessions';
import { RatingRepository } from '@/db/rating';
import { LedgerRepository } from '@/db/ledger';
import { createRatingPipeline, DIFFICULTY_XP_MULTIPLIER } from '@/rating/pipeline';
import { createMigratedDb } from '@/db/__tests__/helpers';

const T0 = 1_700_000_000_000;
const GAME_ID = 'memory';

/** Domain mapping for the memory game: primary Memory, secondary Attention. */
const getDomains = (gameId: string) =>
  gameId === GAME_ID ? ['Memory', 'Attention'] : [];

function makeSession(
  overrides: Partial<GameSessionRecord> = {},
): GameSessionRecord {
  return {
    id: `session-${Math.random().toString(36).slice(2, 8)}`,
    gameId: GAME_ID,
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
    seed: 42,
    difficulty: { level: 'normal', challengeRating: 0.5 },
    rawResult: {},
    normalizedResult: 0.8,
    xp: 0,
    startedAt: T0,
    completedAt: T0 + 60_000,
    durationMs: 60_000,
    ...overrides,
  };
}

describe('Cross-subsystem rating contract', () => {
  /**
   * Helper: run a session through the full pipeline and return the result.
   */
  async function runSession(
    difficulty: { level: string; challengeRating: number },
    normalized: number,
  ) {
    const adapter = await createMigratedDb();
    const pipeline = createRatingPipeline({ getDomains });
    const sessions = new SessionRepository(adapter, () => T0, pipeline);
    const ratings = new RatingRepository(adapter, () => T0);

    const session = makeSession({
      difficulty,
      normalizedResult: normalized,
    });

    const result = await sessions.completeSession({ session });

    return { result, ratings, sessions };
  }

  describe('canonical lowercase difficulty values', () => {
    it('easy: high expected performance limits rating gain', async () => {
      const { result, ratings } = await runSession(
        { level: 'easy', challengeRating: 0.2 },
        0.9, // excellent performance
      );

      // XP uses easy multiplier (0.8)
      expect(result.session.xp).toBe(
        Math.round((10 + 40 * 0.9) * DIFFICULTY_XP_MULTIPLIER.easy),
      );
      expect(result.completionOutcome?.xp).toBe(result.session.xp);

      // Rating delta: easy expects 0.8, player got 0.9 → small gain
      const memoryDelta = result.completionOutcome?.deltas.find(
        (d) => d.domain === 'Memory',
      );
      expect(memoryDelta).toBeDefined();
      expect(memoryDelta!.delta).toBeGreaterThan(0);
      expect(memoryDelta!.delta).toBeLessThan(10); // limited by easy baseline

      // Verify resulting rating
      const memoryRating = await ratings.getRating('Memory');
      expect(memoryRating?.rating).toBe(1000 + memoryDelta!.delta);
    });

    it('normal: moderate expected performance', async () => {
      const { result } = await runSession(
        { level: 'normal', challengeRating: 0.5 },
        0.8,
      );

      // XP uses normal multiplier (1.0)
      expect(result.session.xp).toBe(
        Math.round((10 + 40 * 0.8) * DIFFICULTY_XP_MULTIPLIER.normal),
      );

      // Rating delta: normal expects 0.6, player got 0.8 → moderate gain
      const memoryDelta = result.completionOutcome?.deltas.find(
        (d) => d.domain === 'Memory',
      );
      expect(memoryDelta).toBeDefined();
      expect(memoryDelta!.delta).toBeGreaterThan(0);
    });

    it('hard: lower expected performance rewards high play more', async () => {
      const { result } = await runSession(
        { level: 'hard', challengeRating: 0.8 },
        0.9,
      );

      // XP uses hard multiplier (1.2)
      expect(result.session.xp).toBe(
        Math.round((10 + 40 * 0.9) * DIFFICULTY_XP_MULTIPLIER.hard),
      );

      // Rating delta: hard expects 0.45, player got 0.9 → large gain
      const memoryDelta = result.completionOutcome?.deltas.find(
        (d) => d.domain === 'Memory',
      );
      expect(memoryDelta).toBeDefined();
      expect(memoryDelta!.delta).toBeGreaterThan(5);
    });

    it('expert: highest expected reward for high performance', async () => {
      const { result } = await runSession(
        { level: 'expert', challengeRating: 0.95 },
        1.0,
      );

      // XP uses expert multiplier (1.4)
      expect(result.session.xp).toBe(
        Math.round((10 + 40 * 1.0) * DIFFICULTY_XP_MULTIPLIER.expert),
      );

      // Rating delta: expert expects 0.3, player got 1.0 → maximum gain
      const memoryDelta = result.completionOutcome?.deltas.find(
        (d) => d.domain === 'Memory',
      );
      expect(memoryDelta).toBeDefined();
      expect(memoryDelta!.delta).toBe(15); // capped at MAX_RATING_DELTA_PER_SESSION
    });

    it('adaptive: uses challengeRating for expected performance', async () => {
      // Adaptive with high challengeRating (harder challenge)
      const { result } = await runSession(
        { level: 'adaptive', challengeRating: 0.8 },
        0.7,
      );

      // XP uses adaptive multiplier (1.1)
      expect(result.session.xp).toBe(
        Math.round((10 + 40 * 0.7) * DIFFICULTY_XP_MULTIPLIER.adaptive),
      );

      // Rating delta uses challengeRating 0.8 → expected ~0.45 (hard level)
      const memoryDelta = result.completionOutcome?.deltas.find(
        (d) => d.domain === 'Memory',
      );
      expect(memoryDelta).toBeDefined();
      expect(memoryDelta!.delta).toBeGreaterThan(0);
    });
  });

  describe('easy farming protection', () => {
    it('trivial easy play below demonstrated challenge produces minimal rating gain', async () => {
      // Player performs at 0.6 on easy (below easy's expected 0.8)
      const { result } = await runSession(
        { level: 'easy', challengeRating: 0.2 },
        0.6,
      );

      const memoryDelta = result.completionOutcome?.deltas.find(
        (d) => d.domain === 'Memory',
      );
      expect(memoryDelta).toBeDefined();
      // Should produce negative delta (below expected)
      expect(memoryDelta!.delta).toBeLessThan(0);
    });

    it('excellent easy play still produces limited rating gain', async () => {
      const { result } = await runSession(
        { level: 'easy', challengeRating: 0.2 },
        1.0,
      );

      const memoryDelta = result.completionOutcome?.deltas.find(
        (d) => d.domain === 'Memory',
      );
      expect(memoryDelta).toBeDefined();
      // Even perfect easy play produces limited gain due to high expected baseline
      expect(memoryDelta!.delta).toBeGreaterThan(0);
      expect(memoryDelta!.delta).toBeLessThan(10);
    });
  });

  describe('completion outcome contains authoritative data', () => {
    it('includes session, xp, currency, deltas with ratingAfter, and balance', async () => {
      const { result } = await runSession(
        { level: 'normal', challengeRating: 0.5 },
        0.8,
      );

      expect(result.completionOutcome).not.toBeNull();
      const co = result.completionOutcome!;

      // Session is the persisted record
      expect(co.session.id).toBe(result.session.id);
      expect(co.session.xp).toBe(co.xp);

      // XP and currency
      expect(co.xp).toBeGreaterThan(0);
      expect(co.currency).toBe(Math.floor(co.xp / 5));

      // Deltas have ratingAfter
      expect(co.deltas.length).toBeGreaterThan(0);
      for (const delta of co.deltas) {
        expect(typeof delta.domain).toBe('string');
        expect(typeof delta.delta).toBe('number');
        expect(typeof delta.ratingAfter).toBe('number');
        expect(delta.ratingAfter).toBeGreaterThanOrEqual(0);
      }

      // Balance matches currency award
      expect(co.balance).toBe(co.currency);
    });
  });

  describe('secondary domain moves at half weight', () => {
    it('primary domain gains more than secondary for same performance', async () => {
      const { result } = await runSession(
        { level: 'normal', challengeRating: 0.5 },
        0.9,
      );

      const memoryDelta = result.completionOutcome?.deltas.find(
        (d) => d.domain === 'Memory',
      );
      const attentionDelta = result.completionOutcome?.deltas.find(
        (d) => d.domain === 'Attention',
      );

      expect(memoryDelta).toBeDefined();
      expect(attentionDelta).toBeDefined();

      // Primary (Memory) should gain more than secondary (Attention)
      expect(memoryDelta!.delta).toBeGreaterThan(attentionDelta!.delta);
      // Secondary should be approximately half of primary
      expect(attentionDelta!.delta).toBe(Math.round(memoryDelta!.delta / 2));
    });
  });

  describe('persistence failure does not claim XP', () => {
    it('completionOutcome is null when no rating service configured', async () => {
      const adapter = await createMigratedDb();
      // No rating service
      const sessions = new SessionRepository(adapter, () => T0);
      const session = makeSession();

      const result = await sessions.completeSession({ session });

      // Without rating service, completionOutcome is null
      expect(result.completionOutcome).toBeNull();
      // Session XP is the game-reported value (no-op = 0)
      expect(result.session.xp).toBe(0);
    });
  });
});
