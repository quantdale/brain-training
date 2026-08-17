/**
 * Named difficulty → concrete Odd One Out parameters.
 *
 * `resolveOddOneOutDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 *
 * Within a session, rounds escalate along a `step` index (0-based): the
 * deviation gets subtler and the display window shrinks, both clamped to the
 * level's bounds. Fixed levels step up on a pass and hold on a failure;
 * adaptive moves ±1 per outcome like the reference Memory game.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { OddOneOutDifficultyParams } from './types';

/**
 * Fixed-level tuning: grid size, rounds, and the escalation envelope
 * (subtlety/window bounds + per-step window shrink).
 */
export const ODD_ONE_OUT_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, OddOneOutDifficultyParams>
> = {
  easy: {
    gridSize: 9,
    rounds: 5,
    minSubtlety: 0,
    maxSubtlety: 1,
    minWindowMs: 12_000,
    maxWindowMs: 15_000,
    windowStepMs: 3_000,
  },
  normal: {
    gridSize: 9,
    rounds: 6,
    minSubtlety: 0,
    maxSubtlety: 2,
    minWindowMs: 9_000,
    maxWindowMs: 12_000,
    windowStepMs: 1_500,
  },
  hard: {
    gridSize: 16,
    rounds: 7,
    minSubtlety: 1,
    maxSubtlety: 3,
    minWindowMs: 8_000,
    maxWindowMs: 10_000,
    windowStepMs: 1_000,
  },
  expert: {
    gridSize: 16,
    rounds: 8,
    minSubtlety: 2,
    maxSubtlety: 3,
    minWindowMs: 7_000,
    maxWindowMs: 8_000,
    windowStepMs: 500,
  },
};

/** Adaptive tuning: 3×3 board, full subtlety range, window 12s → 7s over 8 rounds. */
export const ADAPTIVE_PARAMS: Readonly<OddOneOutDifficultyParams> = Object.freeze({
  gridSize: 9,
  rounds: 8,
  minSubtlety: 0,
  maxSubtlety: 3,
  minWindowMs: 7_000,
  maxWindowMs: 12_000,
  windowStepMs: 1_250,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function oddOneOutParamsForLevel(level: DifficultyLevel): OddOneOutDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...ODD_ONE_OUT_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Odd One Out tuning. */
export function resolveOddOneOutDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...oddOneOutParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function oddOneOutParamsFromProfile(profile: DifficultyProfile): OddOneOutDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`attention-odd-one-out: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  return {
    gridSize: requireNumber('gridSize'),
    rounds: requireNumber('rounds'),
    minSubtlety: requireNumber('minSubtlety'),
    maxSubtlety: requireNumber('maxSubtlety'),
    minWindowMs: requireNumber('minWindowMs'),
    maxWindowMs: requireNumber('maxWindowMs'),
    windowStepMs: requireNumber('windowStepMs'),
  };
}

/** Highest reachable escalation step for a profile (linear envelope). */
export function maxStepFor(profile: OddOneOutDifficultyParams): number {
  return profile.maxSubtlety - profile.minSubtlety;
}

export interface EffectiveRoundParams {
  readonly gridSize: number;
  readonly subtlety: number;
  readonly windowMs: number;
}

/**
 * Effective round parameters at an escalation step: the deviation subtlety
 * rises one level per step and the window shrinks by `windowStepMs` per step,
 * both clamped to the declared envelope (negative steps clamp to the step-0
 * params).
 */
export function effectiveParamsForStep(
  params: OddOneOutDifficultyParams,
  step: number,
): EffectiveRoundParams {
  const subtlety = Math.min(
    params.maxSubtlety,
    Math.max(params.minSubtlety, params.minSubtlety + step),
  );
  const windowMs = Math.max(
    params.minWindowMs,
    Math.min(params.maxWindowMs, params.maxWindowMs - step * params.windowStepMs),
  );
  return { gridSize: params.gridSize, subtlety, windowMs };
}

/**
 * Escalation step of the next round. Fixed levels step up on a pass (capped)
 * and hold on a failure (a hard level must not be undone by one mistake);
 * adaptive moves ±1 within [0, maxStep].
 */
export function escalateStep(
  prevStep: number,
  passed: boolean,
  level: DifficultyLevel,
  params: OddOneOutDifficultyParams,
): number {
  const maxStep = maxStepFor(params);
  if (level === 'adaptive') {
    return Math.min(maxStep, Math.max(0, prevStep + (passed ? 1 : -1)));
  }
  return passed ? Math.min(maxStep, prevStep + 1) : prevStep;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final escalation step mapped linearly
 * into [0, 1] over [0, maxStep].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  step: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = oddOneOutParamsFromProfile(profile);
  const maxStep = maxStepFor(params);
  return maxStep > 0 ? Math.min(1, Math.max(0, step / maxStep)) : profile.challengeRating;
}
