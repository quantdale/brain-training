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

import type { AdaptiveTuning, SpatialCoordinateTurnDifficultyParams } from './types';

/**
 * Brief-phase study budget used when a resolved profile predates the field
 * (persisted profiles from older versions lack `briefBudgetMs`). Generous so
 * the time-box never feels like the challenge itself.
 */
export const DEFAULT_BRIEF_BUDGET_MS = 12_000;

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
    briefBudgetMs: 12_000,
  },
  normal: {
    directions: 4,
    rounds: 10,
    minSteps: 3,
    maxSteps: 4,
    moveMax: 3,
    askPosition: false,
    speedTargetMs: 5000,
    briefBudgetMs: 12_000,
  },
  hard: {
    directions: 8,
    rounds: 10,
    minSteps: 3,
    maxSteps: 5,
    moveMax: 3,
    askPosition: false,
    speedTargetMs: 4000,
    briefBudgetMs: 15_000,
  },
  expert: {
    directions: 8,
    rounds: 12,
    minSteps: 4,
    maxSteps: 6,
    moveMax: 4,
    askPosition: true,
    speedTargetMs: 3500,
    briefBudgetMs: 20_000,
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
  // Adaptive shares the generous normal-level study window; it does not adapt.
  briefBudgetMs: 12_000,
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
    briefBudgetMs: params.briefBudgetMs,
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
    // Optional with a documented default: profiles persisted before the brief
    // phase was time-boxed do not carry briefBudgetMs, and throwing here would
    // break their reconstruction.
    briefBudgetMs: optionalNumber('briefBudgetMs') ?? DEFAULT_BRIEF_BUDGET_MS,
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
 * Adaptive tuning ladder (Campaign 027).
 *
 * An adaptive session starts every axis at its declared minimum and moves ONE
 * axis per round: a correct answer escalates the least-escalated axis, a wrong
 * answer de-escalates the most-escalated one. The reducer stores the applied
 * tuning in state so replay stays deterministic (`generateRound` is a pure
 * function of seed + params + round index) and the reached maximum feeds the
 * final challenge rating.
 */

/** The initial tuning for an adaptive session: every axis at its minimum. */
export function initialAdaptiveTuning(
  params: SpatialCoordinateTurnDifficultyParams,
): AdaptiveTuning {
  return {
    directions: (params.minDirections ?? params.directions) >= 8 ? 8 : 4,
    maxSteps: params.minMaxSteps ?? params.maxSteps,
    moveMax: params.minMoveMax ?? params.moveMax,
  };
}

/** Apply tuning onto the profile parameters (new object; never mutates). */
export function applyAdaptiveTuning(
  params: SpatialCoordinateTurnDifficultyParams,
  tuning: AdaptiveTuning,
): SpatialCoordinateTurnDifficultyParams {
  return { ...params, directions: tuning.directions, maxSteps: tuning.maxSteps, moveMax: tuning.moveMax };
}

/** Per-axis normalized positions within the declared adaptive bounds. */
function tuningProgress(
  params: SpatialCoordinateTurnDifficultyParams,
  tuning: AdaptiveTuning,
): { directions: number | null; maxSteps: number | null; moveMax: number | null } {
  const fraction = (value: number, min: number | undefined, max: number | undefined): number | null => {
    if (min === undefined || max === undefined || max <= min) return null;
    return Math.min(1, Math.max(0, (value - min) / (max - min)));
  };
  return {
    directions: fraction(tuning.directions, params.minDirections, params.maxDirections),
    maxSteps: fraction(tuning.maxSteps, params.minMaxSteps, params.maxMaxSteps),
    moveMax: fraction(tuning.moveMax, params.minMoveMax, params.maxMoveMax),
  };
}

/**
 * Gentle-first axis priority (lower = changed first). Command length moves
 * before movement distance before the 4→8 direction jump, so difficulty ramps
 * smoothly instead of flipping to diagonals on the first correct answer.
 */
const AXIS_RANK: Record<'directions' | 'maxSteps' | 'moveMax', number> = {
  maxSteps: 0,
  moveMax: 1,
  directions: 2,
};

/** The tuning that escalates the least-escalated axis by one notch. */
export function escalateAdaptiveTuning(
  params: SpatialCoordinateTurnDifficultyParams,
  current: AdaptiveTuning,
): AdaptiveTuning {
  const progress = tuningProgress(params, current);
  // Axes already at their maximum have progress 1 and are never picked; an
  // axis with a null fraction is not escalatable at all.
  const candidates: { key: 'directions' | 'maxSteps' | 'moveMax'; value: number }[] = [];
  if (progress.directions !== null && progress.directions < 1) candidates.push({ key: 'directions', value: progress.directions });
  if (progress.maxSteps !== null && progress.maxSteps < 1) candidates.push({ key: 'maxSteps', value: progress.maxSteps });
  if (progress.moveMax !== null && progress.moveMax < 1) candidates.push({ key: 'moveMax', value: progress.moveMax });
  if (candidates.length === 0) {
    return current;
  }
  candidates.sort((a, b) => a.value - b.value || AXIS_RANK[a.key] - AXIS_RANK[b.key]);
  const axis = candidates[0].key;
  if (axis === 'directions') {
    return { ...current, directions: 8 };
  }
  if (axis === 'maxSteps') {
    return { ...current, maxSteps: Math.min(current.maxSteps + 1, params.maxMaxSteps ?? current.maxSteps) };
  }
  return { ...current, moveMax: Math.min(current.moveMax + 1, params.maxMoveMax ?? current.moveMax) };
}

/** The tuning that de-escalates the most-escalated axis by one notch. */
export function deescalateAdaptiveTuning(
  params: SpatialCoordinateTurnDifficultyParams,
  current: AdaptiveTuning,
): AdaptiveTuning {
  const progress = tuningProgress(params, current);
  const candidates: { key: 'directions' | 'maxSteps' | 'moveMax'; value: number }[] = [];
  if (progress.directions !== null && progress.directions > 0) candidates.push({ key: 'directions', value: progress.directions });
  if (progress.maxSteps !== null && progress.maxSteps > 0) candidates.push({ key: 'maxSteps', value: progress.maxSteps });
  if (progress.moveMax !== null && progress.moveMax > 0) candidates.push({ key: 'moveMax', value: progress.moveMax });
  if (candidates.length === 0) {
    return current;
  }
  // Undo the highest axis first; ties fall back to the gentle-first order so a
  // wrong answer shortens the command before stripping diagonals.
  candidates.sort((a, b) => b.value - a.value || AXIS_RANK[a.key] - AXIS_RANK[b.key]);
  const axis = candidates[0].key;
  if (axis === 'directions') {
    return { ...current, directions: 4 };
  }
  if (axis === 'maxSteps') {
    return { ...current, maxSteps: Math.max(current.maxSteps - 1, params.minMaxSteps ?? current.maxSteps) };
  }
  return { ...current, moveMax: Math.max(current.moveMax - 1, params.minMoveMax ?? current.moveMax) };
}

/** Per-axis maximum of two tunings (the reached envelope). */
export function maxAdaptiveTuning(a: AdaptiveTuning, b: AdaptiveTuning): AdaptiveTuning {
  return {
    directions: a.directions >= b.directions ? a.directions : b.directions,
    maxSteps: Math.max(a.maxSteps, b.maxSteps),
    moveMax: Math.max(a.moveMax, b.moveMax),
  };
}

/**
 * Fraction of the declared adaptive ladder reached, averaged over the axes
 * that have a configured span. Null when no axis is configurable (callers then
 * keep the SDK baseline rating).
 */
export function adaptiveProgressFraction(
  params: SpatialCoordinateTurnDifficultyParams,
  reached: AdaptiveTuning,
): number | null {
  const progress = tuningProgress(params, reached);
  const values = [progress.directions, progress.maxSteps, progress.moveMax].filter(
    (value): value is number => value !== null,
  );
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating. Adaptive reports the fraction of the declared axes the player
 * actually reached, averaged over the configurable axes; a session that never
 * escalated (or has no bounds) reports the profile's baseline rating.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  reached?: AdaptiveTuning,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  if (reached === undefined) {
    return profile.challengeRating;
  }
  const params = spatialCoordinateTurnParamsFromProfile(profile);
  return adaptiveProgressFraction(params, reached) ?? profile.challengeRating;
}
