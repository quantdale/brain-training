// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from '@jest/globals';
import { RNG_ALGORITHM_VERSION } from '@/sdk';
import type { DifficultyProfile, GameRawResult } from '@/sdk';

import { DIFFICULTY_PARAMS, resolveSpatialFoldMatchDifficulty } from '../difficulty';
import {
  buildSessionRecord,
  buildSpatialFoldMatchRawResult,
  dbSessionPersister,
  persistSpatialFoldMatchSession,
  seedToNumber,
} from '../session';
import type { SessionPersistence } from '../session';
import { INITIAL_STATS } from '../types';
import type { SpatialFoldMatchRawResult } from '../types';
import { SCORING_VERSION, versionToNumber } from '../versions';

describe('buildSpatialFoldMatchRawResult', () => {
  const params = DIFFICULTY_PARAMS.normal;

  it('carries the full reproducibility envelope', () => {
    const raw = buildSpatialFoldMatchRawResult({
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
      pausedDurationMs: 0,
    });
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe(SCORING_VERSION);
    expect(raw.seed).toBe('seed-x');
    expect(raw.difficulty).toBe('normal');
    expect(raw.gridRows).toBe(3);
    expect(raw.gridCols).toBe(4);
    expect(raw.filledCells).toBe(4);
    expect(raw.sourceRevealMs).toBe(1300);
    expect(raw.totalRounds).toBe(6);
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.diagnosticMetadata.gameId).toBe('spatial-fold-match');
    expect(raw.diagnosticMetadata.seed).toBe('seed-x');
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
  });

  it('computes accuracy and rounded average answer time', () => {
    const raw = buildSpatialFoldMatchRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params,
      challengeRating: 0.5,
      seed: 's',
      stats: { ...INITIAL_STATS, roundsPlayed: 3, roundsPassed: 2, totalAnswerMs: 1000 },
      forced: false,
      startedAtMs: 1,
      activeDurationMs: 1,
      pausedDurationMs: 0,
    });
    expect(raw.accuracy).toBeCloseTo(2 / 3);
    expect(raw.averageAnswerMs).toBe(333);
  });

  it('guards the average answer time against division by zero', () => {
    const raw = buildSpatialFoldMatchRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'easy',
      params: DIFFICULTY_PARAMS.easy,
      challengeRating: 0.2,
      seed: 's',
      stats: { ...INITIAL_STATS },
      forced: true,
      startedAtMs: 1,
      activeDurationMs: 1,
      pausedDurationMs: 0,
    });
    expect(raw.averageAnswerMs).toBe(0);
    expect(raw.accuracy).toBe(0);
    expect(raw.forced).toBe(true);
  });
});

describe('seedToNumber', () => {
  it('keeps numeric seeds verbatim when safe', () => {
    expect(seedToNumber('12345')).toBe(12345);
    expect(seedToNumber('0')).toBe(0);
  });

  it('hashes unsafe-numeric and non-numeric seeds deterministically', () => {
    const huge = String(Number.MAX_SAFE_INTEGER + 1);
    expect(seedToNumber(huge)).toBe(seedToNumber(huge));
    const a = seedToNumber('spatial-fold-match-seed');
    const b = seedToNumber('spatial-fold-match-seed');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(a)).toBe(true);
  });

  it('hashes differently for different seeds', () => {
    expect(seedToNumber('a')).not.toBe(seedToNumber('b'));
  });
});

describe('versionToNumber', () => {
  it('packs major.minor.patch into the integer column format', () => {
    expect(versionToNumber('1.0.0')).toBe(1_000_000);
    expect(versionToNumber('1.2.3')).toBe(1_002_003);
  });

  it('rejects versions without a numeric major component', () => {
    expect(() => versionToNumber(null)).toThrow();
    expect(() => versionToNumber('abc')).toThrow();
  });
});

describe('buildSessionRecord', () => {
  it('maps the outcome onto the persistence record shape', () => {
    const raw = buildSpatialFoldMatchRawResult({
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
    const profile = resolveSpatialFoldMatchDifficulty('normal');
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
    expect(record.gameId).toBe('spatial-fold-match');
    expect(record.gameVersion).toBe(versionToNumber('1.0.0'));
    expect(record.generatorVersion).toBe(versionToNumber('1.0.0'));
    expect(record.scoringVersion).toBe(versionToNumber(SCORING_VERSION));
    expect(record.seed).toBe(seedToNumber('rec-seed'));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe('normal');
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.startedAt).toBe(10);
    expect(record.completedAt).toBe(110);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as SpatialFoldMatchRawResult).seed).toBe('rec-seed');
  });
});

describe('persistSpatialFoldMatchSession', () => {
  function recordFor(): ReturnType<typeof buildSessionRecord> {
    const raw = buildSpatialFoldMatchRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params: DIFFICULTY_PARAMS.normal,
      challengeRating: 0.5,
      seed: 'persist',
      stats: { ...INITIAL_STATS },
      forced: false,
      startedAtMs: 1,
      activeDurationMs: 1,
      pausedDurationMs: 0,
    });
    return buildSessionRecord({
      sessionId: 'persist-1',
      rawResult: raw,
      difficulty: resolveSpatialFoldMatchDifficulty('normal'),
      normalized: { value: 1, scale: '0..1', raw: { ...raw } as GameRawResult },
      xp: 0,
      startedAtMs: 1,
      completedAtMs: 2,
      activeDurationMs: 1,
    });
  }

  it('returns the completion result on success', async () => {
    const completionOutcome = { xp: 7, currency: 2, deltas: [] };
    const persister = {
      completeSession: jest.fn(async (input: { session: unknown }) => ({
        session: input.session,
        ledgerEntry: null,
        balance: 2,
        completionOutcome,
      })),
    };
    const outcome = await persistSpatialFoldMatchSession(
      recordFor(),
      persister as unknown as SessionPersistence,
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.balance).toBe(2);
      expect(outcome.result.completionOutcome).toEqual(completionOutcome);
    }
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
  });

  it('never crashes on persistence failure; reports the error instead', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('db locked');
    const persister = {
      completeSession: jest.fn(async () => {
        throw boom;
      }),
    };
    const outcome = await persistSpatialFoldMatchSession(
      recordFor(),
      persister as unknown as SessionPersistence,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBe(boom);
    }
    errorSpy.mockRestore();
  });

  it('defaults to the db-backed persister seam', () => {
    expect(typeof dbSessionPersister.completeSession).toBe('function');
  });
});
