// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  nextFilledCells,
  nextOptionCount,
  paramsForLevel,
  resolveSpatialFoldMatchDifficulty,
  sessionChallengeRating,
  spatialFoldMatchParamsFromProfile,
} from '../difficulty';

const LEVELS: readonly DifficultyLevel[] = ['easy', 'normal', 'hard', 'expert', 'adaptive'];

describe('paramsForLevel / resolveSpatialFoldMatchDifficulty', () => {
  it('returns the canonical tuning for fixed levels as fresh copies', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      expect(paramsForLevel(level)).toEqual(DIFFICULTY_PARAMS[level]);
    }
    // Fresh objects, never the frozen default objects themselves.
    expect(paramsForLevel('easy')).not.toBe(DIFFICULTY_PARAMS.easy);
    expect(paramsForLevel('adaptive')).not.toBe(ADAPTIVE_PARAMS);
  });

  it('returns adaptive tuning for adaptive', () => {
    expect(paramsForLevel('adaptive')).toEqual(ADAPTIVE_PARAMS);
  });

  it('resolves SDK default challenge ratings per level', () => {
    expect(resolveSpatialFoldMatchDifficulty('easy').challengeRating).toBe(0.2);
    expect(resolveSpatialFoldMatchDifficulty('normal').challengeRating).toBe(0.5);
    expect(resolveSpatialFoldMatchDifficulty('hard').challengeRating).toBe(0.8);
    expect(resolveSpatialFoldMatchDifficulty('expert').challengeRating).toBe(0.95);
    expect(resolveSpatialFoldMatchDifficulty('adaptive').challengeRating).toBe(0.5);
  });

  it('carries the game tuning in the resolved parameters', () => {
    const profile = resolveSpatialFoldMatchDifficulty('normal');
    expect(profile.level).toBe('normal');
    expect(profile.parameters.gridRows).toBe(3);
    expect(profile.parameters.gridCols).toBe(4);
    expect(profile.parameters.rounds).toBe(6);
    // Folds are encoded as numeric flags.
    expect(profile.parameters.fold_foldV).toBe(1);
    expect(profile.parameters.fold_foldH).toBe(1);
    expect(profile.parameters.fold_foldVH).toBe(0);
  });
});

describe('spatialFoldMatchParamsFromProfile', () => {
  it('round-trips every resolved level', () => {
    for (const level of LEVELS) {
      const profile = resolveSpatialFoldMatchDifficulty(level);
      const params = spatialFoldMatchParamsFromProfile(profile);
      expect(params.gridRows).toBe(paramsForLevel(level).gridRows);
      expect(params.gridCols).toBe(paramsForLevel(level).gridCols);
      expect(params.rounds).toBe(paramsForLevel(level).rounds);
      expect(params.sourceRevealMs).toBe(paramsForLevel(level).sourceRevealMs);
      if (level === 'adaptive') {
        expect(params.minFilledCells).toBe(ADAPTIVE_PARAMS.minFilledCells);
        expect(params.maxOptionCount).toBe(ADAPTIVE_PARAMS.maxOptionCount);
      }
    }
  });

  it('reconstructs foldsAllowed from the encoded flags', () => {
    expect(spatialFoldMatchParamsFromProfile(resolveSpatialFoldMatchDifficulty('easy')).foldsAllowed).toEqual(['foldV']);
    expect(
      spatialFoldMatchParamsFromProfile(resolveSpatialFoldMatchDifficulty('expert')).foldsAllowed,
    ).toEqual(['foldV', 'foldH', 'foldVH']);
  });

  it('throws on missing/non-finite numeric parameters instead of guessing', () => {
    const profile = resolveSpatialFoldMatchDifficulty('hard');
    const broken = { ...profile, parameters: { gridRows: 4 } } as typeof profile;
    expect(() => spatialFoldMatchParamsFromProfile(broken)).toThrow();
  });
});

describe('nextFilledCells / nextOptionCount (adaptive escalation)', () => {
  it('fixed levels hold their canonical values', () => {
    expect(nextFilledCells(3, true, 'normal', DIFFICULTY_PARAMS.normal)).toBe(4);
    expect(nextFilledCells(3, false, 'normal', DIFFICULTY_PARAMS.normal)).toBe(4);
    expect(nextOptionCount(3, true, 'easy', DIFFICULTY_PARAMS.easy)).toBe(2);
  });

  it('adaptive escalates by one on a pass within bounds', () => {
    expect(nextFilledCells(3, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(4);
    expect(nextFilledCells(5, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(6); // capped at max
    expect(nextFilledCells(6, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(6);
    expect(nextOptionCount(2, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(3);
    expect(nextOptionCount(4, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(4); // capped at max
  });

  it('adaptive drops by one on a failure within bounds', () => {
    expect(nextFilledCells(5, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(4);
    expect(nextFilledCells(3, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(3); // floored at min
    expect(nextOptionCount(4, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(3);
    expect(nextOptionCount(2, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(2);
  });
});

describe('sessionChallengeRating', () => {
  it('returns the SDK default rating for fixed levels', () => {
    expect(sessionChallengeRating('hard', resolveSpatialFoldMatchDifficulty('hard'), 5)).toBe(0.8);
    expect(sessionChallengeRating('easy', resolveSpatialFoldMatchDifficulty('easy'), 6)).toBe(0.2);
  });

  it('maps the final filled-cell count into [0, 1] for adaptive', () => {
    const profile = resolveSpatialFoldMatchDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 3)).toBeCloseTo(0);
    expect(sessionChallengeRating('adaptive', profile, 6)).toBeCloseTo(1);
    expect(sessionChallengeRating('adaptive', profile, 4)).toBeCloseTo(1 / 3);
    // Out-of-range counts clamp.
    expect(sessionChallengeRating('adaptive', profile, 1)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 99)).toBe(1);
  });
});
