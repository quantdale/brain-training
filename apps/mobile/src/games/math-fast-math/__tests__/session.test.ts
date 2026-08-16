// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createDiagnosticMetadata } from '@/sdk';
import type { GameSessionRecord } from '@/db';

import {
  buildMathRawResult,
  buildSessionRecord,
  persistMathSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { MATH_DIFFICULTY_PARAMS, mathParamsToRecord } from '../difficulty';
import { normalizeMathResult } from '../scoring';
import type { MathRawResult, MathStats } from '../types';

const STATS: MathStats = {
  score: 700,
  problemsPlayed: 5,
  problemsCorrect: 4,
  bestStreak: 3,
  streak: 0,
  fastestMs: 900,
  totalCorrectMs: 4_200,
};

function buildRaw(overrides: Partial<Parameters<typeof buildMathRawResult>[0]> = {}): MathRawResult {
  return buildMathRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    difficulty: 'normal',
    params: MATH_DIFFICULTY_PARAMS.normal,
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

describe('buildMathRawResult', () => {
  it('carries the full reproducibility envelope', () => {
    const raw = buildRaw();
    expect(raw.seed).toBe('42');
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe('1.0.0');
    expect(raw.difficulty).toBe('normal');
    expect(raw.accuracy).toBeCloseTo(0.8);
    expect(raw.avgCorrectMs).toBe(1_050); // 4200 / 4
    expect(raw.timeBudgetMs).toBe(8_000);
    expect(raw.generatorInfo).toEqual(
      expect.objectContaining({
        rounds: 5,
        timeBudgetMs: 8_000,
        operatorMask: 7, // '+' | '−' | '×'
        maxLeft_add: 12,
        maxRight_add: 12,
        maxLeft_sub: 12,
        maxRight_sub: 12,
        maxLeft_mul: 9,
        maxRight_mul: 9,
        maxLeft_div: 64,
        maxRight_div: 8,
        rngAlgorithm: 'mulberry32-v1',
      }),
    );
    expect(raw.diagnosticMetadata).toEqual(
      expect.objectContaining({
        gameId: 'math-fast-math',
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
    expect(raw.score).toBe(700);
    expect(raw.problemsPlayed).toBe(5);
    expect(raw.problemsCorrect).toBe(4);
    expect(raw.bestStreak).toBe(3);
    expect(raw.fastestMs).toBe(900);
  });

  it('derives null averages when nothing was answered correctly', () => {
    const raw = buildRaw({
      stats: { ...STATS, problemsCorrect: 0, totalCorrectMs: 0, fastestMs: null },
    });
    expect(raw.avgCorrectMs).toBeNull();
    expect(raw.fastestMs).toBeNull();
    expect(raw.accuracy).toBe(0);
  });
});

describe('buildSessionRecord', () => {
  it('maps the session onto the db record shape', () => {
    const raw = buildRaw();
    const normalized = normalizeMathResult(raw, {
      gameId: 'math-fast-math',
      difficulty: 'normal',
      durationMs: 45_000,
    });
    const record: GameSessionRecord = buildSessionRecord({
      sessionId: 'math-x1',
      rawResult: raw,
      difficulty: {
        level: 'normal',
        challengeRating: 0.5,
        parameters: { ...mathParamsToRecord(MATH_DIFFICULTY_PARAMS.normal) },
      },
      normalized,
      xp: 0,
      startedAtMs: 1_000,
      completedAtMs: 46_001,
      activeDurationMs: 45_000,
    });
    expect(record).toEqual({
      id: 'math-x1',
      gameId: 'math-fast-math',
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
      gameId: 'math-fast-math',
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

describe('persistMathSession', () => {
  const record: GameSessionRecord = {
    id: 'math-p1',
    gameId: 'math-fast-math',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 42,
    difficulty: { level: 'normal', challengeRating: 0.5, parameters: {} },
    rawResult: buildRaw(),
    normalizedResult: 0.7,
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
    }));
    const persister: SessionPersistence = { completeSession };
    const outcome = await persistMathSession(record, persister);
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
    const outcome = await persistMathSession(record, persister);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBeInstanceOf(Error);
    }
    expect(errorSpy).toHaveBeenCalledWith(
      '[math-fast-math] failed to persist completed session math-p1',
      expect.any(Error),
    );
  });
});
