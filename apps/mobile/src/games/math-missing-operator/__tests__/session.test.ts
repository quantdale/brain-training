// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createDiagnosticMetadata } from '@/sdk';
import type { GameSessionRecord } from '@/db';

import { MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS } from '../difficulty';
import { normalizeMathMissingOperatorResult } from '../scoring';
import {
  buildMathMissingOperatorRawResult,
  buildSessionRecord,
  persistMathMissingOperatorSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import type { MathMissingOperatorRawResult, MathMissingOperatorStats } from '../types';

const STATS: MathMissingOperatorStats = {
  score: 450,
  roundsPlayed: 5,
  roundsCorrect: 3,
  bestStreak: 2,
  streak: 0,
  totalResponseMs: 12_000,
  timeouts: 1,
};

function buildRaw(
  overrides: Partial<Parameters<typeof buildMathMissingOperatorRawResult>[0]> = {},
): MathMissingOperatorRawResult {
  return buildMathMissingOperatorRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    difficulty: 'normal',
    params: MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.normal,
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

describe('buildMathMissingOperatorRawResult', () => {
  it('carries the full reproducibility envelope', () => {
    const raw = buildRaw();
    expect(raw.seed).toBe('42');
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe('1.0.0');
    expect(raw.difficulty).toBe('normal');
    expect(raw.accuracy).toBeCloseTo(0.6);
    expect(raw.avgResponseMs).toBe(3000); // 12000 / (5 − 1)
    expect(raw.generatorInfo).toEqual(
      expect.objectContaining({
        minA: 6,
        maxA: 24,
        minB: 2,
        maxB: 5,
        operators: '+,-,*',
        baseTimeMs: 10000,
        minTimeMs: 6000,
        rounds: 7,
        rngAlgorithm: 'mulberry32-v1',
      }),
    );
    expect(raw.diagnosticMetadata).toEqual(
      expect.objectContaining({
        gameId: 'math-missing-operator',
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
    expect(raw.score).toBe(450);
    expect(raw.roundsPlayed).toBe(5);
    expect(raw.roundsCorrect).toBe(3);
    expect(raw.bestStreak).toBe(2);
    expect(raw.timeouts).toBe(1);
    expect(raw.totalResponseMs).toBe(12_000);
  });
});

describe('buildSessionRecord', () => {
  it('maps the session onto the db record shape', () => {
    const raw = buildRaw();
    const normalized = normalizeMathMissingOperatorResult(raw, {
      gameId: 'math-missing-operator',
      difficulty: 'normal',
      durationMs: 45_000,
    });
    const record: GameSessionRecord = buildSessionRecord({
      sessionId: 'mmo-x1',
      rawResult: raw,
      difficulty: {
        level: 'normal',
        challengeRating: 0.5,
        // The SDK profile parameters only carry numbers (like the resolved
        // profile the reducer actually builds).
        parameters: {
          minA: 6,
          maxA: 24,
          minB: 2,
          maxB: 5,
          baseTimeMs: 10000,
          minTimeMs: 6000,
          shrinkPerRound: 0.93,
          rounds: 7,
        },
      },
      normalized,
      xp: 0,
      startedAtMs: 1_000,
      completedAtMs: 46_001,
      activeDurationMs: 45_000,
    });
    expect(record).toEqual({
      id: 'mmo-x1',
      gameId: 'math-missing-operator',
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
      gameId: 'math-missing-operator',
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

describe('persistMathMissingOperatorSession', () => {
  const record: GameSessionRecord = {
    id: 'mmo-p1',
    gameId: 'math-missing-operator',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 42,
    difficulty: { level: 'normal', challengeRating: 0.5, parameters: {} },
    rawResult: buildRaw(),
    normalizedResult: 0.6,
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
    const outcome = await persistMathMissingOperatorSession(record, persister);
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
    const outcome = await persistMathMissingOperatorSession(record, persister);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBeInstanceOf(Error);
    }
    expect(errorSpy).toHaveBeenCalledWith(
      '[math-missing-operator] failed to persist completed session mmo-p1',
      expect.any(Error),
    );
  });
});
