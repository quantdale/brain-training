// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng, RNG_ALGORITHM_VERSION } from '@/sdk';
import type { DifficultyProfile, GameRawResult } from '@/sdk';

import {
  SYMBOL_TRACKER_DIFFICULTY_PARAMS,
  resolveSymbolTrackerDifficulty,
} from '../difficulty';
import { generateRound } from '../generator';
import { INITIAL_STATS } from '../types';
import type { SymbolTrackerRawResult } from '../types';
import {
  buildSessionRecord,
  buildSymbolTrackerRawResult,
  seedToNumber,
} from '../session';
import { SCORING_VERSION } from '../versions';

describe('buildSymbolTrackerRawResult', () => {
  const params = SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal;

  it('carries the full reproducibility envelope', () => {
    const raw = buildSymbolTrackerRawResult({
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
    expect(raw.seed).toBe('seed-x');
    expect(raw.difficulty).toBe('normal');
    expect(raw.gridSize).toBe(9);
    expect(raw.tokenCount).toBe(6);
    expect(raw.initialTrackCount).toBe(2);
    expect(raw.observeMs).toBe(2200);
    expect(raw.distractors).toBe(0);
    expect(raw.challengeRating).toBe(0.5);
    expect(raw.forced).toBe(false);
    expect(raw.generatorInfo.rngAlgorithm).toBe(RNG_ALGORITHM_VERSION);
    expect(raw.generatorInfo.tokenCount).toBe(6);
    expect(raw.diagnosticMetadata.gameId).toBe('attention-symbol-tracker');
    expect(raw.diagnosticMetadata.seed).toBe('seed-x');
  });

  it('computes accuracy from rounds passed/played', () => {
    const raw = buildSymbolTrackerRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params,
      challengeRating: 0.5,
      seed: 's',
      stats: { ...INITIAL_STATS, roundsPlayed: 4, roundsPassed: 3 },
      forced: false,
      startedAtMs: 1,
      activeDurationMs: 1,
      pausedDurationMs: 0,
    });
    expect(raw.accuracy).toBe(0.75);
  });
});

describe('seedToNumber', () => {
  it('keeps numeric seeds verbatim when safe', () => {
    expect(seedToNumber('12345')).toBe(12345);
  });
  it('hashes non-numeric seeds deterministically', () => {
    const a = seedToNumber('attention-symbol-tracker-seed');
    const b = seedToNumber('attention-symbol-tracker-seed');
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
    const params = SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal;
    const raw = buildSymbolTrackerRawResult({
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params,
      challengeRating: 0.5,
      seed: 'rec-seed',
      stats: { ...INITIAL_STATS },
      forced: false,
      startedAtMs: 10,
      activeDurationMs: 100,
      pausedDurationMs: 0,
    });
    const profile = resolveSymbolTrackerDifficulty('normal');
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
    expect(record.gameId).toBe('attention-symbol-tracker');
    expect(record.seed).toBe(seedToNumber('rec-seed'));
    // `GameSessionRecord.difficulty` is `unknown` at the db boundary; the
    // session builder stores the resolved profile document.
    const storedDifficulty = record.difficulty as DifficultyProfile;
    expect(storedDifficulty.level).toBe('normal');
    expect(storedDifficulty.challengeRating).toBe(0.5);
    expect(record.normalizedResult).toBe(0.5);
    expect(record.xp).toBe(0);
    expect(record.durationMs).toBe(100);
    expect((record.rawResult as SymbolTrackerRawResult).seed).toBe('rec-seed');
  });
});

describe('generator determinism across a session', () => {
  it('produces distinct valid rounds for a seed', () => {
    const seed = 'gen-seed';
    const r0 = generateRound({
      rng: createRng(seed),
      roundIndex: 0,
      gridSize: 9,
      tokenCount: 6,
      trackCount: 2,
      distractors: 0,
      prevTracked: null,
    });
    const r1 = generateRound({
      rng: createRng(seed),
      roundIndex: 1,
      gridSize: 9,
      tokenCount: 6,
      trackCount: 2,
      distractors: 0,
      prevTracked: r0.trackedSymbolIds,
    });
    expect(r0.trackedSymbolIds).toHaveLength(2);
    expect(r1.trackedSymbolIds).toHaveLength(2);
    expect(r1.trackedSymbolIds).not.toEqual(r0.trackedSymbolIds);
    // stable
    expect(
      generateRound({
        rng: createRng(seed),
        roundIndex: 0,
        gridSize: 9,
        tokenCount: 6,
        trackCount: 2,
        distractors: 0,
        prevTracked: null,
      }),
    ).toEqual(r0);
  });

  it('rejects invalid inputs', () => {
    expect(() =>
      generateRound({
        rng: createRng('x'),
        roundIndex: 0,
        gridSize: 4,
        tokenCount: 7,
        trackCount: 2,
        distractors: 0,
        prevTracked: null,
      }),
    ).toThrow();
  });
});
