/**
 * Named difficulty → concrete Visual Search parameters.
 *
 * `resolveVisualSearchDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from the window the player
 * settled at (see `sessionChallengeRating`).
 *
 * Escalation rules (deterministic, difficulty-recorded):
 * - Grid: every `GRID_ESCALATION_EVERY` rounds the grid grows one square
 *   level (4 → 9 → 16 → 25), capped at `maxGridSize`.
 * - Window: fixed levels shrink by `windowStepMs` per round (clamped at
 *   `minWindowMs`); adaptive moves ±`windowStepMs` on pass/fail within
 *   [`minWindowMs`, `maxWindowMs`].
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { VisualSearchDifficultyParams } from './types';

/** Square grid levels the escalation walks through. */
export const GRID_LEVELS = [4, 9, 16, 25] as const;

/** Number of rounds each grid size is kept before growing one level. */
export const GRID_ESCALATION_EVERY = 2;

/** Session-clock dock applied when the player taps a distractor (ms). */
export const DISTRACTOR_PENALTY_MS = 2_000;

/** Fixed-level tuning: score-attack budget, rounds, grid range, window range. */
export const VISUAL_SEARCH_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, VisualSearchDifficultyParams>
> = {
  easy: {
    sessionDurationMs: 90_000,
    rounds: 10,
    initialGridSize: 4,
    maxGridSize: 16,
    initialWindowMs: 6_000,
    minWindowMs: 2_500,
    windowStepMs: 400,
  },
  normal: {
    sessionDurationMs: 120_000,
    rounds: 12,
    initialGridSize: 4,
    maxGridSize: 25,
    initialWindowMs: 4_500,
    minWindowMs: 1_800,
    windowStepMs: 400,
  },
  hard: {
    sessionDurationMs: 150_000,
    rounds: 14,
    initialGridSize: 9,
    maxGridSize: 25,
    initialWindowMs: 3_200,
    minWindowMs: 1_200,
    windowStepMs: 350,
  },
  expert: {
    sessionDurationMs: 180_000,
    rounds: 16,
    initialGridSize: 9,
    maxGridSize: 25,
    initialWindowMs: 2_400,
    minWindowMs: 800,
    windowStepMs: 300,
  },
};

/** Adaptive tuning: neutral mid-range window; outcomes move it ±step. */
export const ADAPTIVE_PARAMS: Readonly<VisualSearchDifficultyParams> = Object.freeze({
  sessionDurationMs: 120_000,
  rounds: 12,
  initialGridSize: 4,
  maxGridSize: 25,
  // Neutral start: midpoint of [minWindowMs, maxWindowMs].
  initialWindowMs: 3_000,
  minWindowMs: 1_000,
  maxWindowMs: 5_000,
  windowStepMs: 300,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function visualSearchParamsForLevel(level: DifficultyLevel): VisualSearchDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...VISUAL_SEARCH_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveVisualSearchDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...visualSearchParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function visualSearchParamsFromProfile(
  profile: DifficultyProfile,
): VisualSearchDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(
        `attention-visual-search: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const maxWindowMs = p.maxWindowMs === undefined ? undefined : requireNumber('maxWindowMs');
  return {
    sessionDurationMs: requireNumber('sessionDurationMs'),
    rounds: requireNumber('rounds'),
    initialGridSize: requireNumber('initialGridSize'),
    maxGridSize: requireNumber('maxGridSize'),
    initialWindowMs: requireNumber('initialWindowMs'),
    minWindowMs: requireNumber('minWindowMs'),
    windowStepMs: requireNumber('windowStepMs'),
    ...(maxWindowMs !== undefined ? { maxWindowMs } : {}),
  };
}

function gridLevelIndex(size: number): number {
  const index = GRID_LEVELS.indexOf(size as (typeof GRID_LEVELS)[number]);
  if (index < 0) {
    throw new Error(
      `attention-visual-search: grid size ${size} is not a supported square level ` +
        `(${GRID_LEVELS.join(', ')})`,
    );
  }
  return index;
}

/**
 * Tile count of the round at `roundIndex`: starts at `initialGridSize` and
 * grows one square level every `GRID_ESCALATION_EVERY` rounds, capped at
 * `maxGridSize`. Pure function of the params — the target sequence for a
 * session is therefore fully reproducible from (seed, difficulty).
 */
export function gridSizeFor(params: VisualSearchDifficultyParams, roundIndex: number): number {
  const start = gridLevelIndex(params.initialGridSize);
  const max = gridLevelIndex(params.maxGridSize);
  const tier = Math.floor(roundIndex / GRID_ESCALATION_EVERY);
  const level = Math.min(start + tier, max);
  return GRID_LEVELS[level];
}

/**
 * Response window of the round at `roundIndex` for FIXED levels: shrinks by
 * `windowStepMs` per round, clamped at `minWindowMs`. (Adaptive windows move
 * by outcome instead — see `nextAdaptiveWindow`.)
 */
export function windowMsFor(params: VisualSearchDifficultyParams, roundIndex: number): number {
  return Math.max(params.minWindowMs, params.initialWindowMs - roundIndex * params.windowStepMs);
}

/**
 * Adaptive-only: the next round's window, moved ±`windowStepMs` by the
 * previous round's outcome, clamped to [`minWindowMs`, `maxWindowMs`].
 */
export function nextAdaptiveWindow(
  prevWindowMs: number,
  passed: boolean,
  params: VisualSearchDifficultyParams,
): number {
  const max = params.maxWindowMs ?? params.initialWindowMs;
  const next = prevWindowMs + (passed ? -params.windowStepMs : params.windowStepMs);
  return Math.min(max, Math.max(params.minWindowMs, next));
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final response window mapped linearly
 * into [0, 1] over [minWindowMs, maxWindowMs] (a smaller window — faster
 * selection — is a higher rating).
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalWindowMs: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = visualSearchParamsFromProfile(profile);
  const max = params.maxWindowMs ?? params.initialWindowMs;
  const span = max - params.minWindowMs;
  return span > 0
    ? Math.min(1, Math.max(0, (max - finalWindowMs) / span))
    : profile.challengeRating;
}
