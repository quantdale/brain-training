/**
 * Named difficulty → concrete Spatial Transform Match parameters.
 *
 * `resolveDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import { ALL_TRANSFORMS } from './types';
import type { SpatialTransformMatchDifficultyParams, TransformType } from './types';

/** Fixed-level tuning: grid size, filled cells, transforms, options, rounds, reveal timing. */
export const DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, SpatialTransformMatchDifficultyParams>
> = {
  easy: {
    gridSize: 9,
    filledCells: 3,
    allowedTransforms: ['rotate90'],
    optionCount: 2,
    rounds: 4,
    sourceRevealMs: 2000,
  },
  normal: {
    gridSize: 9,
    filledCells: 4,
    allowedTransforms: ['rotate90', 'rotate180'],
    optionCount: 3,
    rounds: 5,
    sourceRevealMs: 1500,
  },
  hard: {
    gridSize: 16,
    filledCells: 4,
    allowedTransforms: ['rotate90', 'rotate180', 'rotate270'],
    optionCount: 3,
    rounds: 6,
    sourceRevealMs: 1200,
  },
  expert: {
    gridSize: 16,
    filledCells: 5,
    allowedTransforms: ['rotate90', 'rotate180', 'rotate270', 'mirrorH', 'mirrorV'],
    optionCount: 4,
    rounds: 7,
    sourceRevealMs: 1000,
  },
};

/** Adaptive tuning: 3×3 board; filled cells move within [3, 6], options within [2, 4]. */
export const ADAPTIVE_PARAMS: Readonly<SpatialTransformMatchDifficultyParams> = Object.freeze({
  gridSize: 9,
  filledCells: 3,
  allowedTransforms: ['rotate90', 'rotate180', 'rotate270'] as readonly TransformType[],
  optionCount: 2,
  rounds: 6,
  sourceRevealMs: 1500,
  minFilledCells: 3,
  maxFilledCells: 6,
  minOptionCount: 2,
  maxOptionCount: 4,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function paramsForLevel(level: DifficultyLevel): SpatialTransformMatchDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveGameDifficulty(level: DifficultyLevel): DifficultyProfile {
  const params = paramsForLevel(level);
  // The SDK's resolveDifficulty expects Record<string, number>. Filter out
  // non-numeric fields (allowedTransforms) and attach transform flags as
  // numeric booleans so they round-trip through the profile.
  const numericParams: Record<string, number> = {
    gridSize: params.gridSize,
    filledCells: params.filledCells,
    optionCount: params.optionCount,
    rounds: params.rounds,
    sourceRevealMs: params.sourceRevealMs,
  };
  // Encode allowedTransforms as numeric flags (1.0 = present, 0.0 = absent).
  for (const t of ALL_TRANSFORMS) {
    numericParams[`transform_${t}`] = params.allowedTransforms.includes(t) ? 1 : 0;
  }
  if (params.minFilledCells !== undefined) numericParams.minFilledCells = params.minFilledCells;
  if (params.maxFilledCells !== undefined) numericParams.maxFilledCells = params.maxFilledCells;
  if (params.minOptionCount !== undefined) numericParams.minOptionCount = params.minOptionCount;
  if (params.maxOptionCount !== undefined) numericParams.maxOptionCount = params.maxOptionCount;
  return resolveDifficulty(level, numericParams);
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken round.
 */
export function paramsFromProfile(profile: DifficultyProfile): SpatialTransformMatchDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`spatial-transform-match: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const minFilledCells =
    p.minFilledCells === undefined ? undefined : requireNumber('minFilledCells');
  const maxFilledCells =
    p.maxFilledCells === undefined ? undefined : requireNumber('maxFilledCells');
  const minOptionCount =
    p.minOptionCount === undefined ? undefined : requireNumber('minOptionCount');
  const maxOptionCount =
    p.maxOptionCount === undefined ? undefined : requireNumber('maxOptionCount');

  // Reconstruct the allowedTransforms array from the parameters.
  // For fixed levels, it's stored as individual boolean flags (1.0/0.0).
  // For adaptive, we store the full set.
  const reconstructTransforms = (): readonly TransformType[] => {
    const allTransforms: TransformType[] = ['rotate90', 'rotate180', 'rotate270', 'mirrorH', 'mirrorV'];
    const result: TransformType[] = [];
    for (const t of allTransforms) {
      const val = p[`transform_${t}`];
      if (typeof val === 'number' && val > 0) {
        result.push(t);
      }
    }
    // Fallback: if no transform flags, use all transforms (shouldn't happen in practice)
    return result.length > 0 ? result : allTransforms;
  };

  return {
    gridSize: requireNumber('gridSize'),
    filledCells: requireNumber('filledCells'),
    allowedTransforms: reconstructTransforms(),
    optionCount: requireNumber('optionCount'),
    rounds: requireNumber('rounds'),
    sourceRevealMs: requireNumber('sourceRevealMs'),
    ...(minFilledCells !== undefined ? { minFilledCells } : {}),
    ...(maxFilledCells !== undefined ? { maxFilledCells } : {}),
    ...(minOptionCount !== undefined ? { minOptionCount } : {}),
    ...(maxOptionCount !== undefined ? { maxOptionCount } : {}),
  };
}

/**
 * Filled-cell count for the next round. Fixed levels always use the same
 * count; adaptive escalates by one on a pass and drops by one on a failure,
 * clamped to [minFilledCells, maxFilledCells].
 */
export function nextFilledCells(
  prevFilledCells: number,
  passed: boolean,
  level: DifficultyLevel,
  params: SpatialTransformMatchDifficultyParams,
): number {
  if (level === 'adaptive') {
    const min = params.minFilledCells ?? params.filledCells;
    const max = params.maxFilledCells ?? params.filledCells;
    return Math.min(max, Math.max(min, prevFilledCells + (passed ? 1 : -1)));
  }
  return params.filledCells;
}

/**
 * Option count for the next round. Fixed levels always use the same count;
 * adaptive escalates by one on a pass and drops by one on a failure,
 * clamped to [minOptionCount, maxOptionCount].
 */
export function nextOptionCount(
  prevOptionCount: number,
  passed: boolean,
  level: DifficultyLevel,
  params: SpatialTransformMatchDifficultyParams,
): number {
  if (level === 'adaptive') {
    const min = params.minOptionCount ?? params.optionCount;
    const max = params.maxOptionCount ?? params.optionCount;
    return Math.min(max, Math.max(min, prevOptionCount + (passed ? 1 : -1)));
  }
  return params.optionCount;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final filled-cells mapped linearly
 * into [0, 1] over [minFilledCells, maxFilledCells].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalFilledCells: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = paramsFromProfile(profile);
  const min = params.minFilledCells ?? params.filledCells;
  const max = params.maxFilledCells ?? params.filledCells;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalFilledCells - min) / span))
    : profile.challengeRating;
}
