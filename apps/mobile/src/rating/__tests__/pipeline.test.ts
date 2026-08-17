import { describe, expect, it } from '@jest/globals';
import type { GameSessionRecord } from '@/db';
import {
  computeCurrency,
  computeRatingDelta,
  computeRatingOutcome,
  computeXp,
  createRatingPipeline,
  DIFFICULTY_EXPECTED_PERFORMANCE,
  DIFFICULTY_XP_MULTIPLIER,
  expectedPerformanceFromChallenge,
  MAX_RATING_DELTA_PER_SESSION,
} from '../pipeline';

const T0 = 1_700_000_000_000;

function makeSession(overrides: Partial<GameSessionRecord> = {}): GameSessionRecord {
  return {
    id: 's1',
    gameId: 'memory',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
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

describe('computeXp', () => {
  it('rewards poor attempts and bonuses for better play (Normal)', () => {
    expect(computeXp(0, 'normal')).toBe(10);
    expect(computeXp(0.5, 'normal')).toBe(30);
    expect(computeXp(1, 'normal')).toBe(50);
  });

  it('scales by difficulty multiplier and clamps the input', () => {
    expect(computeXp(0, 'easy')).toBe(Math.round(10 * DIFFICULTY_XP_MULTIPLIER.easy));
    expect(computeXp(0, 'hard')).toBe(Math.round(10 * DIFFICULTY_XP_MULTIPLIER.hard));
    expect(computeXp(0, 'expert')).toBe(Math.round(10 * DIFFICULTY_XP_MULTIPLIER.expert));
    expect(computeXp(0, 'adaptive')).toBe(Math.round(10 * DIFFICULTY_XP_MULTIPLIER.adaptive));
    expect(computeXp(-1, 'normal')).toBe(10); // clamped to 0
    expect(computeXp(2, 'normal')).toBe(50); // clamped to 1
  });

  it('falls back to the Normal multiplier for unknown levels', () => {
    expect(computeXp(0.5, 'Insane')).toBe(30);
  });
});

describe('computeRatingDelta', () => {
  it('moves toward the difficulty-expected baseline', () => {
    // Normal expects 0.6: above baseline gains, below loses, at baseline 0.
    expect(computeRatingDelta(1, 'normal')).toBe(Math.round(24 * (1 - 0.6)));
    expect(computeRatingDelta(0.6, 'normal')).toBe(0);
    expect(computeRatingDelta(0, 'normal')).toBe(Math.round(24 * (0 - 0.6)));
  });

  it('harder difficulties reward high performance more (expected baseline drops)', () => {
    const easy = computeRatingDelta(1, 'easy');
    const expert = computeRatingDelta(1, 'expert');
    expect(expert).toBeGreaterThan(easy);
    expect(easy).toBe(Math.round(24 * (1 - DIFFICULTY_EXPECTED_PERFORMANCE.easy)));
  });

  it('caps movement at MAX_RATING_DELTA_PER_SESSION per session', () => {
    expect(Math.abs(computeRatingDelta(0, 'expert'))).toBeLessThanOrEqual(MAX_RATING_DELTA_PER_SESSION);
    expect(Math.abs(computeRatingDelta(1, 'expert'))).toBeLessThanOrEqual(MAX_RATING_DELTA_PER_SESSION);
    expect(computeRatingDelta(1, 'expert')).toBe(MAX_RATING_DELTA_PER_SESSION);
  });

  it('applies the secondary-domain half weight', () => {
    const primary = computeRatingDelta(1, 'normal', 1);
    const secondary = computeRatingDelta(1, 'normal', 0.5);
    expect(secondary).toBe(Math.round(primary / 2));
  });
});

describe('computeCurrency', () => {
  it('awards 1 coin per XP_CURRENCY_RATE XP, floored', () => {
    expect(computeCurrency(0)).toBe(0);
    expect(computeCurrency(4)).toBe(0);
    expect(computeCurrency(5)).toBe(1);
    expect(computeCurrency(42)).toBe(8);
    expect(computeCurrency(-3)).toBe(0);
  });
});

describe('computeRatingOutcome', () => {
  const domains = (gameId: string) => (gameId === 'memory' ? ['Memory', 'Attention'] : []);

  it('produces a deterministic outcome for a fixed session', () => {
    const session = makeSession({ normalizedResult: 0.8, difficulty: { level: 'normal' } });
    const outcome = computeRatingOutcome(session, domains);

    expect(outcome.xp).toBe(42); // round((10 + 32) * 1)
    expect(outcome.currency).toBe(8); // floor(42 / 5)
    expect(outcome.deltas).toEqual([
      { domain: 'Memory', delta: 5 }, // round(24 * 0.2)
      { domain: 'Attention', delta: 2 }, // round(24 * 0.2 * 0.5)
    ]);
  });

  it('falls back to Normal when the persisted difficulty has no level', () => {
    const session = makeSession({ difficulty: { mode: 'custom' } });
    const outcome = computeRatingOutcome(session, domains);
    expect(outcome.xp).toBe(computeXp(0.8, 'normal'));
    expect(outcome.deltas[0].delta).toBe(computeRatingDelta(0.8, 'normal'));
  });

  it('clamps out-of-range normalized results', () => {
    const session = makeSession({ normalizedResult: 7 });
    const outcome = computeRatingOutcome(session, domains);
    expect(outcome).toEqual(computeRatingOutcome(makeSession({ normalizedResult: 1 }), domains));
  });

  it('produces no deltas for games without domain mapping', () => {
    const outcome = computeRatingOutcome(makeSession({ gameId: 'unknown' }), domains);
    expect(outcome.deltas).toEqual([]);
    expect(outcome.xp).toBe(42);
  });
});

describe('createRatingPipeline', () => {
  it('is a RatingService whose compute applies the same math', async () => {
    const pipeline = createRatingPipeline({
      getDomains: (id) => (id === 'memory' ? ['Memory'] : []),
    });
    const outcome = await pipeline.compute({ session: makeSession({ normalizedResult: 1 }) });
    expect(outcome.xp).toBe(50);
    expect(outcome.currency).toBe(10);
    expect(outcome.deltas).toEqual([{ domain: 'Memory', delta: computeRatingDelta(1, 'normal') }]);
  });
});

describe('expectedPerformanceFromChallenge', () => {
  it('maps known anchor points correctly', () => {
    expect(expectedPerformanceFromChallenge(0.2)).toBe(0.8);
    expect(expectedPerformanceFromChallenge(0.5)).toBe(0.6);
    expect(expectedPerformanceFromChallenge(0.8)).toBe(0.45);
    expect(expectedPerformanceFromChallenge(0.95)).toBe(0.3);
  });

  it('interpolates linearly between anchors', () => {
    const ep35 = expectedPerformanceFromChallenge(0.35);
    expect(ep35).toBeGreaterThan(0.6);
    expect(ep35).toBeLessThan(0.8);
    expect(ep35).toBeCloseTo(0.7, 2);
  });

  it('extrapolates below the first anchor', () => {
    const ep0 = expectedPerformanceFromChallenge(0);
    expect(ep0).toBeCloseTo(0.9333, 3);
  });

  it('extrapolates above the last anchor', () => {
    const ep1 = expectedPerformanceFromChallenge(1);
    expect(ep1).toBeCloseTo(0.25, 2);
  });

  it('clamps input to [0,1] before mapping', () => {
    expect(expectedPerformanceFromChallenge(-0.1)).toBeCloseTo(expectedPerformanceFromChallenge(0), 5);
    expect(expectedPerformanceFromChallenge(1.1)).toBeCloseTo(expectedPerformanceFromChallenge(1), 5);
  });
});
