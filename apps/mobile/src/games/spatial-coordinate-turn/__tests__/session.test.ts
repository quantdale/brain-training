// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from '@jest/globals';
import { RNG_ALGORITHM_VERSION } from '@/sdk';
import type { DifficultyProfile, GameRawResult } from '@/sdk';
import type { CompleteSessionInput, GameSessionRecord } from '@/db';

import {
  buildSessionRecord,
  buildSpatialCoordinateTurnRawResult,
  dbSessionPersister,
  persistSpatialCoordinateTurnSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { DIFFICULTY_PARAMS, resolveSpatialCoordinateTurnDifficulty } from '../difficulty';
import { INITIAL_STATS } from '../types';
import { SCORING_VERSION, versionToNumber } from '../versions';

function makePersister(ok: boolean): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(async (input: CompleteSessionInput) =>
    ok
      ? { session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null }
      : Promise.reject(new Error('boom')),
  );
  return { completeSession } as SessionPersistence & { completeSession: jest.Mock };
}

describe('buildSpatialCoordinateTurnRawResult', () => {
  const params = DIFFICULTY_PARAMS.normal;

  it('carries the full reproducibility envelope', () => {
    const raw = buildSpatialCoordinateTurnRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params,
      challengeRating: 0.5,
      seed: 'seed-x',
      stats: { ...INITIAL_STATS },
      forced: false,
      startedAtMs: 100,
      activeDurationMs: 1000,
      pausedDurationMs: 50,
    });
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe(SCORING_VERSION);
    expect(raw.seed).toBe('seed-x');
    expect(raw.difficulty).toBe('normal');
    expect(raw.directions).toBe(4);
    expect(raw.rounds).toBe(10);
    expect(raw.minSteps).toBe(3);
    expect(raw.maxSteps).toBe(4);
    expect(raw.moveMax).toBe(3);
    expect(raw.askPosition).toBe(false);
    expect(raw.speedTargetMs).toBe(5000);
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.diagnosticMetadata.gameId).toBe('spatial-coordinate-turn');
    expect(raw.diagnosticMetadata.seed).toBe('seed-x');
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.activeDurationMs).toBe(1000);
    expect(raw.diagnosticMetadata.pausedDurationMs).toBe(50);
  });

  it('computes accuracy and the average response time', () => {
    const raw = buildSpatialCoordinateTurnRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params,
      challengeRating: 0.5,
      seed: 's',
      stats: {
        ...INITIAL_STATS,
        roundsPlayed: 4,
        correctPicks: 3,
        scoredPicks: 4,
        totalResponseMs: 1000,
      },
      forced: false,
      startedAtMs: 1,
      activeDurationMs: 1,
      pausedDurationMs: 0,
    });
    expect(raw.accuracy).toBeCloseTo(0.75);
    expect(raw.averageResponseMs).toBe(250); // round(1000 / 4)
    expect(raw.speedScore).toBeCloseTo(1 - 250 / params.speedTargetMs);
  });

  it('reports a zero average when nothing was scored', () => {
    const raw = buildSpatialCoordinateTurnRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params,
      challengeRating: 0.5,
      seed: 's',
      stats: { ...INITIAL_STATS },
      forced: false,
      startedAtMs: 1,
      activeDurationMs: 1,
      pausedDurationMs: 0,
    });
    expect(raw.averageResponseMs).toBe(0);
    expect(raw.accuracy).toBe(0);
  });
});

describe('seedToNumber', () => {
  it('keeps numeric seeds verbatim when safe', () => {
    expect(seedToNumber('12345')).toBe(12345);
    expect(seedToNumber('0')).toBe(0);
  });

  it('hashes non-numeric and unsafe-numeric seeds deterministically', () => {
    for (const seed of ['spatial-coordinate-turn-seed', '99999999999999999999']) {
      const a = seedToNumber(seed);
      const b = seedToNumber(seed);
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(a)).toBe(true);
    }
  });

  it('hashes differently for different seeds', () => {
    expect(seedToNumber('a')).not.toBe(seedToNumber('b'));
  });
});

describe('versionToNumber', () => {
  it('packs major.minor.patch into the integer db column', () => {
    expect(versionToNumber('1.0.0')).toBe(1_000_000);
    expect(versionToNumber('2.3.7')).toBe(2_003_007);
  });

  it('rejects versions without a numeric major component', () => {
    expect(() => versionToNumber(null)).toThrow();
    expect(() => versionToNumber('abc')).toThrow();
  });
});

describe('buildSessionRecord', () => {
  it('maps the outcome onto the persistence record shape', () => {
    const raw = buildSpatialCoordinateTurnRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params: DIFFICULTY_PARAMS.normal,
      challengeRating: 0.5,
      seed: 'rec-seed',
      stats: { ...INITIAL_STATS },
      forced: false,
      startedAtMs: 10,
      activeDurationMs: 100,
      pausedDurationMs: 0,
    });
    const profile: DifficultyProfile = resolveSpatialCoordinateTurnDifficulty('normal');
    const record: GameSessionRecord = buildSessionRecord({
      sessionId: 'sid',
      rawResult: raw,
      difficulty: profile,
      normalized: { value: 0.5, scale: '0..1', raw: { ...raw } as GameRawResult },
      xp: 0,
      startedAtMs: 10,
      completedAtMs: 110,
      activeDurationMs: 100,
    });
    expect(record.id).toBe('sid');
    expect(record.gameId).toBe('spatial-coordinate-turn');
    expect(record.gameVersion).toBe(versionToNumber('1.0.0'));
    expect(record.generatorVersion).toBe(versionToNumber('1.0.0'));
    expect(record.scoringVersion).toBe(versionToNumber(SCORING_VERSION));
    expect(record.seed).toBe(seedToNumber('rec-seed'));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe('normal');
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(storedDifficulty.parameters).toEqual(profile.parameters);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.startedAt).toBe(10);
    expect(record.completedAt).toBe(110);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as typeof raw).seed).toBe('rec-seed');
  });
});

describe('persistSpatialCoordinateTurnSession', () => {
  function recordFor(sessionId: string): GameSessionRecord {
    const raw = buildSpatialCoordinateTurnRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params: DIFFICULTY_PARAMS.normal,
      challengeRating: 0.5,
      seed: 'p',
      stats: { ...INITIAL_STATS },
      forced: false,
      startedAtMs: 0,
      activeDurationMs: 100,
      pausedDurationMs: 0,
    });
    return buildSessionRecord({
      sessionId,
      rawResult: raw,
      difficulty: resolveSpatialCoordinateTurnDifficulty('normal'),
      normalized: { value: 0.5, scale: '0..1' },
      xp: 10,
      startedAtMs: 0,
      completedAtMs: 100,
      activeDurationMs: 100,
    });
  }

  it('reports success with the persister result', async () => {
    const ok = makePersister(true);
    const res = await persistSpatialCoordinateTurnSession(recordFor('id-1'), ok);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.session.id).toBe('id-1');
    }
    expect(ok.completeSession).toHaveBeenCalledTimes(1);
  });

  it('reports failure without throwing (never crashes the game)', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const fail = makePersister(false);
      const res = await persistSpatialCoordinateTurnSession(recordFor('id-2'), fail);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(String(res.error)).toContain('boom');
      }
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('defaults to the db-backed persister seam', () => {
    expect(typeof dbSessionPersister.completeSession).toBe('function');
  });
});
