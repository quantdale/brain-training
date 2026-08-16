/**
 * Named difficulty → concrete Reaction Time parameters.
 *
 * `resolveSpeedDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from the player's achieved
 * median reaction time (see `sessionChallengeRating`).
 *
 * Difficulty direction: harder levels raise the round count (fatigue/endurance
 * under time pressure), shorten the wait window (a sooner/more variable GO
 * signal catches the player off guard), raise the reaction bar
 * (lower `targetMs`/`passMs`/`failMs`), and shrink the false-start budget.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { SpeedDifficultyParams } from './types';

/** Fixed-level tuning: rounds, wait window, false-start budget, reaction thresholds. */
export const SPEED_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, SpeedDifficultyParams>
> = {
  easy: {
    rounds: 8,
    minDelayMs: 1200,
    maxDelayMs: 3500,
    falseStartBudget: 2,
    targetMs: 450,
    passMs: 700,
    failMs: 900,
    timeoutMs: 2500,
  },
  normal: {
    rounds: 10,
    minDelayMs: 1000,
    maxDelayMs: 3000,
    falseStartBudget: 1,
    targetMs: 400,
    passMs: 600,
    failMs: 800,
    timeoutMs: 2200,
  },
  hard: {
    rounds: 12,
    minDelayMs: 800,
    maxDelayMs: 2500,
    falseStartBudget: 1,
    targetMs: 350,
    passMs: 550,
    failMs: 700,
    timeoutMs: 2000,
  },
  expert: {
    rounds: 15,
    minDelayMs: 700,
    maxDelayMs: 2000,
    falseStartBudget: 1,
    targetMs: 300,
    passMs: 500,
    failMs: 600,
    timeoutMs: 1800,
  },
};

/**
 * Adaptive tuning: neutral wait window; the per-round minimum delay moves
 * within [minDelayBoundMs, maxDelayBoundMs] — fast rounds widen the window
 * (harder: less preparation time), slow rounds narrow it (easier).
 */
export const ADAPTIVE_PARAMS: Readonly<SpeedDifficultyParams> = Object.freeze({
  rounds: 10,
  minDelayMs: 1000,
  maxDelayMs: 2500,
  falseStartBudget: 1,
  targetMs: 400,
  passMs: 600,
  failMs: 800,
  timeoutMs: 2200,
  minDelayBoundMs: 600,
  maxDelayBoundMs: 2200,
  delayStepMs: 150,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function speedParamsForLevel(level: DifficultyLevel): SpeedDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...SPEED_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Speed tuning. */
export function resolveSpeedDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...speedParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken session.
 */
export function speedParamsFromProfile(profile: DifficultyProfile): SpeedDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`speed-reaction-time: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const minDelayBoundMs =
    p.minDelayBoundMs === undefined ? undefined : requireNumber('minDelayBoundMs');
  const maxDelayBoundMs =
    p.maxDelayBoundMs === undefined ? undefined : requireNumber('maxDelayBoundMs');
  const delayStepMs = p.delayStepMs === undefined ? undefined : requireNumber('delayStepMs');
  return {
    rounds: requireNumber('rounds'),
    minDelayMs: requireNumber('minDelayMs'),
    maxDelayMs: requireNumber('maxDelayMs'),
    falseStartBudget: requireNumber('falseStartBudget'),
    targetMs: requireNumber('targetMs'),
    passMs: requireNumber('passMs'),
    failMs: requireNumber('failMs'),
    timeoutMs: requireNumber('timeoutMs'),
    ...(minDelayBoundMs !== undefined ? { minDelayBoundMs } : {}),
    ...(maxDelayBoundMs !== undefined ? { maxDelayBoundMs } : {}),
    ...(delayStepMs !== undefined ? { delayStepMs } : {}),
  };
}

/**
 * Minimum wait used for the next round. Fixed levels keep their constant
 * `minDelayMs`; adaptive moves ±`delayStepMs` within
 * [minDelayBoundMs, maxDelayBoundMs] — a passed (fast) round widens the wait
 * window by lowering the floor, a failed round narrows it.
 */
export function nextDelayMinMs(
  prevMinDelayMs: number,
  passed: boolean,
  level: DifficultyLevel,
  params: SpeedDifficultyParams,
): number {
  if (level !== 'adaptive') {
    return params.minDelayMs;
  }
  const min = params.minDelayBoundMs ?? params.minDelayMs;
  const max = params.maxDelayBoundMs ?? params.maxDelayMs;
  const step = params.delayStepMs ?? 100;
  return Math.min(max, Math.max(min, prevMinDelayMs + (passed ? -step : step)));
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive maps the player's median reaction time linearly into [0, 1]
 * over [targetMs, failMs] (a faster median earns a higher rating). A session
 * with no valid reaction rates 0.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  medianReactionMs: number | null,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = speedParamsFromProfile(profile);
  if (medianReactionMs === null) {
    return 0;
  }
  const span = params.failMs - params.targetMs;
  if (span <= 0) {
    return medianReactionMs <= params.targetMs ? 1 : 0;
  }
  return Math.min(1, Math.max(0, (params.failMs - medianReactionMs) / span));
}
