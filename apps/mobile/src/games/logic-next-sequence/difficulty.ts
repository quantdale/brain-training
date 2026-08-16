/**
 * Named difficulty → concrete Next-in-Sequence parameters.
 *
 * `resolveLogicDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 *
 * The recipe pool is not expressible as a numeric parameter, so it is encoded
 * as `recipeTier` (0..3, see `RECIPE_TIERS` in generator.ts). Visible length
 * and reference timing are derived from the tier via `visibleLengthForTier` /
 * `referenceMsForTier` so every tier is internally consistent.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import { clamp01 } from './scoring';
import type { LogicDifficultyParams } from './types';

/** Highest recipe tier (RECIPE_TIERS.length - 1 in generator.ts). */
export const MAX_TIER = 3;

/** Visible terms per round for a tier: 3, 4, 5, 6. */
export function visibleLengthForTier(tier: number): number {
  return 3 + tier;
}

/** Reference response time (ms) per tier: 9000, 8000, 7000, 6000. */
export function referenceMsForTier(tier: number): number {
  return 9000 - tier * 1000;
}

/** Fixed-level tuning: rounds, recipe tier, value bounds, reference timing. */
export const LOGIC_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, LogicDifficultyParams>
> = {
  easy: {
    rounds: 4,
    recipeTier: 0,
    visibleLength: visibleLengthForTier(0),
    minValue: 0,
    maxValue: 100,
    referenceMs: referenceMsForTier(0),
  },
  normal: {
    rounds: 5,
    recipeTier: 1,
    visibleLength: visibleLengthForTier(1),
    minValue: 0,
    maxValue: 250,
    referenceMs: referenceMsForTier(1),
  },
  hard: {
    rounds: 6,
    recipeTier: 2,
    visibleLength: visibleLengthForTier(2),
    minValue: 0,
    maxValue: 500,
    referenceMs: referenceMsForTier(2),
  },
  expert: {
    rounds: 7,
    recipeTier: 3,
    visibleLength: visibleLengthForTier(3),
    minValue: 0,
    maxValue: 1000,
    referenceMs: referenceMsForTier(3),
  },
};

/** Adaptive tuning: normal-tier baseline; the tier moves within [0, 3]. */
export const ADAPTIVE_PARAMS: Readonly<LogicDifficultyParams> = Object.freeze({
  rounds: 6,
  recipeTier: 1,
  visibleLength: visibleLengthForTier(1),
  minValue: 0,
  maxValue: 500,
  referenceMs: referenceMsForTier(1),
  minTier: 0,
  maxTier: MAX_TIER,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function logicParamsForLevel(level: DifficultyLevel): LogicDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...LOGIC_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the tuning. */
export function resolveLogicDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...logicParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken puzzle.
 */
export function logicParamsFromProfile(profile: DifficultyProfile): LogicDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(
        `logic-next-sequence: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const minTier = p.minTier === undefined ? undefined : requireNumber('minTier');
  const maxTier = p.maxTier === undefined ? undefined : requireNumber('maxTier');
  return {
    rounds: requireNumber('rounds'),
    recipeTier: requireNumber('recipeTier'),
    visibleLength: requireNumber('visibleLength'),
    minValue: requireNumber('minValue'),
    maxValue: requireNumber('maxValue'),
    referenceMs: requireNumber('referenceMs'),
    ...(minTier !== undefined ? { minTier } : {}),
    ...(maxTier !== undefined ? { maxTier } : {}),
  };
}

/**
 * Recipe tier of the next adaptive round: ±1 within [minTier, maxTier].
 * Fixed levels ignore this (their tier is constant).
 */
export function nextAdaptiveTier(
  tier: number,
  passed: boolean,
  params: LogicDifficultyParams,
): number {
  const min = params.minTier ?? 0;
  const max = params.maxTier ?? MAX_TIER;
  return Math.min(max, Math.max(min, tier + (passed ? 1 : -1)));
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final recipe tier mapped linearly
 * into [0, 1] over [minTier, maxTier].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalTier: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = logicParamsFromProfile(profile);
  const min = params.minTier ?? 0;
  const max = params.maxTier ?? MAX_TIER;
  const span = max - min;
  return span > 0
    ? clamp01((finalTier - min) / span)
    : profile.challengeRating;
}
