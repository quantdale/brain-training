/**
 * Named difficulty → concrete Mental Rotation parameters.
 *
 * `resolveSpatialDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is the player's final difficulty position
 * (see `sessionChallengeRating`).
 *
 * Angle encoding: the set of allowed candidate-rotation angles is stored as a
 * bitmask over degrees — bit 0 = 0°, bit 1 = 90°, bit 2 = 180°, bit 3 = 270°
 * — because SDK difficulty parameters must be plain numbers. The perceived
 * load of a rotation grows with its angular disparity from the target (0° is
 * trivially identical, 90°/270° are moderate, 180° is the hardest), so harder
 * levels restrict to larger angles while adding blocks and cutting time.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { SpatialDifficultyParams, SpatialProfileParams } from './types';

/** Fixed-level tuning: blocks, allowed angles, per-round time budget, rounds. */
export const SPATIAL_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, SpatialDifficultyParams>
> = {
  // angleMask 3 = {0°, 90°}: trivial identity rounds mixed with a light rotation.
  easy: { blocks: 3, angleMask: 3, timeBudgetMs: 20_000, rounds: 4 },
  // angleMask 10 = {90°, 270°}: a real rotation every round, no freebies.
  normal: { blocks: 4, angleMask: 10, timeBudgetMs: 16_000, rounds: 5 },
  // angleMask 14 = {90°, 180°, 270°}: includes the hardest angle.
  hard: { blocks: 5, angleMask: 14, timeBudgetMs: 12_000, rounds: 6 },
  // angleMask 4 = {180°}: maximum angular disparity every round.
  expert: { blocks: 6, angleMask: 4, timeBudgetMs: 9_000, rounds: 7 },
};

/** Adaptive tuning: neutral 4-block/16s baseline; per-round values derive from the difficulty position. */
export const ADAPTIVE_PARAMS: Readonly<SpatialProfileParams> = Object.freeze({
  blocks: 4,
  angleMask: 14,
  timeBudgetMs: 16_000,
  rounds: 6,
  minBlocks: 3,
  maxBlocks: 6,
  minTimeBudgetMs: 9_000,
  maxTimeBudgetMs: 20_000,
});

/** How far the adaptive position moves per round (pass +step, fail −step). */
export const ADAPTIVE_POSITION_STEP = 0.25;

/**
 * Adaptive angle tiers, ordered by position. Lower positions offer the
 * moderate 90°/270° angles; the hardest band (position ≥ 2/3) forces 180°.
 */
export const ADAPTIVE_ANGLE_MASK_TIERS: ReadonlyArray<{
  readonly minPosition: number;
  readonly mask: number;
}> = Object.freeze([
  { minPosition: 0, mask: 10 }, // {90°, 270°}
  { minPosition: 1 / 3, mask: 14 }, // {90°, 180°, 270°}
  { minPosition: 2 / 3, mask: 4 }, // {180°}
]);

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function spatialParamsForLevel(level: DifficultyLevel): SpatialDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...SPATIAL_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Spatial tuning. */
export function resolveSpatialDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...spatialParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken round.
 */
export function spatialParamsFromProfile(profile: DifficultyProfile): SpatialProfileParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`spatial: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const bounds = (key: string): number | undefined => {
    const value = p[key];
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`spatial: difficulty profile parameter "${key}" must be numeric`);
    }
    return value;
  };
  const minBlocks = bounds('minBlocks');
  const maxBlocks = bounds('maxBlocks');
  const minTimeBudgetMs = bounds('minTimeBudgetMs');
  const maxTimeBudgetMs = bounds('maxTimeBudgetMs');
  return {
    blocks: requireNumber('blocks'),
    angleMask: requireNumber('angleMask'),
    timeBudgetMs: requireNumber('timeBudgetMs'),
    rounds: requireNumber('rounds'),
    ...(minBlocks !== undefined ? { minBlocks } : {}),
    ...(maxBlocks !== undefined ? { maxBlocks } : {}),
    ...(minTimeBudgetMs !== undefined ? { minTimeBudgetMs } : {}),
    ...(maxTimeBudgetMs !== undefined ? { maxTimeBudgetMs } : {}),
  };
}

/**
 * Allowed rotation angles of a mask, in canonical order [0°, 90°, 180°, 270°].
 * Masks are bitfields: bit 0 = 0°, bit 1 = 90°, bit 2 = 180°, bit 3 = 270°.
 */
export function anglesFromMask(mask: number): readonly (0 | 90 | 180 | 270)[] {
  if (!Number.isInteger(mask) || mask < 0 || mask > 0b1111) {
    throw new RangeError(`angleMask must be an integer in [0, 15], got ${mask}`);
  }
  const degrees = [0, 90, 180, 270] as const;
  return degrees.filter((_, bit) => ((mask >> bit) & 1) === 1);
}

/** Adaptive angle mask for a difficulty position (see `ADAPTIVE_ANGLE_MASK_TIERS`). */
export function angleMaskForPosition(position: number): number {
  let mask = ADAPTIVE_ANGLE_MASK_TIERS[0].mask;
  for (const tier of ADAPTIVE_ANGLE_MASK_TIERS) {
    if (position >= tier.minPosition) {
      mask = tier.mask;
    }
  }
  return mask;
}

/**
 * Per-round parameters for an adaptive difficulty position. Blocks ramp
 * linearly within [minBlocks, maxBlocks], the angle tier hardens with
 * position, and the time budget shrinks linearly within
 * [minTimeBudgetMs, maxTimeBudgetMs].
 */
export function paramsForPosition(
  position: number,
  params: SpatialProfileParams,
): SpatialDifficultyParams {
  const minBlocks = params.minBlocks ?? params.blocks;
  const maxBlocks = params.maxBlocks ?? params.blocks;
  const minTimeBudgetMs = params.minTimeBudgetMs ?? params.timeBudgetMs;
  const maxTimeBudgetMs = params.maxTimeBudgetMs ?? params.timeBudgetMs;
  return {
    blocks: minBlocks + Math.round(position * (maxBlocks - minBlocks)),
    angleMask: angleMaskForPosition(position),
    timeBudgetMs: Math.round(maxTimeBudgetMs - position * (maxTimeBudgetMs - minTimeBudgetMs)),
    rounds: params.rounds,
  };
}

/** Next adaptive difficulty position: ±`ADAPTIVE_POSITION_STEP` within [0, 1]. */
export function nextAdaptivePosition(prevPosition: number, passed: boolean): number {
  const step = passed ? ADAPTIVE_POSITION_STEP : -ADAPTIVE_POSITION_STEP;
  return Math.min(1, Math.max(0, prevPosition + step));
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final difficulty position in [0, 1].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalPosition: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  return Math.min(1, Math.max(0, finalPosition));
}
