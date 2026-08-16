/**
 * Named difficulty → concrete Card Sort parameters.
 *
 * `resolveFlexibilityDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from the switch frequency the
 * player settled at (see `sessionChallengeRating`).
 *
 * Difficulty is driven by four dials: the size of the card alphabet (more
 * shapes/colors = more visual load), the rule-switch frequency (fewer rounds
 * per block = more frequent re-anchoring), the notice duration (shorter
 * notices punish slow rule re-anchoring), and the speed target.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { FlexibilityDifficultyParams } from './types';

/** Fixed-level tuning: alphabet size, rounds, switch frequency, notice, speed. */
export const FLEXIBILITY_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, FlexibilityDifficultyParams>
> = {
  easy: { numShapes: 3, numColors: 3, rounds: 8, switchEvery: 4, noticeMs: 2000, speedTargetMs: 6000 },
  normal: { numShapes: 3, numColors: 3, rounds: 10, switchEvery: 3, noticeMs: 1600, speedTargetMs: 5000 },
  hard: { numShapes: 4, numColors: 4, rounds: 12, switchEvery: 2, noticeMs: 1200, speedTargetMs: 4000 },
  expert: { numShapes: 4, numColors: 4, rounds: 12, switchEvery: 1, noticeMs: 900, speedTargetMs: 3000 },
};

/**
 * Adaptive tuning: neutral 3×3 alphabet; the switch frequency moves within
 * [1, 4] per block based on the previous block's accuracy.
 */
export const ADAPTIVE_PARAMS: Readonly<FlexibilityDifficultyParams> = Object.freeze({
  numShapes: 3,
  numColors: 3,
  rounds: 10,
  switchEvery: 2,
  noticeMs: 1200,
  speedTargetMs: 4000,
  minSwitchEvery: 1,
  maxSwitchEvery: 4,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function flexibilityParamsForLevel(level: DifficultyLevel): FlexibilityDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...FLEXIBILITY_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Card Sort tuning. */
export function resolveFlexibilityDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...flexibilityParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken round.
 */
export function flexibilityParamsFromProfile(
  profile: DifficultyProfile,
): FlexibilityDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`flexibility-card-sort: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const minSwitchEvery =
    p.minSwitchEvery === undefined ? undefined : requireNumber('minSwitchEvery');
  const maxSwitchEvery =
    p.maxSwitchEvery === undefined ? undefined : requireNumber('maxSwitchEvery');
  return {
    numShapes: requireNumber('numShapes'),
    numColors: requireNumber('numColors'),
    rounds: requireNumber('rounds'),
    switchEvery: requireNumber('switchEvery'),
    noticeMs: requireNumber('noticeMs'),
    speedTargetMs: requireNumber('speedTargetMs'),
    ...(minSwitchEvery !== undefined ? { minSwitchEvery } : {}),
    ...(maxSwitchEvery !== undefined ? { maxSwitchEvery } : {}),
  };
}

/**
 * Switch frequency of the next rule block. Fixed levels keep the constant
 * `switchEvery`; adaptive adjusts within [minSwitchEvery, maxSwitchEvery]
 * from the just-finished block's accuracy: a perfect block gets harder
 * (shorter block → more switches), a poor block (≤ 50% correct) gets easier.
 */
export function nextSwitchEvery(
  level: DifficultyLevel,
  prevSwitchEvery: number,
  blockAccuracy: number,
  params: FlexibilityDifficultyParams,
): number {
  if (level !== 'adaptive') {
    return prevSwitchEvery;
  }
  const min = params.minSwitchEvery ?? 1;
  const max = params.maxSwitchEvery ?? prevSwitchEvery;
  if (blockAccuracy >= 1) {
    return Math.max(min, prevSwitchEvery - 1);
  }
  if (blockAccuracy <= 0.5) {
    return Math.min(max, prevSwitchEvery + 1);
  }
  return prevSwitchEvery;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final switch frequency mapped
 * linearly into [0, 1] (fewer rounds per block = harder = higher rating).
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalSwitchEvery: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = flexibilityParamsFromProfile(profile);
  const min = params.minSwitchEvery ?? 1;
  const max = params.maxSwitchEvery ?? finalSwitchEvery;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, 1 - (finalSwitchEvery - min) / span))
    : profile.challengeRating;
}
