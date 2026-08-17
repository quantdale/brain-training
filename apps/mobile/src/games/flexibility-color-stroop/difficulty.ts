/**
 * Named difficulty → concrete Color Stroop parameters.
 *
 * `resolveColorStroopDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { ColorStroopDifficultyParams } from './types';

/** Fixed-level tuning: trials, incongruent ratio, time budget, flip frequency. */
export const COLOR_STROOP_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, ColorStroopDifficultyParams>
> = {
  easy: {
    trials: 10,
    incongruentRatio: 0.2,
    timeBudgetMs: 45_000,
    flipFrequency: 5,
    stimulusMs: 2000,
  },
  normal: {
    trials: 15,
    incongruentRatio: 0.4,
    timeBudgetMs: 40_000,
    flipFrequency: 4,
    stimulusMs: 1500,
  },
  hard: {
    trials: 20,
    incongruentRatio: 0.6,
    timeBudgetMs: 35_000,
    flipFrequency: 3,
    stimulusMs: 1200,
  },
  expert: {
    trials: 25,
    incongruentRatio: 0.8,
    timeBudgetMs: 30_000,
    flipFrequency: 2,
    stimulusMs: 1000,
  },
};

/** Adaptive tuning: starts at normal baseline; incongruent ratio adjusts. */
export const ADAPTIVE_PARAMS: Readonly<ColorStroopDifficultyParams> = Object.freeze({
  trials: 15,
  incongruentRatio: 0.4,
  timeBudgetMs: 40_000,
  flipFrequency: 4,
  stimulusMs: 1500,
  minIncongruentRatio: 0.2,
  maxIncongruentRatio: 0.8,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function colorStroopParamsForLevel(level: DifficultyLevel): ColorStroopDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...COLOR_STROOP_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Color Stroop tuning. */
export function resolveColorStroopDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, { ...colorStroopParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile.
 * Throws when a required parameter is missing/non-finite.
 */
export function colorStroopParamsFromProfile(
  profile: DifficultyProfile,
): ColorStroopDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`color-stroop: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const minIncongruentRatio =
    p.minIncongruentRatio === undefined ? undefined : requireNumber('minIncongruentRatio');
  const maxIncongruentRatio =
    p.maxIncongruentRatio === undefined ? undefined : requireNumber('maxIncongruentRatio');
  return {
    trials: requireNumber('trials'),
    incongruentRatio: requireNumber('incongruentRatio'),
    timeBudgetMs: requireNumber('timeBudgetMs'),
    flipFrequency: requireNumber('flipFrequency'),
    stimulusMs: requireNumber('stimulusMs'),
    ...(minIncongruentRatio !== undefined ? { minIncongruentRatio } : {}),
    ...(maxIncongruentRatio !== undefined ? { maxIncongruentRatio } : {}),
  };
}

/**
 * Adjust the incongruent ratio for adaptive difficulty based on recent accuracy.
 * Returns a ratio clamped to [min, max].
 */
export function adaptiveIncongruentRatio(
  currentRatio: number,
  recentAccuracy: number,
  params: ColorStroopDifficultyParams,
): number {
  const min = params.minIncongruentRatio ?? 0.2;
  const max = params.maxIncongruentRatio ?? 0.8;
  // If accuracy is high (>0.8), increase difficulty; if low (<0.5), decrease.
  const adjustment = (recentAccuracy - 0.65) * 0.3;
  return Math.min(max, Math.max(min, currentRatio + adjustment));
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default;
 * adaptive reports based on the final incongruent ratio.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalIncongruentRatio: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = colorStroopParamsFromProfile(profile);
  const min = params.minIncongruentRatio ?? 0.2;
  const max = params.maxIncongruentRatio ?? 0.8;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalIncongruentRatio - min) / span))
    : profile.challengeRating;
}