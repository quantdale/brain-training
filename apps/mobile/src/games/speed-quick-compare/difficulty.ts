/**
 * Named difficulty → concrete Quick Compare parameters.
 *
 * `resolveQuickCompareDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated the response window (see `sessionChallengeRating`).
 *
 * Parameter encoding: the SDK difficulty profile only carries numbers, so the
 * rich `QuickCompareDifficultyParams` is encoded deterministically — `rounds`,
 * `windowMs`, `maxValue`, `optionCount` as numbers, and the `promptTypes` mix
 * as a bitmask (`promptTypeMask`: 'same-different':1 'magnitude':2
 * 'sum-compare':4). `quickCompareParamsFromProfile` decodes and validates
 * strictly.
 *
 * Difficulty direction: a SMALLER response window is HARDER, a TIGHTER
 * proximity (`spreadPct`: max |a−b| / |sumA−sumB| as % of the larger side) is
 * HARDER, and a higher `optionCount` is harder for the numeric prompts.
 * Fixed levels use a constant window; adaptive shrinks the window after a
 * fully-correct round and grows it after a missed round, within
 * [minWindowMs, maxWindowMs].
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import { UNCONSTRAINED_SPREAD_PCT } from './generator';
import type { ComparePromptType, QuickCompareDifficultyParams } from './types';

/** Fixed-level tuning: rounds, window, decision types, magnitude, options. */
export const QUICK_COMPARE_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, QuickCompareDifficultyParams>
> = {
  easy: {
    rounds: 8,
    windowMs: 2600,
    promptTypes: ['same-different', 'magnitude'],
    maxValue: 9,
    optionCount: 2,
    spreadPct: 60,
  },
  normal: {
    rounds: 10,
    windowMs: 2200,
    promptTypes: ['same-different', 'magnitude', 'sum-compare'],
    maxValue: 20,
    optionCount: 3,
    spreadPct: 40,
  },
  hard: {
    rounds: 12,
    windowMs: 1700,
    promptTypes: ['magnitude', 'sum-compare'],
    maxValue: 50,
    optionCount: 3,
    spreadPct: 25,
  },
  expert: {
    rounds: 14,
    windowMs: 1400,
    promptTypes: ['magnitude', 'sum-compare'],
    maxValue: 99,
    optionCount: 4,
    spreadPct: 15,
  },
};

/**
 * Adaptive tuning: window moves within [1000, 2800] ms around the neutral
 * initial value (2200 ms → rating 0.5); all three decision types and option
 * count 3 (same as `normal`).
 */
export const ADAPTIVE_PARAMS: Readonly<QuickCompareDifficultyParams> = Object.freeze({
  rounds: 10,
  windowMs: 2200,
  promptTypes: ['same-different', 'magnitude', 'sum-compare'] as ComparePromptType[],
  maxValue: 30,
  optionCount: 3,
  spreadPct: 35,
  minWindowMs: 1200,
  maxWindowMs: 3200,
});

/** Bitmask of the decision-type mix (profile encoding). */
export const PROMPT_TYPE_MASK: Readonly<Record<ComparePromptType, number>> = {
  'same-different': 1,
  magnitude: 2,
  'sum-compare': 4,
};

/** All decision types in canonical order (also the decode order of the mask). */
export const PROMPT_TYPES: readonly ComparePromptType[] = [
  'same-different',
  'magnitude',
  'sum-compare',
];

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function quickCompareParamsForLevel(level: DifficultyLevel): QuickCompareDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...QUICK_COMPARE_DIFFICULTY_PARAMS[level] };
}

