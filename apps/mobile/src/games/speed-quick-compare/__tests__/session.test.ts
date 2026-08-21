// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createDiagnosticMetadata } from '@/sdk';
import type { GameSessionRecord } from '@/db';

import {
  buildSessionRecord,
  buildQuickCompareRawResult,
  persistQuickCompareSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { QUICK_COMPARE_DIFFICULTY_PARAMS, quickCompareParamsToRecord } from '../difficulty';
import { normalizeQuickCompareResult } from '../scoring';
import type { QuickCompareRawResult, QuickCompareStats } from '../types';

const STATS: QuickCompareStats = {
  score: 1450,
  roundsTotal: 10,
  roundsCorrect: 9,
  roundsWrong: 1,
  roundsMissed: 0,
  reactions: [180, 220, 150, 260, 200, 190, 210, 170, 160, 0],
  speedFactors: [0.92, 0.9, 0.93, 0.88, 0.91, 0.91, 0.9, 0.93, 0.93, 1],
  bestStreak: 9,
  streak: 0,
};

function buildRaw(overrides: Partial<Parameters<typeof buildQuickCompareRawResult>[0]> = {}): QuickCompareRawResult {
  return buildQuickCompareRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    difficulty: 'normal',
    params: QUICK_COMPARE_DIFFICULTY_PARAMS.normal,
    challengeRating: 0.5,
    seed: '42',
    stats: STATS,
    windowMs: 2200,
    forced: false,
    startedAtMs: 1_000,
    activeDurationMs: 45_000,
    pausedDurationMs: 5_000,
    ...overrides,
  });
}

describe('seedToNumber', () => {
  it('keeps pure-numeric seeds verbatim', () => {
    expect(seedToNumber('42')).toBe(42);
    expect(seedToNumber('0')).toBe(0);
    expect(seedToNumber('4294967295')).toBe(4294967295);
  });

  it('hashes arbitrary seed strings deterministically', () => {
    expect(seedToNumber('my-seed')).toBe(seedToNumber('my-seed'));
    expect(seedToNumber('my-seed')).toBeGreaterThanOrEqual(0);
    expect(seedToNumber('my-seed')).toBeLessThanOrEqual(0xffffffff);
    expect(seedToNumber('my-seed')).not.toBe(seedToNumber('my-seed-2'));
  });
});

describe('buildQuickCompareRawResult', () => {
  it('carries the full reproducibility envelope', () => {
    const raw = buildRaw();
    expect(raw.seed).toBe('42');
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe('1.0.0');
    expect(raw.difficulty).toBe('normal');
    expect(raw.accuracy).toBeCloseTo(9 / 10);
    expect(raw.generatorInfo).toEqual(
      expect.objectContaining({
        rounds: 10,
        windowMs: 2200,
        maxValue: 20,
        optionCount: 3,
        rngAlgorithm: 'mulberry32-v1',
      }),
    );
    expect(raw.diagnosticMetadata).toEqual(
      expect.objectContaining({
        gameId: 'speed-quick-compare',
        seed: '42',
        difficulty: 'normal',
        startedAtMs: 1_000,
        activeDurationMs: 45_000,
        pausedDurationMs: 5_000,
      }),
    );
  });

  it('reflects the stats and derivations', () => {
    const raw = buildRaw();
    expect(raw.score).toBe(1450);
    expect(raw.roundsCorrect).toBe(9);
    expect(raw.roundsWrong).toBe(1);
    expect(raw.roundsMissed).toBe(0);
    expect(raw.reactions).toEqual(STATS.reactions);
    expect(raw.bestReactionMs).toBe(0);
    expect(raw.meanReactionMs).toBeCloseTo(174);
    expect(raw.meanSpeed).toBeCloseTo(0.921);
    expect(raw.bestStreak).toBe(9);
  });
});

describe('buildSessionRecord', () => {
  it('maps the session onto the db record shape', () => {
    const raw = buildRaw();
    const normalized = normalizeQuickCompareResult(raw, {
      gameId: 'speed-quick-compare',
      difficulty: 'normal',
      durationMs: 45_000,
    });
    const record: GameSessionRecord = buildSessionRecord({
      sessionId: 'speed-quick-compare-x1',
      rawResult: raw,
      difficulty: {
        level: 'normal',
        challengeRating: 0.5,
        // Profile parameters are number-only; the prompt-type mix is encoded
        // as a bitmask (same encoding resolveQuickCompareDifficulty uses).
        parameters: quickCompareParamsToRecord(QUICK_COMPARE_DIFFICULTY_PARAMS.normal),
      },
      normalized,
      xp: 0,
      startedAtMs: 1_000,
      completedAtMs: 46_001,
      activeDurationMs: 45_000,
    });
    expect(record).toEqual({
      id: 'speed-quick-compare-x1',
      gameId: 'speed-quick-compare',
      gameVersion: 1000000,
      generatorVersion: 1000000,
      scoringVersion: 1000000,
      seed: 42,
      difficulty: expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
      rawResult: raw,
      normalizedResult: normalized.value,
      xp: 0,
      startedAt: 1_000,
      completedAt: 46_001,
      durationMs: 45_000,
    });
  });
});

describe('persistQuickCompareSession', () => {
  const record: GameSessionRecord = {
    id: 'speed-quick-compare-p1',
    gameId: 'speed-quick-compare',
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
    seed: 42,
    difficulty: { level: 'normal', challengeRating: 0.5, parameters: {} },
    rawResult: buildRaw(),
    normalizedResult: 0.75,
    xp: 0,
    startedAt: 1_000,
    completedAt: 46_001,
    durationMs: 45_000,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists through the injected persister and reports the result', async () => {
    const completeSession = jest.fn(async () => ({
      session: record,
      ledgerEntry: null,
      balance: 0,
      rating: null,
      completionOutcome: null,
    }));
    const persister: SessionPersistence = { completeSession };
    const outcome = await persistQuickCompareSession(record, persister);
    expect(outcome.ok).toBe(true);
    expect(completeSession).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith({ session: record });
  });

  it('logs and returns failure instead of throwing when the db fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const persister: SessionPersistence = {
      completeSession: async () => {
        throw new Error('disk full');
      },
    };
    const outcome = await persistQuickCompareSession(record, persister);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBeInstanceOf(Error);
    }
    expect(errorSpy).toHaveBeenCalledWith(
      '[speed-quick-compare] failed to persist completed session speed-quick-compare-p1',
      expect.any(Error),
    );
  });
});

describe('diagnostic metadata', () => {
  it('records the sdk version', () => {
    const metadata = createDiagnosticMetadata({
      gameId: 'speed-quick-compare',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      seed: '42',
      difficulty: 'normal',
      startedAtMs: 1_000,
      activeDurationMs: 45_000,
      pausedDurationMs: 5_000,
    });
    expect(metadata.sdkVersion).toBe('0.1.0');
  });
});
