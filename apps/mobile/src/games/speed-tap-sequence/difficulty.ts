/**
 * Named difficulty → concrete Tap Rush parameters.
 *
 * `resolveTapRushDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how fast the player
 * escalated the response window (see `sessionChallengeRating`).
 *
 * Difficulty direction: a SMALLER response window is HARDER. Fixed levels
 * shrink the window by `windowStepMs` after a perfect round and hold it after
 * a failed one; adaptive moves ±step within [minWindowMs, maxWindowBoundMs].
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { TapRushDifficultyParams } from './types';

/** Fixed-level tuning: targets per round, rounds, response window, target size. */
export const TAP_RUSH_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, TapRushDifficultyParams>
> = {
  easy: { count: 8, rounds: 3, initialWindowMs: 1400, minWindowMs: 900, windowStepMs: 100, targetRadius: 0.09 },
  normal: { count: 10, rounds: 4, initialWindowMs: 1100, minWindowMs: 700, windowStepMs: 100, targetRadius: 0.075 },
  hard: { count: 12, rounds: 5, initialWindowMs: 850, minWindowMs: 550, windowStepMs: 100, targetRadius: 0.06 },
  expert: { count: 14, rounds: 5, initialWindowMs: 700, minWindowMs: 450, windowStepMs: 100, targetRadius: 0.05 },
};

/**
 * Adaptive tuning: window moves within [600, 1600] ms around the neutral
 * initial value (1100 ms → rating 0.5); targets/rounds match `normal`.
 */
export const ADAPTIVE_PARAMS: Readonly<TapRushDifficultyParams> = Object.freeze({
  count: 10,
  rounds: 4,
  initialWindowMs: 1100,
  minWindowMs: 600,
  windowStepMs: 100,
  targetRadius: 0.075,
  maxWindowBoundMs: 1600,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function tapRushParamsForLevel(level: DifficultyLevel): TapRushDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...TAP_RUSH_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Tap Rush tuning. */
export function resolveTapRushDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...tapRushParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken field.
 */
export function tapRushParamsFromProfile(
  profile: DifficultyProfile,
): TapRushDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`speed-tap-rush: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const maxWindowBoundMs =
    p.maxWindowBoundMs === undefined ? undefined : requireNumber('maxWindowBoundMs');
  return {
    count: requireNumber('count'),
    rounds: requireNumber('rounds'),
    initialWindowMs: requireNumber('initialWindowMs'),
    minWindowMs: requireNumber('minWindowMs'),
    windowStepMs: requireNumber('windowStepMs'),
    targetRadius: requireNumber('targetRadius'),
    ...(maxWindowBoundMs !== undefined ? { maxWindowBoundMs } : {}),
  };
}

/** Adaptive-only: the current window bounds. */
function adaptiveBounds(params: TapRushDifficultyParams): {
  minMs: number;
  maxMs: number;
} {
  return {
    minMs: params.minWindowMs,
    maxMs: params.maxWindowBoundMs ?? params.initialWindowMs,
  };
}

/**
 * Response window of the next round. Fixed levels shrink by `windowStepMs`
 * after a perfect round (floored at `minWindowMs`) and hold on a failure;
 * adaptive moves ±`windowStepMs` within [minWindowMs, maxWindowBoundMs].
 */
export function nextWindowMs(
  prevWindowMs: number,
  roundPassed: boolean,
  level: DifficultyLevel,
  params: TapRushDifficultyParams,
): number {
  if (level === 'adaptive') {
    const { minMs, maxMs } = adaptiveBounds(params);
    const delta = roundPassed ? -params.windowStepMs : params.windowStepMs;
    return Math.min(maxMs, Math.max(minMs, prevWindowMs + delta));
  }
  return roundPassed ? Math.max(params.minWindowMs, prevWindowMs - params.windowStepMs) : prevWindowMs;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports how far the player pushed the response window,
 * mapped linearly into [0, 1] over [minWindowMs, maxWindowBoundMs] with the
 * direction inverted (smaller window = higher challenge). The neutral initial
 * window (1100 ms over [600, 1600]) lands exactly on the 0.5 baseline.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalWindowMs: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = tapRushParamsFromProfile(profile);
  const { minMs, maxMs } = adaptiveBounds(params);
  const span = maxMs - minMs;
  if (span <= 0) {
    return profile.challengeRating;
  }
  const clamped = Math.min(maxMs, Math.max(minMs, finalWindowMs));
  return Math.min(1, Math.max(0, 1 - (clamped - minMs) / span));
}
