/**
 * Named difficulty → concrete Order Path parameters.
 *
 * `resolveOrderPathDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { OrderPathDifficultyParams } from './types';

/** Fixed-level tuning: item count, edge density, rounds, time budget. */
export const ORDER_PATH_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, OrderPathDifficultyParams>
> = {
  easy: { itemCount: 4, edgeDensityTarget: 1.0, rounds: 4, roundTimeMs: 30_000 },
  normal: { itemCount: 5, edgeDensityTarget: 0.7, rounds: 5, roundTimeMs: 25_000 },
  hard: { itemCount: 5, edgeDensityTarget: 0.45, rounds: 6, roundTimeMs: 20_000 },
  expert: { itemCount: 6, edgeDensityTarget: 0.3, rounds: 7, roundTimeMs: 15_000 },
};

/** Adaptive tuning: neutral range; item count and density move within bounds. */
export const ADAPTIVE_PARAMS: Readonly<OrderPathDifficultyParams> = Object.freeze({
  itemCount: 5,
  edgeDensityTarget: 0.6,
  rounds: 6,
  roundTimeMs: 20_000,
  minItemCount: 4,
  maxItemCount: 6,
  minEdgeDensity: 0.3,
  maxEdgeDensity: 1.0,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function orderPathParamsForLevel(level: DifficultyLevel): OrderPathDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...ORDER_PATH_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveOrderPathDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, { ...orderPathParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile. Throws when a required
 * parameter is missing/non-finite or an adaptive bound is nonsensical.
 */
export function orderPathParamsFromProfile(
  profile: DifficultyProfile,
): OrderPathDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`order-path: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const itemCount = requireNumber('itemCount');
  if (!Number.isInteger(itemCount) || itemCount < 2) {
    throw new Error(`order-path: difficulty profile has invalid itemCount ${itemCount}`);
  }
  const edgeDensityTarget = requireNumber('edgeDensityTarget');
  if (edgeDensityTarget <= 0 || edgeDensityTarget > 1) {
    throw new Error(`order-path: difficulty profile has invalid edgeDensityTarget ${edgeDensityTarget}`);
  }
  const rounds = requireNumber('rounds');
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new Error(`order-path: difficulty profile has invalid rounds ${rounds}`);
  }
  const roundTimeMs = requireNumber('roundTimeMs');
  if (roundTimeMs <= 0) {
    throw new Error(`order-path: difficulty profile has invalid roundTimeMs ${roundTimeMs}`);
  }
  const optional = (key: string): number | undefined => {
    const value = p[key];
    if (value === undefined) return undefined;
    const number = requireNumber(key);
    if (number <= 0) throw new Error(`order-path: difficulty profile has invalid ${key} ${number}`);
    return number;
  };
  const minItemCount = optional('minItemCount');
  const maxItemCount = optional('maxItemCount');
  const minEdgeDensity = optional('minEdgeDensity');
  const maxEdgeDensity = optional('maxEdgeDensity');
  if (minItemCount !== undefined && maxItemCount !== undefined && minItemCount > maxItemCount) {
    throw new Error('order-path: difficulty profile has minItemCount > maxItemCount');
  }
  if (minEdgeDensity !== undefined && maxEdgeDensity !== undefined && minEdgeDensity > maxEdgeDensity) {
    throw new Error('order-path: difficulty profile has minEdgeDensity > maxEdgeDensity');
  }
  return {
    itemCount,
    edgeDensityTarget,
    rounds,
    roundTimeMs,
    ...(minItemCount !== undefined ? { minItemCount } : {}),
    ...(maxItemCount !== undefined ? { maxItemCount } : {}),
    ...(minEdgeDensity !== undefined ? { minEdgeDensity } : {}),
    ...(maxEdgeDensity !== undefined ? { maxEdgeDensity } : {}),
  };
}

/**
 * Adaptive escalation: compute the next round's params based on performance.
 * Returns the same params for fixed levels. On pass: harder (more items up to
 * max, lower edge density down to min); on fail: easier.
 */
export function adaptiveRoundParams(
  level: DifficultyLevel,
  params: OrderPathDifficultyParams,
  passed: boolean,
): { itemCount: number; edgeDensityTarget: number } {
  if (level !== 'adaptive') {
    return { itemCount: params.itemCount, edgeDensityTarget: params.edgeDensityTarget };
  }
  const minItems = params.minItemCount ?? 4;
  const maxItems = params.maxItemCount ?? 6;
  const minDensity = params.minEdgeDensity ?? 0.3;
  const maxDensity = params.maxEdgeDensity ?? 1.0;
  return {
    itemCount: Math.min(maxItems, Math.max(minItems, params.itemCount + (passed ? 1 : -1))),
    edgeDensityTarget: clamp(
      params.edgeDensityTarget + (passed ? -0.1 : 0.1),
      minDensity,
      maxDensity,
    ),
  };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports a blend of item count and sparsity mapped into
 * [0, 1].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalItemCount: number,
  finalEdgeDensity: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = orderPathParamsFromProfile(profile);
  const minItems = params.minItemCount ?? 4;
  const maxItems = params.maxItemCount ?? 6;
  const minDensity = params.minEdgeDensity ?? 0.3;
  const maxDensity = params.maxEdgeDensity ?? 1.0;
  const itemPart = maxItems > minItems ? (finalItemCount - minItems) / (maxItems - minItems) : 0;
  const densityPart = maxDensity > minDensity ? (maxDensity - finalEdgeDensity) / (maxDensity - minDensity) : 0;
  return clamp((itemPart + densityPart) / 2, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