/** Encode the rich params into the SDK profile's number-only record. */
export function quickCompareParamsToRecord(
  params: QuickCompareDifficultyParams,
): Readonly<Record<string, number>> {
  let mask = 0;
  for (const type of params.promptTypes) {
    mask |= PROMPT_TYPE_MASK[type];
  }
  const record: Record<string, number> = {
    rounds: params.rounds,
    windowMs: params.windowMs,
    maxValue: params.maxValue,
    optionCount: params.optionCount,
    // Absent spread means unconstrained; always write the resolved value so
    // fresh profiles carry the axis explicitly.
    spreadPct: params.spreadPct ?? UNCONSTRAINED_SPREAD_PCT,
    promptTypeMask: mask,
  };
  if (params.minWindowMs !== undefined) {
    record.minWindowMs = params.minWindowMs;
  }
  if (params.maxWindowMs !== undefined) {
    record.maxWindowMs = params.maxWindowMs;
  }
  return record;
}

/** Resolve a level into a full difficulty profile carrying the tuning. */
export function resolveQuickCompareDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, quickCompareParamsToRecord(quickCompareParamsForLevel(level)));
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * or the prompt-type mask is not a subset of the known bits, instead of
 * silently producing a broken session.
 */
export function quickCompareParamsFromProfile(
  profile: DifficultyProfile,
): QuickCompareDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`speed-quick-compare: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const mask = requireNumber('promptTypeMask');
  if (!Number.isInteger(mask) || mask < 1 || mask > 7) {
    throw new Error(`speed-quick-compare: difficulty profile has invalid promptTypeMask "${String(mask)}"`);
  }
  const promptTypes = PROMPT_TYPES.filter((type) => (mask & PROMPT_TYPE_MASK[type]) !== 0);
  const minWindowMs = p.minWindowMs === undefined ? undefined : requireNumber('minWindowMs');
  const maxWindowMs = p.maxWindowMs === undefined ? undefined : requireNumber('maxWindowMs');
  // Lenient for profiles persisted before the proximity axis existed (v1.1):
  // an absent spread simply means unconstrained operand gaps.
  const spreadPct =
    p.spreadPct === undefined ? UNCONSTRAINED_SPREAD_PCT : requireNumber('spreadPct');
  return {
    rounds: requireNumber('rounds'),
    windowMs: requireNumber('windowMs'),
    promptTypes,
    maxValue: requireNumber('maxValue'),
    optionCount: requireNumber('optionCount'),
    spreadPct,
    ...(minWindowMs !== undefined ? { minWindowMs } : {}),
    ...(maxWindowMs !== undefined ? { maxWindowMs } : {}),
  };
}

/** Adaptive-only: the current window bounds. */
function adaptiveBounds(params: QuickCompareDifficultyParams): { minMs: number; maxMs: number } {
  return {
    minMs: params.minWindowMs ?? params.windowMs,
    maxMs: params.maxWindowMs ?? params.windowMs,
  };
}

/**
 * Response window of the next round. Fixed levels keep the constant window;
 * adaptive moves ±200 ms within [minWindowMs, maxWindowMs] (shrinks after a
 * correct round, grows after a missed one).
 */
export function nextWindowMs(
  prevWindowMs: number,
  roundCorrect: boolean,
  level: DifficultyLevel,
  params: QuickCompareDifficultyParams,
): number {
  if (level !== 'adaptive') {
    return prevWindowMs;
  }
  const { minMs, maxMs } = adaptiveBounds(params);
  const delta = roundCorrect ? -200 : 200;
  return Math.min(maxMs, Math.max(minMs, prevWindowMs + delta));
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports how far the player pushed the response window,
 * mapped linearly into [0, 1] over [minWindowMs, maxWindowMs] with the
 * direction inverted (smaller window = higher challenge). The neutral initial
 * window (2200 ms over [1000, 2800]) lands exactly on the 0.5 baseline.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalWindowMs: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = quickCompareParamsFromProfile(profile);
  const { minMs, maxMs } = adaptiveBounds(params);
  const span = maxMs - minMs;
  if (span <= 0) {
    return profile.challengeRating;
  }
  const clamped = Math.min(maxMs, Math.max(minMs, finalWindowMs));
  return Math.min(1, Math.max(0, 1 - (clamped - minMs) / span));
}
