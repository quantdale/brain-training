// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from '@jest/globals';
import { RNG_ALGORITHM_VERSION } from '@/sdk';
import type { DifficultyProfile, GameRawResult } from '@/sdk';

import {
  flexibilityTaskSwitchParamsFromProfile,
  resolveFlexibilityTaskSwitchDifficulty,
} from '../difficulty';
import { INITIAL_STATS } from '../types';
import type { FlexibilityTaskSwitchRawResult } from '../types';
import {
  buildFlexibilityTaskSwitchRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistFlexibilityTaskSwitchSession,
  seedToNumber,
} from '../session';
import { SCORING_VERSION, versionToNumber } from '../versions';

const NORMAL = flexibilityTaskSwitchParamsFromProfile(
  resolveFlexibilityTaskSwitchDifficulty('normal'),
);

/** Stats fixture: 4 played / 3 correct, switch RT 1500 avg vs repeat RT 500 avg. */
const STATS = {
  ...INITIAL_STATS,
  score: 450,
  roundsPlayed: 4,
  correctPicks: 3,
  mistakes: 1,
  bestStreak: 2,
  totalResponseMs: 4000,
  scoredPicks: 4,
  switchPlayed: 2,
  switchCorrect: 1,
  repeatPlayed: 2,
  repeatCorrect: 2,
  switchRtSum: 3000,
  switchRtCount: 2,
  repeatRtSum: 1000,
  repeatRtCount: 2,
};

function buildRaw(overrides: Partial<Parameters<typeof buildFlexibilityTaskSwitchRawResult>[0]> = {}) {
  return buildFlexibilityTaskSwitchRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: SCORING_VERSION,
    difficulty: 'normal',
    params: NORMAL,
    finalSwitchRate: NORMAL.switchRate,
    challengeRating: 0.5,
    seed: 'seed-x',
    stats: { ...STATS },
    forced: false,
    startedAtMs: 100,
    activeDurationMs: 1000,
    pausedDurationMs: 0,
    ...overrides,
  });
}

describe('buildFlexibilityTaskSwitchRawResult', () => {
  it('carries the full reproducibility envelope', () => {
    const raw = buildRaw();
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe(SCORING_VERSION);
    expect(raw.seed).toBe('seed-x');
    expect(raw.difficulty).toBe('normal');
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.totalRounds).toBe(NORMAL.rounds);
    expect(raw.taskPool).toEqual(NORMAL.taskPool);
    expect(raw.numColors).toBe(NORMAL.numColors);
    expect(raw.numShapes).toBe(NORMAL.numShapes);
    expect(raw.numNumbers).toBe(NORMAL.numNumbers);
    expect(raw.switchRate).toBe(NORMAL.switchRate);
    expect(raw.speedTargetMs).toBe(NORMAL.speedTargetMs);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.generatorInfo.finalSwitchRate).toBe(NORMAL.switchRate);
    expect(raw.diagnosticMetadata.gameId).toBe('flexibility-task-switch');
    expect(raw.diagnosticMetadata.seed).toBe('seed-x');
  });

  it('computes accuracy, speed, switch accuracy and switch cost from the stats', () => {
    const raw = buildRaw();
    expect(raw.accuracy).toBeCloseTo(0.75); // 3/4
    expect(raw.speedScore).toBeCloseTo(1 - 1000 / NORMAL.speedTargetMs); // mean RT 1000ms
    expect(raw.switchAccuracy).toBeCloseTo(0.5); // 1/2
    expect(raw.repeatPlayed).toBe(2);
    expect(raw.repeatCorrect).toBe(2);
    expect(raw.switchCostMs).toBeCloseTo(1000); // 1500 − 500
  });

  it('marks forced sessions', () => {
    expect(buildRaw({ forced: true }).forced).toBe(true);
  });
});

describe('seedToNumber', () => {
  it('keeps numeric seeds verbatim when safe', () => {
    expect(seedToNumber('12345')).toBe(12345);
    expect(seedToNumber('0')).toBe(0);
  });

  it('hashes non-numeric seeds deterministically', () => {
    const a = seedToNumber('flexibility-task-switch-seed');
    const b = seedToNumber('flexibility-task-switch-seed');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(a)).toBe(true);
  });

  it('hashes differently for different seeds', () => {
    expect(seedToNumber('a')).not.toBe(seedToNumber('b'));
  });

  it('falls back to hashing for numerically-unsafe seeds', () => {
    const huge = '9'.repeat(25); // far beyond Number.MAX_SAFE_INTEGER
    expect(Number.isSafeInteger(Number(huge))).toBe(false);
    expect(seedToNumber(huge)).toBe(seedToNumber(huge));
  });
});

describe('versionToNumber', () => {
  it('packs semver into major*1e6 + minor*1e3 + patch', () => {
    expect(versionToNumber('1.2.3')).toBe(1_002_003);
    expect(versionToNumber(SCORING_VERSION)).toBe(1_000_000);
  });

  it('rejects null (non-procedural games are not supported here)', () => {
    expect(() => versionToNumber(null)).toThrow(/null/);
  });
});

describe('buildSessionRecord', () => {
  it('maps the outcome onto the persistence record shape', () => {
    const raw = buildRaw();
    const profile = resolveFlexibilityTaskSwitchDifficulty('normal');
    const record = buildSessionRecord({
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
    expect(record.gameId).toBe('flexibility-task-switch');
    expect(record.gameVersion).toBe(versionToNumber('1.0.0'));
    expect(record.generatorVersion).toBe(versionToNumber('1.0.0'));
    expect(record.scoringVersion).toBe(versionToNumber(SCORING_VERSION));
    expect(record.seed).toBe(seedToNumber('seed-x'));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe('normal');
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(storedDifficulty.parameters.rounds).toBe(NORMAL.rounds);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.startedAt).toBe(10);
    expect(record.completedAt).toBe(110);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as FlexibilityTaskSwitchRawResult).seed).toBe('seed-x');
  });
});

describe('persistFlexibilityTaskSwitchSession', () => {
  it('returns the completion result on success', async () => {
    const result = {
      session: {} as unknown,
      ledgerEntry: null,
      balance: 0,
      rating: null,
      completionOutcome: null,
    };
    const persister = { completeSession: jest.fn(async () => result) };
    const outcome = await persistFlexibilityTaskSwitchSession(
      { id: 'sid' } as never,
      persister as never,
    );
    expect(outcome).toEqual({ ok: true, result });
    expect(persister.completeSession).toHaveBeenCalledWith({ session: { id: 'sid' } });
  });

  it('logs and reports failures instead of throwing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('db unavailable');
    const persister = { completeSession: jest.fn(async () => { throw boom; }) };
    const outcome = await persistFlexibilityTaskSwitchSession(
      { id: 'sid' } as never,
      persister as never,
    );
    expect(outcome).toEqual({ ok: false, error: boom });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('defaults to the db-backed persister seam', () => {
    expect(typeof dbSessionPersister.completeSession).toBe('function');
  });
});
