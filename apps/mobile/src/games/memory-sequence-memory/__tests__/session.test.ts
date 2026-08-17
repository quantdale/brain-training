// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createDiagnosticMetadata } from '@/sdk';
import type { GameSessionRecord } from '@/db';

import {
  buildSequenceMemoryRawResult,
  buildSessionRecord,
  persistSequenceMemorySession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { SEQUENCE_MEMORY_DIFFICULTY_PARAMS } from '../difficulty';
import { normalizeSequenceMemoryResult } from '../scoring';
import type { SequenceMemoryRawResult, SequenceMemoryStats } from '../types';

const STATS: SequenceMemoryStats = {
  score: 550,
  roundsPlayed: 4,
  roundsPassed: 3,
  bestStreak: 2,
  streak: 0,
  longestSequence: 6,
  totalTaps: 21,
  correctTaps: 18,
};

function buildRaw(
  overrides: Partial<Parameters<typeof buildSequenceMemoryRawResult>[0]> = {},
): SequenceMemoryRawResult {
  return buildSequenceMemoryRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    difficulty: 'normal',
    params: SEQUENCE_MEMORY_DIFFICULTY_PARAMS.normal,
    challengeRating: 0.5,
    seed: '42',
    stats: STATS,
    timeUp: false,
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

describe('buildSequenceMemoryRawResult', () => {
  it('carries the full reproducibility envelope', () => {
    const raw = buildRaw();
    expect(raw.seed).toBe('42');
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe('1.0.0');
    expect(raw.difficulty).toBe('normal');
    expect(raw.accuracy).toBeCloseTo(0.75);
    expect(raw.timeUp).toBe(false);
    expect(raw.generatorInfo).toEqual(
      expect.objectContaining({
        tileCount: 4,
        baseLength: 3,
        maxLength: 8,
        revealMs: 900,
        sessionSeconds: 90,
        rngAlgorithm: 'mulberry32-v1',
      }),
    );
    expect(raw.diagnosticMetadata).toEqual(
      expect.objectContaining({
        gameId: 'memory-sequence-memory',
        seed: '42',
        difficulty: 'normal',
        startedAtMs: 1_000,
        activeDurationMs: 45_000,
        pausedDurationMs: 5_000,
      }),
    );
  });

  it('records the time-up flag and the stats', () => {
    const raw = buildRaw({ timeUp: true });
    expect(raw.timeUp).toBe(true);
    expect(raw.score).toBe(550);
    expect(raw.roundsPlayed).toBe(4);
    expect(raw.roundsPassed).toBe(3);
    expect(raw.longestSequence).toBe(6);
    expect(raw.bestStreak).toBe(2);
  });
});

describe('buildSessionRecord', () => {
  it('maps the session onto the db record shape', () => {
    const raw = buildRaw();
    const normalized = normalizeSequenceMemoryResult(raw, {
      gameId: 'memory-sequence-memory',
      difficulty: 'normal',
      durationMs: 45_000,
    });
    const record: GameSessionRecord = buildSessionRecord({
      sessionId: 'memory-sequence-memory-x1',
      rawResult: raw,
      difficulty: {
        level: 'normal',
        challengeRating: 0.5,
        parameters: { ...SEQUENCE_MEMORY_DIFFICULTY_PARAMS.normal },
      },
      normalized,
      xp: 0,
      startedAtMs: 1_000,
      completedAtMs: 46_001,
      activeDurationMs: 45_000,
    });
    expect(record).toEqual({
      id: 'memory-sequence-memory-x1',
      gameId: 'memory-sequence-memory',
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
      gameId: 'memory-sequence-memory',
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

describe('persistSequenceMemorySession', () => {
  const record: GameSessionRecord = {
    id: 'memory-sequence-memory-p1',
    gameId: 'memory-sequence-memory',
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
    const outcome = await persistSequenceMemorySession(record, persister);
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
    const outcome = await persistSequenceMemorySession(record, persister);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBeInstanceOf(Error);
    }
    expect(errorSpy).toHaveBeenCalledWith(
      '[memory-sequence-memory] failed to persist completed session memory-sequence-memory-p1',
      expect.any(Error),
    );
  });
});
