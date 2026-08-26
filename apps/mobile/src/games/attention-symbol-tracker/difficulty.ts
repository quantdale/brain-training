/**
 * Named difficulty → concrete Symbol Tracker parameters.
 *
 * `resolveSymbolTrackerDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 *
 * Respond deadline (`respondDeadlineMs`): a per-tier budget on the pick phase
 * (8s → 5s as tiers rise). Expiry resolves the round with whatever is
 * selected — the score decays only via fewer correct picks; pausing freezes
 * it with the exact same active-time accumulation used by the observe window.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { SymbolTrackerDifficultyParams } from './types';

/** Back-compat default for profiles persisted before the respond deadline
 *  existed (pre-1.1): they never truncated the respond phase. */
export const DEFAULT_RESPOND_DEADLINE_MS = 7000;

/** Fixed-level tuning: board size, token count, track count, observe timing, distractors. */
export const SYMBOL_TRACKER_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, SymbolTrackerDifficultyParams>
> = {
  easy: {
    gridSize: 9,
    tokenCount: 4,
    initialTrackCount: 1,
    observeMs: 2500,
    respondDeadlineMs: 8000,
    distractors: 0,
    rounds: 4,
  },
  normal: {
    gridSize: 9,
    tokenCount: 6,
    initialTrackCount: 2,
    observeMs: 2200,
    respondDeadlineMs: 7000,
    distractors: 0,
    rounds: 5,
  },
  hard: {
    gridSize: 16,
    tokenCount: 8,
    initialTrackCount: 3,
    observeMs: 2000,
    respondDeadlineMs: 6000,
    distractors: 2,
    rounds: 6,
  },
  expert: {
    gridSize: 16,
    tokenCount: 9,
    initialTrackCount: 3,
    observeMs: 1800,
    respondDeadlineMs: 5000,
    distractors: 3,
    rounds: 7,
  },
};

/** Adaptive tuning: neutral 3×3 board; track count moves within [1, 4]. */
export const ADAPTIVE_PARAMS: Readonly<SymbolTrackerDifficultyParams> = Object.freeze({
  gridSize: 9,
  tokenCount: 6,
  initialTrackCount: 2,
  observeMs: 2200,
  respondDeadlineMs: 7000,
  distractors: 1,
  rounds: 6,
  minTrackCount: 1,
  maxTrackCount: 4,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function symbolTrackerParamsForLevel(level: DifficultyLevel): SymbolTrackerDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...SYMBOL_TRACKER_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Symbol Tracker tuning. */
export function resolveSymbolTrackerDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, { ...symbolTrackerParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function symbolTrackerParamsFromProfile(
  profile: DifficultyProfile,
): SymbolTrackerDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`attention-symbol-tracker: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const minTrackCount = p.minTrackCount === undefined ? undefined : requireNumber('minTrackCount');
  const maxTrackCount = p.maxTrackCount === undefined ? undefined : requireNumber('maxTrackCount');
  // Lenient for profiles persisted before the deadline axis (v1.1): an absent
  // budget means the generous normal-tier default rather than a broken board.
  const respondDeadlineMs =
    p.respondDeadlineMs === undefined
      ? DEFAULT_RESPOND_DEADLINE_MS
      : requireNumber('respondDeadlineMs');
  return {
    gridSize: requireNumber('gridSize'),
    tokenCount: requireNumber('tokenCount'),
    initialTrackCount: requireNumber('initialTrackCount'),
    observeMs: requireNumber('observeMs'),
    respondDeadlineMs,
    distractors: requireNumber('distractors'),
    rounds: requireNumber('rounds'),
    ...(minTrackCount !== undefined ? { minTrackCount } : {}),
    ...(maxTrackCount !== undefined ? { maxTrackCount } : {}),
  };
}

/**
 * Track count of the next round. Fixed levels escalate by one on a pass (capped
 * at the token count) and hold on a failure; adaptive moves ±1 within
 * [minTrackCount, maxTrackCount].
 */
export function nextTrackCount(
  prevCount: number,
  passed: boolean,
  level: DifficultyLevel,
  params: SymbolTrackerDifficultyParams,
): number {
  if (level === 'adaptive') {
    const min = params.minTrackCount ?? params.initialTrackCount;
    const max = Math.min(params.maxTrackCount ?? params.tokenCount, params.tokenCount);
    return Math.min(max, Math.max(min, prevCount + (passed ? 1 : -1)));
  }
  return passed ? Math.min(params.tokenCount, prevCount + 1) : prevCount;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final track count mapped linearly into
 * [0, 1] over [minTrackCount, maxTrackCount].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalTrackCount: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = symbolTrackerParamsFromProfile(profile);
  const min = params.minTrackCount ?? params.initialTrackCount;
  const max = Math.min(params.maxTrackCount ?? params.tokenCount, params.tokenCount);
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalTrackCount - min) / span))
    : profile.challengeRating;
}
