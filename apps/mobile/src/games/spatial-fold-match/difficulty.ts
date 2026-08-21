/**
 * Named difficulty → concrete Spatial Fold Match parameters.
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

import { ALL_FOLDS } from './types';
import type { FoldType, SpatialFoldMatchDifficultyParams } from './types';

/** Fixed-level tuning: grid size, filled cells, folds, options, rounds, reveal timing. */
export const DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, SpatialFoldMatchDifficultyParams>
> = {
  easy: {
    gridRows: 3,
    gridCols: 3,
    filledCells: 3,
    foldsAllowed: ['foldV'],
    optionCount: 2,
    rounds: 5,
    sourceRevealMs: 1500,
  },
  normal: {
    gridRows: 3,
    gridCols: 4,
    filledCells: 4,
    foldsAllowed: ['foldV', 'foldH'],
    optionCount: 3,
    rounds: 6,
    sourceRevealMs: 1300,
  },
  hard: {
    gridRows: 4,
    gridCols: 4,
    filledCells: 5,
    foldsAllowed: ['foldV', 'foldH'],
    optionCount: 3,
    rounds: 7,
    sourceRevealMs: 1100,
  },
  expert: {
    gridRows: 4,
    gridCols: 5,
    filledCells: 6,
    foldsAllowed: ['foldV', 'foldH', 'foldVH'],
    optionCount: 4,
    rounds: 7,
    sourceRevealMs: 1000,
  },
};

/** Adaptive tuning: 3×3 board; filled cells move within [3, 6], options within [2, 4]. */
export const ADAPTIVE_PARAMS: Readonly<SpatialFoldMatchDifficultyParams> = Object.freeze({
  gridRows: 3,
  gridCols: 3,
  filledCells: 3,
  foldsAllowed: ['foldV', 'foldH'] as readonly FoldType[],
  optionCount: 2,
  rounds: 6,
  sourceRevealMs: 1300,
  minFilledCells: 3,
  maxFilledCells: 6,
  minOptionCount: 2,
  maxOptionCount: 4,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function paramsForLevel(level: DifficultyLevel): SpatialFoldMatchDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveSpatialFoldMatchDifficulty(level: DifficultyLevel): DifficultyProfile {
  const params = paramsForLevel(level);
  const numericParams: Record<string, number> = {
    gridRows: params.gridRows,
    gridCols: params.gridCols,
    filledCells: params.filledCells,
    optionCount: params.optionCount,
    rounds: params.rounds,
    sourceRevealMs: params.sourceRevealMs,
  };
  // Encode foldsAllowed as numeric flags (1.0 = present, 0.0 = absent).
  for (const f of ALL_FOLDS) {
    numericParams[`fold_${f}`] = params.foldsAllowed.includes(f) ? 1 : 0;
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
export function spatialFoldMatchParamsFromProfile(
  profile: DifficultyProfile,
): SpatialFoldMatchDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`spatial-fold-match: difficulty profile is missing numeric parameter "${key}"`);
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

  const reconstructFolds = (): readonly FoldType[] => {
    const result: FoldType[] = [];
    for (const f of ALL_FOLDS) {
      const val = p[`fold_${f}`];
      if (typeof val === 'number' && val > 0) {
        result.push(f);
      }
    }
    return result.length > 0 ? result : ['foldV'];
  };

  return {
    gridRows: requireNumber('gridRows'),
    gridCols: requireNumber('gridCols'),
    filledCells: requireNumber('filledCells'),
    foldsAllowed: reconstructFolds(),
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
  params: SpatialFoldMatchDifficultyParams,
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
  params: SpatialFoldMatchDifficultyParams,
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
  const params = spatialFoldMatchParamsFromProfile(profile);
  const min = params.minFilledCells ?? params.filledCells;
  const max = params.maxFilledCells ?? params.filledCells;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalFilledCells - min) / span))
    : profile.challengeRating;
}
