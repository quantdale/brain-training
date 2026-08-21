/**
 * Named difficulty → concrete Order Sweep parameters.
 *
 * `resolveOrderSweepDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player pushed
 * the round window (see `sessionChallengeRating`).
 *
 * Difficulty direction: a SMALLER round window is HARDER, and so are more
 * tokens / a wider value range (wider range ⇒ bigger spread between
 * consecutive ordered values ⇒ harder visual search for the next minimum).
 * Fixed levels shrink the window by `windowStepMs` after a perfect round
 * (every token swept, zero wrong taps) and hold it otherwise; adaptive moves
 * ±step within [minWindowMs, maxWindowBoundMs].
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { OrderSweepDifficultyParams } from './types';

/** Fixed-level tuning: tokens, grid shape, value range, round window. */
export const ORDER_SWEEP_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, OrderSweepDifficultyParams>
> = {
  easy: { rounds: 4, count: 6, columns: 3, maxValue: 20, initialWindowMs: 9000, minWindowMs: 6000, windowStepMs: 750 },
  normal: { rounds: 5, count: 9, columns: 3, maxValue: 40, initialWindowMs: 8000, minWindowMs: 5000, windowStepMs: 750 },
  hard: { rounds: 5, count: 12, columns: 4, maxValue: 60, initialWindowMs: 7500, minWindowMs: 4500, windowStepMs: 750 },
  expert: { rounds: 6, count: 16, columns: 4, maxValue: 90, initialWindowMs: 7000, minWindowMs: 4000, windowStepMs: 750 },
};

/**
 * Adaptive tuning: window moves within [4000, 10000] ms around the neutral
 * initial value (8000 ms → rating 0.5); board size matches `normal`.
 */
export const ADAPTIVE_PARAMS: Readonly<OrderSweepDifficultyParams> = Object.freeze({
  rounds: 5,
  count: 9,
  columns: 3,
  maxValue: 40,
  initialWindowMs: 8000,
  minWindowMs: 4000,
  windowStepMs: 750,
  maxWindowBoundMs: 10000,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function orderSweepParamsForLevel(level: DifficultyLevel): OrderSweepDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...ORDER_SWEEP_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Order Sweep tuning. */
export function resolveOrderSweepDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...orderSweepParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function orderSweepParamsFromProfile(
  profile: DifficultyProfile,
): OrderSweepDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`speed-order-sweep: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const maxWindowBoundMs =
    p.maxWindowBoundMs === undefined ? undefined : requireNumber('maxWindowBoundMs');
  return {
    rounds: requireNumber('rounds'),
    count: requireNumber('count'),
    columns: requireNumber('columns'),
    maxValue: requireNumber('maxValue'),
    initialWindowMs: requireNumber('initialWindowMs'),
    minWindowMs: requireNumber('minWindowMs'),
    windowStepMs: requireNumber('windowStepMs'),
    ...(maxWindowBoundMs !== undefined ? { maxWindowBoundMs } : {}),
  };
}

/** Adaptive-only: the current window bounds. */
function adaptiveBounds(params: OrderSweepDifficultyParams): {
  minMs: number;
  maxMs: number;
} {
  return {
    minMs: params.minWindowMs,
    maxMs: params.maxWindowBoundMs ?? params.initialWindowMs,
  };
}

/**
 * Round window of the next round. Fixed levels shrink by `windowStepMs` after
 * a perfect round (floored at `minWindowMs`) and hold on anything else;
 * adaptive moves ±`windowStepMs` within [minWindowMs, maxWindowBoundMs].
 */
export function nextWindowMs(
  prevWindowMs: number,
  roundPerfect: boolean,
  level: DifficultyLevel,
  params: OrderSweepDifficultyParams,
): number {
  if (level === 'adaptive') {
    const { minMs, maxMs } = adaptiveBounds(params);
    const delta = roundPerfect ? -params.windowStepMs : params.windowStepMs;
    return Math.min(maxMs, Math.max(minMs, prevWindowMs + delta));
  }
  return roundPerfect
    ? Math.max(params.minWindowMs, prevWindowMs - params.windowStepMs)
    : prevWindowMs;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports how far the player pushed the round window, mapped
 * linearly into [0, 1] over [minWindowMs, maxWindowBoundMs] with the direction
 * inverted (smaller window = higher challenge). The neutral initial window
 * (8000 ms over [4000, 10000]) lands exactly on the 0.5 baseline.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalWindowMs: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = orderSweepParamsFromProfile(profile);
  const { minMs, maxMs } = adaptiveBounds(params);
  const span = maxMs - minMs;
  if (span <= 0) {
    return profile.challengeRating;
  }
  const clamped = Math.min(maxMs, Math.max(minMs, finalWindowMs));
  return Math.min(1, Math.max(0, 1 - (clamped - minMs) / span));
}
