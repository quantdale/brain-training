// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createDiagnosticMetadata } from '@/sdk';
import type { GameSessionRecord } from '@/db';

import {
  buildFlexibilityCueRawResult,
  buildSessionRecord,
  persistFlexibilityCueSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { FLEXIBILITY_CUE_DIFFICULTY_PARAMS } from '../difficulty';
import { normalizeFlexibilityCueResult } from '../scoring';
import type { FlexibilityCueRawResult, FlexibilityCueStats } from '../types';

const STATS: FlexibilityCueStats = {
  score: 1200,
  roundsPlayed: 8,
  correctPicks: 7,
  mistakes: 1,
  bestStreak: 5,
  streak: 0,
  totalResponseMs: 20_000,
  scoredPicks: 8,
  switchPlayed: 2,
  switchCorrect: 1,
};

function buildRaw(
  overrides: Partial<Parameters<typeof buildFlexibilityCueRawResult>[0]> = {},
): FlexibilityCueRawResult {
  return buildFlexibilityCueRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    difficulty: 'easy',
    params: FLEXIBILITY_CUE_DIFFICULTY_PARAMS.easy,
    finalSwitchRate: 0.4,
    challengeRating: 0.2,
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

describe('buildFlexibilityCueRawResult', () => {
  it('carries the full reproducibility envelope', () => {
    const raw = buildRaw();
    expect(raw.seed).toBe('42');
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe('1.0.0');
    expect(raw.difficulty).toBe('easy');
    expect(raw.accuracy).toBeCloseTo(0.875);
    expect(raw.speedScore).toBeCloseTo(1 - 20_000 / 8 / 6000);
    expect(raw.switchAccuracy).toBe(0.5);
    expect(raw.generatorInfo).toEqual(
      expect.objectContaining({
        numShapes: 3,
        numColors: 3,
        numNumbers: 3,
        rounds: 8,
        switchRate: 0.4,
        speedTargetMs: 6000,
        finalSwitchRate: 0.4,
        rngAlgorithm: 'mulberry32-v1',
      }),
    );
    expect(raw.diagnosticMetadata).toEqual(
      expect.objectContaining({
        gameId: 'flexibility-cue-shift',
        seed: '42',
        difficulty: 'easy',
        startedAtMs: 1_000,
        activeDurationMs: 45_000,
        pausedDurationMs: 5_000,
      }),
    );
  });

  it('reflects the stats', () => {
    const raw = buildRaw();
    expect(raw.score).toBe(1200);
    expect(raw.roundsPlayed).toBe(8);
    expect(raw.correctPicks).toBe(7);
    expect(raw.mistakes).toBe(1);
    expect(raw.bestStreak).toBe(5);
    expect(raw.switchPlayed).toBe(2);
    expect(raw.switchCorrect).toBe(1);
  });
});

describe('buildSessionRecord', () => {
  it('maps the session onto the db record shape', () => {
    const raw = buildRaw();
    const normalized = normalizeFlexibilityCueResult(raw, {
      gameId: 'flexibility-cue-shift',
      difficulty: 'easy',
      durationMs: 45_000,
    });
    const record: GameSessionRecord = buildSessionRecord({
      sessionId: 'flexibility-cue-shift-x1',
      rawResult: raw,
      difficulty: {
        level: 'easy',
        challengeRating: 0.2,
        parameters: { ...FLEXIBILITY_CUE_DIFFICULTY_PARAMS.easy },
      },
      normalized,
      xp: 0,
      startedAtMs: 1_000,
      completedAtMs: 46_001,
      activeDurationMs: 45_000,
    });
    expect(record).toEqual({
      id: 'flexibility-cue-shift-x1',
      gameId: 'flexibility-cue-shift',
      gameVersion: 1000000,
      generatorVersion: 1000000,
      scoringVersion: 1000000,
      seed: 42,
      difficulty: expect.objectContaining({ level: 'easy', challengeRating: 0.2 }),
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
      gameId: 'flexibility-cue-shift',
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

describe('persistFlexibilityCueSession', () => {
  const record: GameSessionRecord = {
    id: 'flexibility-cue-shift-p1',
    gameId: 'flexibility-cue-shift',
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
    seed: 42,
    difficulty: { level: 'easy', challengeRating: 0.2, parameters: {} },
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
    const outcome = await persistFlexibilityCueSession(record, persister);
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
    const outcome = await persistFlexibilityCueSession(record, persister);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBeInstanceOf(Error);
    }
    expect(errorSpy).toHaveBeenCalledWith(
      '[flexibility-cue-shift] failed to persist completed session flexibility-cue-shift-p1',
      expect.any(Error),
    );
  });
});
