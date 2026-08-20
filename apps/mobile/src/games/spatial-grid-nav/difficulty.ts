/**
 * Named difficulty → concrete Spatial Grid Navigator parameters.
 *
 * `resolveDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from the grid side reached
 * (see `sessionChallengeRating`).
 */
import { resolveDifficulty, type DifficultyLevel, type DifficultyProfile } from '@/sdk';

import type { SpatialGridNavDifficultyParams } from './types';

/** Fixed-level tuning. */
export const DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, SpatialGridNavDifficultyParams>
> = {
  easy: {
    gridSide: 5,
    rounds: 6,
    minCommandCount: 3,
    maxCommandCount: 4,
    allowBack: false,
    options: 3,
    speedTargetMs: 6000,
    longThreshold: 4,
  },
  normal: {
    gridSide: 5,
    rounds: 7,
    minCommandCount: 4,
    maxCommandCount: 5,
    allowBack: true,
    options: 3,
    speedTargetMs: 5000,
    longThreshold: 5,
  },
  hard: {
    gridSide: 6,
    rounds: 8,
    minCommandCount: 5,
    maxCommandCount: 6,
    allowBack: true,
    options: 4,
    speedTargetMs: 4000,
    longThreshold: 6,
  },
  expert: {
    gridSide: 7,
    rounds: 9,
    minCommandCount: 6,
    maxCommandCount: 7,
    allowBack: true,
    options: 4,
    speedTargetMs: 3000,
    longThreshold: 7,
  },
};

/** Adaptive tuning: grid side and command counts move within bounds. */
export const ADAPTIVE_PARAMS: Readonly<SpatialGridNavDifficultyParams> = Object.freeze({
  gridSide: 5,
  rounds: 8,
  minCommandCount: 4,
  maxCommandCount: 6,
  allowBack: true,
  options: 3,
  speedTargetMs: 5000,
  longThreshold: 6,
  minGridSide: 5,
  maxGridSide: 7,
  minMaxCommand: 4,
  maxMaxCommand: 7,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function paramsForLevel(level: DifficultyLevel): SpatialGridNavDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveSpatialGridNavDifficulty(level: DifficultyLevel): DifficultyProfile {
  const params = paramsForLevel(level);
  const numericParams: Record<string, number> = {
    gridSide: params.gridSide,
    rounds: params.rounds,
    minCommandCount: params.minCommandCount,
    maxCommandCount: params.maxCommandCount,
    allowBack: params.allowBack ? 1 : 0,
    options: params.options,
    speedTargetMs: params.speedTargetMs,
    longThreshold: params.longThreshold,
  };
  if (params.minGridSide !== undefined) numericParams.minGridSide = params.minGridSide;
  if (params.maxGridSide !== undefined) numericParams.maxGridSide = params.maxGridSide;
  if (params.minMaxCommand !== undefined) numericParams.minMaxCommand = params.minMaxCommand;
  if (params.maxMaxCommand !== undefined) numericParams.maxMaxCommand = params.maxMaxCommand;
  return resolveDifficulty(level, numericParams);
}

/**
 * Recover validated parameters from a resolved profile. Throws when a required
 * parameter is missing/non-finite instead of silently producing a broken round.
 */
export function paramsFromProfile(profile: DifficultyProfile): SpatialGridNavDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`spatial-grid-nav: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const allowBackRaw = p.allowBack;
  const allowBack = typeof allowBackRaw === 'number' ? allowBackRaw !== 0 : Boolean(allowBackRaw);

  const base: SpatialGridNavDifficultyParams = {
    gridSide: requireNumber('gridSide'),
    rounds: requireNumber('rounds'),
    minCommandCount: requireNumber('minCommandCount'),
    maxCommandCount: requireNumber('maxCommandCount'),
    allowBack,
    options: requireNumber('options'),
    speedTargetMs: requireNumber('speedTargetMs'),
    longThreshold: requireNumber('longThreshold'),
  };

  const minGridSide = p.minGridSide;
  const maxGridSide = p.maxGridSide;
  const minMaxCommand = p.minMaxCommand;
  const maxMaxCommand = p.maxMaxCommand;
  return {
    ...base,
    ...(typeof minGridSide === 'number' ? { minGridSide } : {}),
    ...(typeof maxGridSide === 'number' ? { maxGridSide } : {}),
    ...(typeof minMaxCommand === 'number' ? { minMaxCommand } : {}),
    ...(typeof maxMaxCommand === 'number' ? { maxMaxCommand } : {}),
  };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the final grid side mapped linearly into [0, 1]
 * over [minGridSide, maxGridSide].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalGridSide: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = paramsFromProfile(profile);
  const min = params.minGridSide ?? params.gridSide;
  const max = params.maxGridSide ?? params.gridSide;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalGridSide - min) / span))
    : profile.challengeRating;
}
