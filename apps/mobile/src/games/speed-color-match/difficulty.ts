/**
 * Named difficulty → concrete Speed Color Match parameters.
 *
 * `resolveSpeedColorMatchDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how the incongruent ratio
 * adapted during play.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { SpeedColorMatchDifficultyParams } from './types';

/** Fixed-level tuning: trials, incongruent ratio, time budget, stimulus timeout. */
export const SPEED_COLOR_MATCH_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, SpeedColorMatchDifficultyParams>
> = {
  easy: { trials: 15, incongruentRatio: 0.2, timeBudgetMs: 45_000, stimulusTimeoutMs: 5_000 },
  normal: { trials: 20, incongruentRatio: 0.4, timeBudgetMs: 40_000, stimulusTimeoutMs: 4_000 },
  hard: { trials: 25, incongruentRatio: 0.6, timeBudgetMs: 35_000, stimulusTimeoutMs: 3_000 },
  expert: { trials: 30, incongruentRatio: 0.8, timeBudgetMs: 30_000, stimulusTimeoutMs: 2_500 },
};

/** Adaptive tuning: 20 trials, base 40% incongruent, ±adaptive. */
export const ADAPTIVE_PARAMS: Readonly<SpeedColorMatchDifficultyParams> = Object.freeze({
  trials: 20,
  incongruentRatio: 0.4,
  timeBudgetMs: 40_000,
  stimulusTimeoutMs: 4_000,
  minIncongruentRatio: 0.2,
  maxIncongruentRatio: 0.8,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function speedColorMatchParamsForLevel(
  level: DifficultyLevel,
): SpeedColorMatchDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...SPEED_COLOR_MATCH_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveSpeedColorMatchDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, { ...speedColorMatchParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite.
 */
export function speedColorMatchParamsFromProfile(
  profile: DifficultyProfile,
): SpeedColorMatchDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`speed-color-match: difficulty profile is missing numeric parameter "${key}"`);
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
    stimulusTimeoutMs: requireNumber('stimulusTimeoutMs'),
    ...(minIncongruentRatio !== undefined ? { minIncongruentRatio } : {}),
    ...(maxIncongruentRatio !== undefined ? { maxIncongruentRatio } : {}),
  };
}

/**
 * Adaptive incongruent ratio: moves ±0.1 per trial based on accuracy.
 * Clamped to [minIncongruentRatio, maxIncongruentRatio].
 */
export function nextIncongruentRatio(
  prevRatio: number,
  lastCorrect: boolean,
  params: SpeedColorMatchDifficultyParams,
): number {
  const min = params.minIncongruentRatio ?? params.incongruentRatio;
  const max = params.maxIncongruentRatio ?? params.incongruentRatio;
  const delta = lastCorrect ? 0.1 : -0.1;
  return Math.min(max, Math.max(min, prevRatio + delta));
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the final incongruent ratio mapped linearly into
 * [0, 1] over [minRatio, maxRatio].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalIncongruentRatio: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = speedColorMatchParamsFromProfile(profile);
  const min = params.minIncongruentRatio ?? params.incongruentRatio;
  const max = params.maxIncongruentRatio ?? params.incongruentRatio;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalIncongruentRatio - min) / span))
    : profile.challengeRating;
}
