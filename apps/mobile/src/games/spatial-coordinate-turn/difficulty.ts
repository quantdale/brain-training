/**
 * Named difficulty → concrete Spatial Coordinate Turn parameters.
 *
 * `resolveDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from the direction count /
 * step size reached (see `sessionChallengeRating`).
 */
import { resolveDifficulty, type DifficultyLevel, type DifficultyProfile } from '@/sdk';

import type { SpatialCoordinateTurnDifficultyParams } from './types';

/** Fixed-level tuning (see the game-design contract). */
export const DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, SpatialCoordinateTurnDifficultyParams>
> = {
  easy: {
    directions: 4,
    rounds: 8,
    minSteps: 2,
    maxSteps: 3,
    moveMax: 2,
    askPosition: false,
    speedTargetMs: 6000,
  },
  normal: {
    directions: 4,
    rounds: 10,
    minSteps: 3,
    maxSteps: 4,
    moveMax: 3,
    askPosition: false,
    speedTargetMs: 5000,
  },
  hard: {
    directions: 8,
    rounds: 10,
    minSteps: 3,
    maxSteps: 5,
    moveMax: 3,
    askPosition: false,
    speedTargetMs: 4000,
  },
  expert: {
    directions: 8,
    rounds: 12,
    minSteps: 4,
    maxSteps: 6,
    moveMax: 4,
    askPosition: true,
    speedTargetMs: 3500,
  },
};

/** Adaptive tuning: direction count and command sizes move within bounds. */
export const ADAPTIVE_PARAMS: Readonly<SpatialCoordinateTurnDifficultyParams> = Object.freeze({
  directions: 4,
  rounds: 10,
  minSteps: 3,
  maxSteps: 5,
  moveMax: 3,
  askPosition: false,
  speedTargetMs: 5000,
  minDirections: 4,
  maxDirections: 8,
  minMaxSteps: 3,
  maxMaxSteps: 6,
  minMoveMax: 2,
  maxMoveMax: 4,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function paramsForLevel(level: DifficultyLevel): SpatialCoordinateTurnDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveSpatialCoordinateTurnDifficulty(level: DifficultyLevel): DifficultyProfile {
  const params = paramsForLevel(level);
  const numericParams: Record<string, number> = {
    directions: params.directions,
    rounds: params.rounds,
    minSteps: params.minSteps,
    maxSteps: params.maxSteps,
    moveMax: params.moveMax,
    askPosition: params.askPosition ? 1 : 0,
    speedTargetMs: params.speedTargetMs,
  };
  if (params.minDirections !== undefined) numericParams.minDirections = params.minDirections;
  if (params.maxDirections !== undefined) numericParams.maxDirections = params.maxDirections;
  if (params.minMaxSteps !== undefined) numericParams.minMaxSteps = params.minMaxSteps;
  if (params.maxMaxSteps !== undefined) numericParams.maxMaxSteps = params.maxMaxSteps;
  if (params.minMoveMax !== undefined) numericParams.minMoveMax = params.minMoveMax;
  if (params.maxMoveMax !== undefined) numericParams.maxMoveMax = params.maxMoveMax;
  return resolveDifficulty(level, numericParams);
}

/**
 * Recover validated parameters from a resolved profile. Throws when a required
 * parameter is missing/non-finite or the direction count is not 4 or 8 instead
 * of silently producing a broken round.
 */
export function spatialCoordinateTurnParamsFromProfile(
  profile: DifficultyProfile,
): SpatialCoordinateTurnDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`spatial-coordinate-turn: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const directionsRaw = p.directions;
  if (typeof directionsRaw !== 'number' || (directionsRaw !== 4 && directionsRaw !== 8)) {
    throw new Error(
      `spatial-coordinate-turn: difficulty profile has invalid directions "${String(directionsRaw)}" (expected 4 or 8)`,
    );
  }
  const askPositionRaw = p.askPosition;
  const askPosition = typeof askPositionRaw === 'number' ? askPositionRaw !== 0 : Boolean(askPositionRaw);
  const optionalNumber = (key: string): number | undefined => {
    const value = p[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  };

  const params: SpatialCoordinateTurnDifficultyParams = {
    directions: directionsRaw === 8 ? 8 : 4,
    rounds: requireNumber('rounds'),
    minSteps: requireNumber('minSteps'),
    maxSteps: requireNumber('maxSteps'),
    moveMax: requireNumber('moveMax'),
    askPosition,
    speedTargetMs: requireNumber('speedTargetMs'),
    // Adaptive-only bounds travel with the profile; recover them when present
    // so `sessionChallengeRating` can map the reached direction count into
    // [0, 1]. Absent for fixed levels.
    ...(optionalNumber('minDirections') !== undefined && { minDirections: optionalNumber('minDirections') }),
    ...(optionalNumber('maxDirections') !== undefined && { maxDirections: optionalNumber('maxDirections') }),
    ...(optionalNumber('minMaxSteps') !== undefined && { minMaxSteps: optionalNumber('minMaxSteps') }),
    ...(optionalNumber('maxMaxSteps') !== undefined && { maxMaxSteps: optionalNumber('maxMaxSteps') }),
    ...(optionalNumber('minMoveMax') !== undefined && { minMoveMax: optionalNumber('minMoveMax') }),
    ...(optionalNumber('maxMoveMax') !== undefined && { maxMoveMax: optionalNumber('maxMoveMax') }),
  };

  return params;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports a rating mapped from the final direction count (or
 * max step size) into [0, 1] over the configured bounds.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalDirections?: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = spatialCoordinateTurnParamsFromProfile(profile);
  const minDir = params.minDirections ?? params.directions;
  const maxDir = params.maxDirections ?? params.directions;
  const dir = finalDirections ?? params.directions;
  const dirSpan = maxDir - minDir;
  if (dirSpan > 0) {
    return Math.min(1, Math.max(0, (dir - minDir) / dirSpan));
  }
  // Fall back to mapping the max step size.
  const minSteps = params.minMaxSteps ?? params.maxSteps;
  const maxSteps = params.maxMaxSteps ?? params.maxSteps;
  const stepSpan = maxSteps - minSteps;
  return stepSpan > 0
    ? Math.min(1, Math.max(0, (params.maxSteps - minSteps) / stepSpan))
    : profile.challengeRating;
}
