// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createDiagnosticMetadata } from '@/sdk';
import type { GameSessionRecord } from '@/db';

import {
  buildOddOneOutRawResult,
  buildSessionRecord,
  persistOddOneOutSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { ODD_ONE_OUT_DIFFICULTY_PARAMS } from '../difficulty';
import { normalizeOddOneOutResult } from '../scoring';
import { GAME_ID } from '../types';
import type { OddOneOutRawResult, OddOneOutStats } from '../types';

const STATS: OddOneOutStats = {
  score: 550,
  roundsPlayed: 4,
  roundsPassed: 3,
  firstTryCorrect: 2,
  wrongTaps: 3,
  timeouts: 1,
  bestStreak: 2,
  streak: 0,
  solveRatioSum: 1.5,
};

function buildRaw(
  overrides: Partial<Parameters<typeof buildOddOneOutRawResult>[0]> = {},
): OddOneOutRawResult {
  return buildOddOneOutRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    difficulty: 'normal',
    params: ODD_ONE_OUT_DIFFICULTY_PARAMS.normal,
    gridSize: 9,
    subtlety: 1,
    windowMs: 10_500,
    challengeRating: 0.5,
    seed: '42',
    stats: STATS,
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

describe('buildOddOneOutRawResult', () => {
  it('carries the full reproducibility envelope', () => {
    const raw = buildRaw();
    expect(raw.seed).toBe('42');
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe('1.0.0');
    expect(raw.difficulty).toBe('normal');
    expect(raw.accuracy).toBeCloseTo(0.75);
    expect(raw.firstTryRate).toBeCloseTo(0.5);
    expect(raw.avgSolveRatio).toBeCloseTo(0.5);
    expect(raw.generatorInfo).toEqual(
      expect.objectContaining({
        gridSize: 9,
        subtlety: 1,
        windowMs: 10_500,
        rounds: 6,
        minSubtlety: 0,
        maxSubtlety: 2,
        minWindowMs: 9_000,
        maxWindowMs: 12_000,
        windowStepMs: 1_500,
        rngAlgorithm: 'mulberry32-v1',
      }),
    );
    expect(raw.diagnosticMetadata).toEqual(
      expect.objectContaining({
        gameId: GAME_ID,
        seed: '42',
        difficulty: 'normal',
        startedAtMs: 1_000,
        activeDurationMs: 45_000,
        pausedDurationMs: 5_000,
      }),
    );
  });

  it('reflects the stats', () => {
    const raw = buildRaw();
    expect(raw.score).toBe(550);
    expect(raw.roundsPlayed).toBe(4);
    expect(raw.roundsPassed).toBe(3);
    expect(raw.firstTryCorrect).toBe(2);
    expect(raw.wrongTaps).toBe(3);
    expect(raw.timeouts).toBe(1);
    expect(raw.bestStreak).toBe(2);
  });
});

describe('buildSessionRecord', () => {
  it('maps the session onto the db record shape', () => {
    const raw = buildRaw();
    const normalized = normalizeOddOneOutResult(raw, {
      gameId: GAME_ID,
      difficulty: 'normal',
      durationMs: 45_000,
    });
    const record: GameSessionRecord = buildSessionRecord({
      sessionId: 'ooo-x1',
      rawResult: raw,
      difficulty: {
        level: 'normal',
        challengeRating: 0.5,
        parameters: { ...ODD_ONE_OUT_DIFFICULTY_PARAMS.normal },
      },
      normalized,
      xp: 0,
      startedAtMs: 1_000,
      completedAtMs: 46_001,
      activeDurationMs: 45_000,
    });
    expect(record).toEqual({
      id: 'ooo-x1',
      gameId: GAME_ID,
      gameVersion: 1,
      generatorVersion: 1,
      scoringVersion: 1,
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

  it('records the diagnostic metadata through createDiagnosticMetadata', () => {
    const raw = buildRaw();
    const metadata = createDiagnosticMetadata({
      gameId: GAME_ID,
      gameVersion: raw.gameVersion,
      generatorVersion: raw.generatorVersion,
      seed: raw.seed,
      difficulty: raw.difficulty,
      startedAtMs: raw.diagnosticMetadata.startedAtMs,
      activeDurationMs: raw.diagnosticMetadata.activeDurationMs,
      pausedDurationMs: raw.diagnosticMetadata.pausedDurationMs,
    });
    expect(metadata.sdkVersion).toBe('0.1.0');
  });
});

describe('persistOddOneOutSession', () => {
  const record: GameSessionRecord = {
    id: 'ooo-p1',
    gameId: GAME_ID,
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
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
    const outcome = await persistOddOneOutSession(record, persister);
    expect(outcome.ok).toBe(true);
    expect(completeSession).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith({ session: record });
    if (outcome.ok) {
      expect(outcome.result.balance).toBe(0);
      expect(outcome.result.ledgerEntry).toBeNull();
    }
  });

  it('logs and returns failure instead of throwing when the db fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const persister: SessionPersistence = {
      completeSession: async () => {
        throw new Error('disk full');
      },
    };
    const outcome = await persistOddOneOutSession(record, persister);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBeInstanceOf(Error);
    }
    expect(errorSpy).toHaveBeenCalledWith(
      '[attention-odd-one-out] failed to persist completed session ooo-p1',
      expect.any(Error),
    );
  });
});