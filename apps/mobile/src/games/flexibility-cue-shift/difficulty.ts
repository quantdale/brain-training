/**
 * Named difficulty → concrete Cue Shift parameters.
 *
 * `resolveFlexibilityCueDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from the per-trial switch rate
 * the player settled at (see `sessionChallengeRating`).
 *
 * Difficulty is driven by three dials: the size of the stimulus alphabet
 * (more shapes/colors/numbers = more visual load), the per-trial switch rate
 * (higher = more frequent re-anchoring — the flexibility demand), and the
 * speed target.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { FlexibilityCueDifficultyParams, RuleId } from './types';
import { RULES } from './types';

/** Fixed-level tuning: alphabet size, rounds, switch rate, speed. */
export const FLEXIBILITY_CUE_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, FlexibilityCueDifficultyParams>
> = {
  easy: { numShapes: 3, numColors: 3, numNumbers: 3, rounds: 8, switchRate: 0.4, speedTargetMs: 6000 },
  normal: { numShapes: 3, numColors: 3, numNumbers: 4, rounds: 10, switchRate: 0.5, speedTargetMs: 5000 },
  hard: { numShapes: 4, numColors: 4, numNumbers: 5, rounds: 12, switchRate: 0.6, speedTargetMs: 4000 },
  expert: { numShapes: 4, numColors: 4, numNumbers: 6, rounds: 12, switchRate: 0.75, speedTargetMs: 3000 },
};

/**
 * Adaptive tuning: neutral 3×3×4 alphabet; the per-trial switch rate stays
 * constant for the session and the challenge rating is mapped from it at the
 * end (no mid-session change needed).
 */
export const ADAPTIVE_PARAMS: Readonly<FlexibilityCueDifficultyParams> = Object.freeze({
  numShapes: 3,
  numColors: 3,
  numNumbers: 4,
  rounds: 10,
  switchRate: 0.5,
  speedTargetMs: 4000,
  minSwitchRate: 0.3,
  maxSwitchRate: 0.8,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function flexibilityCueParamsForLevel(level: DifficultyLevel): FlexibilityCueDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...FLEXIBILITY_CUE_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Cue Shift tuning. */
export function resolveFlexibilityCueDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...flexibilityCueParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken round.
 */
export function flexibilityCueParamsFromProfile(
  profile: DifficultyProfile,
): FlexibilityCueDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`flexibility-cue-shift: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const minSwitchRate =
    p.minSwitchRate === undefined ? undefined : requireNumber('minSwitchRate');
  const maxSwitchRate =
    p.maxSwitchRate === undefined ? undefined : requireNumber('maxSwitchRate');
  return {
    numShapes: requireNumber('numShapes'),
    numColors: requireNumber('numColors'),
    numNumbers: requireNumber('numNumbers'),
    rounds: requireNumber('rounds'),
    switchRate: requireNumber('switchRate'),
    speedTargetMs: requireNumber('speedTargetMs'),
    ...(minSwitchRate !== undefined ? { minSwitchRate } : {}),
    ...(maxSwitchRate !== undefined ? { maxSwitchRate } : {}),
  };
}

/**
 * Choose the next trial's rule. With probability `switchRate` the rule switches
 * to one of the OTHER two rules (chosen uniformly); otherwise it stays the
 * same. Deterministic given the seeded `rng`.
 */
export function nextRule(rng: { next(): number; pick<T>(items: readonly T[]): T }, prevRule: RuleId, switchRate: number): RuleId {
  const others: readonly RuleId[] = RULES.filter((r) => r !== prevRule);
  if (rng.next() < switchRate) {
    return rng.pick(others);
  }
  return prevRule;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's constant switch rate mapped linearly
 * into [0, 1] (higher switch rate = harder = higher rating).
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalSwitchRate: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = flexibilityCueParamsFromProfile(profile);
  const min = params.minSwitchRate ?? 0;
  const max = params.maxSwitchRate ?? finalSwitchRate;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalSwitchRate - min) / span))
    : profile.challengeRating;
}
