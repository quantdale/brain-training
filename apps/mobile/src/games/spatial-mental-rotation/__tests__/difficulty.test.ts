// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_ANGLE_MASK_TIERS,
  ADAPTIVE_PARAMS,
  SPATIAL_DIFFICULTY_PARAMS,
  angleMaskForPosition,
  anglesFromMask,
  nextAdaptivePosition,
  paramsForPosition,
  resolveSpatialDifficulty,
  sessionChallengeRating,
  spatialParamsForLevel,
  spatialParamsFromProfile,
} from '../difficulty';
import type { SpatialDifficultyParams } from '../types';

describe('Mental Rotation difficulty parameter mapping', () => {
  it('maps each fixed level to concrete blocks/angle/time/rounds tuning', () => {
    expect(SPATIAL_DIFFICULTY_PARAMS.easy).toEqual({
      blocks: 3,
      angleMask: 3, // {0°, 90°}
      timeBudgetMs: 20_000,
      rounds: 4,
    });
    expect(SPATIAL_DIFFICULTY_PARAMS.normal).toEqual({
      blocks: 4,
      angleMask: 10, // {90°, 270°}
      timeBudgetMs: 16_000,
      rounds: 5,
    });
    expect(SPATIAL_DIFFICULTY_PARAMS.hard).toEqual({
      blocks: 5,
      angleMask: 14, // {90°, 180°, 270°}
      timeBudgetMs: 12_000,
      rounds: 6,
    });
    expect(SPATIAL_DIFFICULTY_PARAMS.expert).toEqual({
      blocks: 6,
      angleMask: 4, // {180°}
      timeBudgetMs: 9_000,
      rounds: 7,
    });
  });

  it('defines adaptive tuning with min/max bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      blocks: 4,
      angleMask: 14,
      timeBudgetMs: 16_000,
      rounds: 6,
      minBlocks: 3,
      maxBlocks: 6,
      minTimeBudgetMs: 9_000,
      maxTimeBudgetMs: 20_000,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveSpatialDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(spatialParamsForLevel(level));
    }
    const adaptive = resolveSpatialDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(ADAPTIVE_PARAMS);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = spatialParamsForLevel('easy');
    const b = spatialParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(SPATIAL_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = spatialParamsFromProfile(resolveSpatialDifficulty(level));
      expect(params).toEqual(spatialParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveSpatialDifficulty('normal');
    const { timeBudgetMs: _omitted, ...incomplete } = profile.parameters;
    expect(() => spatialParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /timeBudgetMs/,
    );
  });
});

describe('anglesFromMask (bitmask over degrees)', () => {
  it('decodes the documented masks', () => {
    expect(anglesFromMask(3)).toEqual([0, 90]);
    expect(anglesFromMask(10)).toEqual([90, 270]);
    expect(anglesFromMask(14)).toEqual([90, 180, 270]);
    expect(anglesFromMask(4)).toEqual([180]);
    expect(anglesFromMask(6)).toEqual([90, 180]);
    expect(anglesFromMask(8)).toEqual([270]);
    expect(anglesFromMask(0)).toEqual([]);
    expect(anglesFromMask(15)).toEqual([0, 90, 180, 270]);
  });

  it('rejects out-of-range masks', () => {
    expect(() => anglesFromMask(16)).toThrow(RangeError);
    expect(() => anglesFromMask(-1)).toThrow(RangeError);
    expect(() => anglesFromMask(3.5)).toThrow(RangeError);
  });
});

describe('adaptive position derivation', () => {
  it('picks the documented angle tiers', () => {
    expect(ADAPTIVE_ANGLE_MASK_TIERS.map((t) => t.mask)).toEqual([10, 14, 4]);
    expect(angleMaskForPosition(0)).toBe(10);
    expect(angleMaskForPosition(0.3)).toBe(10);
    expect(angleMaskForPosition(1 / 3)).toBe(14);
    expect(angleMaskForPosition(0.6)).toBe(14);
    expect(angleMaskForPosition(2 / 3)).toBe(4);
    expect(angleMaskForPosition(1)).toBe(4);
  });

  it('moves ±ADAPTIVE_POSITION_STEP within [0, 1]', () => {
    expect(nextAdaptivePosition(0.5, true)).toBe(0.75);
    expect(nextAdaptivePosition(0.5, false)).toBe(0.25);
    expect(nextAdaptivePosition(1, true)).toBe(1);
    expect(nextAdaptivePosition(0, false)).toBe(0);
    expect(nextAdaptivePosition(0.9, true)).toBe(1);
  });

  it('derives per-round params from the position', () => {
    const at0 = paramsForPosition(0, ADAPTIVE_PARAMS);
    expect(at0).toEqual({ blocks: 3, angleMask: 10, timeBudgetMs: 20_000, rounds: 6 });
    const at1 = paramsForPosition(1, ADAPTIVE_PARAMS);
    expect(at1).toEqual({ blocks: 6, angleMask: 4, timeBudgetMs: 9_000, rounds: 6 });
    const atHalf = paramsForPosition(0.5, ADAPTIVE_PARAMS);
    expect(atHalf).toEqual({
      blocks: 5, // 3 + round(0.5 * 3)
      angleMask: 14,
      timeBudgetMs: 14_500, // 20000 - 0.5 * 11000
      rounds: 6,
    });
  });

  it('uses adaptive bounds even when the profile carries none', () => {
    const bare: SpatialDifficultyParams = { blocks: 4, angleMask: 14, timeBudgetMs: 16_000, rounds: 6 };
    expect(paramsForPosition(1, bare)).toEqual({ blocks: 4, angleMask: 4, timeBudgetMs: 16_000, rounds: 6 });
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveSpatialDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 0.5)).toBe(profile.challengeRating);
  });

  it('reports the final adaptive position, clamped to [0, 1]', () => {
    const profile = resolveSpatialDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0.25)).toBe(0.25);
    expect(sessionChallengeRating('adaptive', profile, 1.5)).toBe(1);
    expect(sessionChallengeRating('adaptive', profile, -0.2)).toBe(0);
  });
});
