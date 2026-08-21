// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it, jest } from '@jest/globals';
import { RNG_ALGORITHM_VERSION } from '@/sdk';
import type { DifficultyProfile, GameRawResult } from '@/sdk';
import type { CompleteSessionInput, CompleteSessionResult } from '@/db';

import { resolveOrderPathDifficulty } from '../difficulty';
import { INITIAL_STATS } from '../types';
import type { OrderPathRawResult } from '../types';
import {
  buildOrderPathRawResult,
  buildSessionRecord,
  persistOrderPathSession,
  seedToNumber,
} from '../session';
import { SCORING_VERSION, versionToNumber } from '../versions';

const PARAMS = {
  itemCount: 5,
  edgeDensityTarget: 0.7,
  rounds: 5,
  roundTimeMs: 25_000,
};

function makeRaw(overrides: Partial<Parameters<typeof buildOrderPathRawResult>[0]> = {}) {
  return buildOrderPathRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: SCORING_VERSION,
    difficulty: 'normal',
    params: PARAMS,
    challengeRating: 0.5,
    seed: 'seed-x',
    stats: { ...INITIAL_STATS },
    forced: false,
    startedAtMs: 100,
    activeDurationMs: 1000,
    pausedDurationMs: 0,
    ...overrides,
  });
}

describe('buildOrderPathRawResult', () => {
  it('carries the full reproducibility envelope', () => {
    const raw = makeRaw();
    expect(raw.gameVersion).toBe('1.0.0');
    expect(raw.generatorVersion).toBe('1.0.0');
    expect(raw.scoringVersion).toBe(SCORING_VERSION);
    expect(raw.seed).toBe('seed-x');
    expect(raw.difficulty).toBe('normal');
    expect(raw.itemCount).toBe(5);
    expect(raw.roundTimeMs).toBe(25_000);
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.generatorInfo.itemCount).toBe(5);
    expect(raw.diagnosticMetadata.gameId).toBe('logic-order-path');
    expect(raw.diagnosticMetadata.seed).toBe('seed-x');
    expect(raw.diagnosticMetadata.startedAtMs).toBe(100);
    expect(raw.diagnosticMetadata.activeDurationMs).toBe(1000);
    expect(raw.diagnosticMetadata.pausedDurationMs).toBe(0);
  });

  it('computes accuracy from rounds correct/played', () => {
    const raw = makeRaw({
      stats: { ...INITIAL_STATS, roundsPlayed: 4, roundsCorrect: 3 },
    });
    expect(raw.accuracy).toBe(0.75);
  });

  it('maps an unplayed best time to 0 instead of Infinity', () => {
    expect(makeRaw().bestRoundTimeMs).toBe(0);
    const played = makeRaw({
      stats: { ...INITIAL_STATS, bestRoundTimeMs: 4_321 },
    });
    expect(played.bestRoundTimeMs).toBe(4_321);
  });
});

describe('seedToNumber', () => {
  it('keeps numeric seeds verbatim when safe', () => {
    expect(seedToNumber('12345')).toBe(12345);
  });

  it('hashes unsafe numeric seeds to a stable integer', () => {
    const a = seedToNumber('99999999999999999999');
    expect(a).toBe(seedToNumber('99999999999999999999'));
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
  });

  it('hashes non-numeric seeds deterministically', () => {
    const a = seedToNumber('logic-order-path-seed');
    const b = seedToNumber('logic-order-path-seed');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(a)).toBe(true);
  });

  it('hashes differently for different seeds', () => {
    expect(seedToNumber('a')).not.toBe(seedToNumber('b'));
  });
});

describe('buildSessionRecord', () => {
  it('maps the outcome onto the persistence record shape', () => {
    const raw = makeRaw({ seed: 'rec-seed' });
    const profile: DifficultyProfile = resolveOrderPathDifficulty('normal');
    const record = buildSessionRecord({
      sessionId: 'sid',
      rawResult: raw,
      difficulty: profile,
      normalized: { value: 0.5, scale: '0..1', raw: raw as GameRawResult },
      xp: 0,
      startedAtMs: 10,
      completedAtMs: 110,
      activeDurationMs: 100,
    });
    expect(record.id).toBe('sid');
    expect(record.gameId).toBe('logic-order-path');
    expect(record.gameVersion).toBe(versionToNumber('1.0.0'));
    expect(record.generatorVersion).toBe(versionToNumber('1.0.0'));
    expect(record.scoringVersion).toBe(versionToNumber(SCORING_VERSION));
    expect(record.seed).toBe(seedToNumber('rec-seed'));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe('normal');
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(storedDifficulty.parameters.itemCount).toBe(5);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.startedAt).toBe(10);
    expect(record.completedAt).toBe(110);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as OrderPathRawResult).seed).toBe('rec-seed');
  });
});

describe('persistOrderPathSession', () => {
  it('returns the completion result on success', async () => {
    const completeSession = jest.fn(
      async (input: CompleteSessionInput): Promise<CompleteSessionResult> => ({
        session: input.session,
        ledgerEntry: null,
        balance: 0,
        rating: null,
        completionOutcome: null,
      }),
    );
    const record = buildSessionRecord({
      sessionId: 'sid',
      rawResult: makeRaw(),
      difficulty: resolveOrderPathDifficulty('normal'),
      normalized: { value: 1, scale: '0..1' },
      xp: 0,
      startedAtMs: 0,
      completedAtMs: 10,
      activeDurationMs: 10,
    });
    const outcome = await persistOrderPathSession(record, { completeSession });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.balance).toBe(0);
    }
    expect(completeSession).toHaveBeenCalledTimes(1);
  });

  it('reports failures without throwing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const completeSession = jest.fn(async () => {
        throw new Error('db down');
      });
      const record = buildSessionRecord({
        sessionId: 'sid',
        rawResult: makeRaw(),
        difficulty: resolveOrderPathDifficulty('normal'),
        normalized: { value: 1, scale: '0..1' },
        xp: 0,
        startedAtMs: 0,
        completedAtMs: 10,
        activeDurationMs: 10,
      });
      const outcome = await persistOrderPathSession(record, { completeSession });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(String(outcome.error)).toContain('db down');
      }
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('versionToNumber', () => {
  it('packs semver into major*1e6 + minor*1e3 + patch', () => {
    expect(versionToNumber('1.0.0')).toBe(1_000_000);
    expect(versionToNumber('1.1.0')).toBe(1_001_000);
    expect(versionToNumber('0.2.3')).toBe(2_003);
  });

  it('maps null (non-procedural games) to 0', () => {
    expect(versionToNumber(null)).toBe(0);
  });
});
