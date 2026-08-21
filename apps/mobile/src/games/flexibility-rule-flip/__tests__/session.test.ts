// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from '@jest/globals';
import { RNG_ALGORITHM_VERSION } from '@/sdk';
import type { DifficultyProfile, GameRawResult } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import {
  FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS,
  resolveFlexibilityRuleFlipDifficulty,
} from '../difficulty';
import { INITIAL_STATS } from '../types';
import type { FlexibilityRuleFlipRawResult } from '../types';
import {
  buildFlexibilityRuleFlipRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistFlexibilityRuleFlipSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { SCORING_VERSION } from '../versions';

function rawInput(overrides: Partial<Parameters<typeof buildFlexibilityRuleFlipRawResult>[0]> = {}) {
  return {
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: SCORING_VERSION,
    difficulty: 'normal' as const,
    params: FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal,
    finalSwitchRate: FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal.flipRate,
    challengeRating: 0.5,
    seed: 'seed-x',
    stats: { ...INITIAL_STATS },
    forced: false,
    startedAtMs: 100,
    activeDurationMs: 1000,
    pausedDurationMs: 0,
    ...overrides,
  };
}

describe('buildFlexibilityRuleFlipRawResult', () => {
  it('carries the full reproducibility envelope', () => {
    const raw = buildFlexibilityRuleFlipRawResult(rawInput());
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe(SCORING_VERSION);
    expect(raw.seed).toBe('seed-x');
    expect(raw.difficulty).toBe('normal');
    expect(raw.totalRounds).toBe(10);
    expect(raw.numShapes).toBe(3);
    expect(raw.numColors).toBe(3);
    expect(raw.numNumbers).toBe(4);
    expect(raw.flipRate).toBe(0.55);
    expect(raw.switchRate).toBe(0.55);
    expect(raw.speedTargetMs).toBe(5000);
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.generatorInfo.blockMin).toBe(FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal.blockMin);
    expect(raw.diagnosticMetadata.gameId).toBe('flexibility-rule-flip');
    expect(raw.diagnosticMetadata.seed).toBe('seed-x');
    expect(raw.diagnosticMetadata.startedAtMs).toBe(100);
  });

  it('computes accuracy / speed / switch + repeat accuracies from stats', () => {
    const raw = buildFlexibilityRuleFlipRawResult(
      rawInput({
        stats: {
          ...INITIAL_STATS,
          roundsPlayed: 10,
          correctPicks: 8,
          mistakes: 2,
          bestStreak: 5,
          totalResponseMs: 15000,
          scoredPicks: 10,
          switchPlayed: 2,
          switchCorrect: 1,
          repeatPlayed: 8,
          repeatCorrect: 7,
        },
      }),
    );
    expect(raw.accuracy).toBeCloseTo(0.8);
    // speedScore = clamp01(1 - mean/speedTarget) = 1 - 1500/5000 = 0.7
    expect(raw.speedScore).toBeCloseTo(0.7);
    expect(raw.switchAccuracy).toBe(0.5);
    expect(raw.repeatAccuracy).toBeCloseTo(0.875);
  });
});

describe('seedToNumber', () => {
  it('keeps numeric seeds verbatim when safe', () => {
    expect(seedToNumber('12345')).toBe(12345);
  });
  it('hashes non-numeric seeds deterministically', () => {
    const a = seedToNumber('flexibility-rule-flip-seed');
    const b = seedToNumber('flexibility-rule-flip-seed');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(a)).toBe(true);
  });
  it('hashes differently for different seeds', () => {
    expect(seedToNumber('a')).not.toBe(seedToNumber('b'));
  });
});

describe('buildSessionRecord', () => {
  it('maps the outcome onto the persistence record shape', () => {
    const raw = buildFlexibilityRuleFlipRawResult(rawInput({ seed: 'rec-seed' }));
    const profile = resolveFlexibilityRuleFlipDifficulty('normal');
    const record = buildSessionRecord({
      sessionId: 'sid',
      rawResult: raw,
      difficulty: profile,
      normalized: {
        value: 0.5,
        scale: '0..1',
        raw: { ...raw } as GameRawResult,
      },
      xp: 0,
      startedAtMs: 10,
      completedAtMs: 110,
      activeDurationMs: 100,
    });
    expect(record.id).toBe('sid');
    expect(record.gameId).toBe('flexibility-rule-flip');
    expect(record.gameVersion).toBe(1_000_000);
    expect(record.generatorVersion).toBe(1_000_000);
    expect(record.scoringVersion).toBe(1_000_000);
    expect(record.seed).toBe(seedToNumber('rec-seed'));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe('normal');
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(storedDifficulty.parameters.rounds).toBe(10);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.startedAt).toBe(10);
    expect(record.completedAt).toBe(110);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as FlexibilityRuleFlipRawResult).seed).toBe('rec-seed');
  });
});

describe('persistFlexibilityRuleFlipSession', () => {
  it('persists through the injected persister and reports the outcome', async () => {
    const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
      session: input.session,
      ledgerEntry: null,
      balance: 0,
      rating: null,
      completionOutcome: null,
    }));
    const record = { id: 'x' } as never;
    const outcome = await persistFlexibilityRuleFlipSession(record, {
      completeSession,
    } as unknown as SessionPersistence);
    expect(outcome.ok).toBe(true);
    expect(completeSession).toHaveBeenCalledWith({ session: record });
  });

  it('never throws on persistence failure; logs and reports the error', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('db down');
    const outcome = await persistFlexibilityRuleFlipSession({ id: 'x' } as never, {
      completeSession: async () => {
        throw boom;
      },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBe(boom);
    }
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('defaults to the db-backed persister seam', () => {
    expect(typeof dbSessionPersister.completeSession).toBe('function');
  });
});
