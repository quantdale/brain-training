// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createDiagnosticMetadata } from '@/sdk';
import type { GameSessionRecord } from '@/db';

import {
  buildSessionRecord,
  buildTapRushRawResult,
  persistTapRushSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { TAP_RUSH_DIFFICULTY_PARAMS } from '../difficulty';
import { normalizeTapRushResult } from '../scoring';
import type { TapRushRawResult, TapRushStats } from '../types';

const STATS: TapRushStats = {
  score: 2450,
  targetsHit: 25,
  targetsMissed: 5,
  wrongTaps: 3,
  reactions: [180, 220, 150, 260, 200],
  speedFactors: [0.84, 0.8, 0.86, 0.76, 0.82],
  bestStreak: 9,
  streak: 0,
  roundsPlayed: 4,
  roundsPassed: 2,
  perfectRounds: 2,
};

function buildRaw(overrides: Partial<Parameters<typeof buildTapRushRawResult>[0]> = {}): TapRushRawResult {
  return buildTapRushRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    difficulty: 'normal',
    params: TAP_RUSH_DIFFICULTY_PARAMS.normal,
    challengeRating: 0.5,
    seed: '42',
    stats: STATS,
    finalWindowMs: 900,
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

describe('buildTapRushRawResult', () => {
  it('carries the full reproducibility envelope', () => {
    const raw = buildRaw();
    expect(raw.seed).toBe('42');
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe('1.0.0');
    expect(raw.difficulty).toBe('normal');
    expect(raw.accuracy).toBeCloseTo(25 / 30);
    expect(raw.generatorInfo).toEqual(
      expect.objectContaining({
        count: 10,
        rounds: 4,
        initialWindowMs: 1100,
        minWindowMs: 700,
        windowStepMs: 100,
        targetRadius: 0.075,
        rngAlgorithm: 'mulberry32-v1',
      }),
    );
    expect(raw.diagnosticMetadata).toEqual(
      expect.objectContaining({
        gameId: 'speed-tap-rush',
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
    expect(raw.score).toBe(2450);
    expect(raw.targetsHit).toBe(25);
    expect(raw.targetsMissed).toBe(5);
    expect(raw.wrongTaps).toBe(3);
    expect(raw.reactions).toEqual([180, 220, 150, 260, 200]);
    expect(raw.speedFactors).toEqual([0.84, 0.8, 0.86, 0.76, 0.82]);
    expect(raw.bestReactionMs).toBe(150);
    expect(raw.meanReactionMs).toBeCloseTo(202);
    expect(raw.meanSpeed).toBeCloseTo(0.816);
    expect(raw.bestStreak).toBe(9);
    expect(raw.perfectRounds).toBe(2);
    expect(raw.finalWindowMs).toBe(900);
    expect(raw.totalTargets).toBe(40);
  });
});

describe('buildSessionRecord', () => {
  it('maps the session onto the db record shape', () => {
    const raw = buildRaw();
    const normalized = normalizeTapRushResult(raw, {
      gameId: 'speed-tap-rush',
      difficulty: 'normal',
      durationMs: 45_000,
    });
    const record: GameSessionRecord = buildSessionRecord({
      sessionId: 'speed-tap-rush-x1',
      rawResult: raw,
      difficulty: {
        level: 'normal',
        challengeRating: 0.5,
        parameters: { ...TAP_RUSH_DIFFICULTY_PARAMS.normal },
      },
      normalized,
      xp: 0,
      startedAtMs: 1_000,
      completedAtMs: 46_001,
      activeDurationMs: 45_000,
    });
    expect(record).toEqual({
      id: 'speed-tap-rush-x1',
      gameId: 'speed-tap-rush',
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
      gameId: 'speed-tap-rush',
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

describe('persistTapRushSession', () => {
  const record: GameSessionRecord = {
    id: 'speed-tap-rush-p1',
    gameId: 'speed-tap-rush',
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
    const outcome = await persistTapRushSession(record, persister);
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
    const outcome = await persistTapRushSession(record, persister);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBeInstanceOf(Error);
    }
    expect(errorSpy).toHaveBeenCalledWith(
      '[speed-tap-rush] failed to persist completed session speed-tap-rush-p1',
      expect.any(Error),
    );
  });
});