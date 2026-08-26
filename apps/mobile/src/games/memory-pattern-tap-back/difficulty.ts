/**
 * Named difficulty → concrete Pattern Tap Back parameters.
 *
 * `resolvePatternTapBackDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { PatternTapBackDifficultyParams } from './types';

/** Fixed-level tuning. */
export const DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, PatternTapBackDifficultyParams>
> = {
  easy: {
    gridSize: 9,
    initialSequenceLength: 3,
    maxSequenceLength: 6,
    baseObserveMs: 600,
    stepObserveMs: 200,
    rounds: 4,
  },
  normal: {
    gridSize: 9,
    initialSequenceLength: 4,
    maxSequenceLength: 8,
    baseObserveMs: 500,
    stepObserveMs: 200,
    rounds: 5,
  },
  hard: {
    gridSize: 16,
    initialSequenceLength: 5,
    maxSequenceLength: 10,
    baseObserveMs: 500,
    stepObserveMs: 200,
    rounds: 6,
  },
  expert: {
    gridSize: 16,
    initialSequenceLength: 6,
    maxSequenceLength: 12,
    baseObserveMs: 500,
    stepObserveMs: 200,
    rounds: 7,
  },
};

/**
 * Adaptive tuning: starts at 3×3 grid with short sequences, escalates to 4×4
 * with longer sequences as the player progresses.
 */
export const ADAPTIVE_PARAMS: Readonly<PatternTapBackDifficultyParams> = Object.freeze({
  gridSize: 9,
  initialSequenceLength: 3,
  maxSequenceLength: 12,
  baseObserveMs: 500,
  stepObserveMs: 200,
  rounds: 5,
  escalatedGridSize: 16,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function paramsForLevel(level: DifficultyLevel): PatternTapBackDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolvePatternTapBackDifficulty(
  level: DifficultyLevel,
): DifficultyProfile {
  return resolveDifficulty(level, { ...paramsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite.
 */
export function paramsFromProfile(
  profile: DifficultyProfile,
): PatternTapBackDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(
        `pattern-tap-back: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  return {
    gridSize: requireNumber('gridSize'),
    initialSequenceLength: requireNumber('initialSequenceLength'),
    maxSequenceLength: requireNumber('maxSequenceLength'),
    baseObserveMs: requireNumber('baseObserveMs'),
    stepObserveMs: requireNumber('stepObserveMs'),
    rounds: requireNumber('rounds'),
    escalatedGridSize:
      p.escalatedGridSize !== undefined ? requireNumber('escalatedGridSize') : undefined,
  };
}

/**
 * Whether the recall phase confirms each correct tap immediately by keeping
 * the matched set lit. Easy/normal/adaptive stay approachable; hard/expert
 * hide the per-tap confirm so the whole route must be held without feedback —
 * together with the adjacency generator this is the ADR-0005 differentiation
 * from the Memory game.
 */
export function confirmsEachTap(level: DifficultyLevel | null): boolean {
  return level !== 'hard' && level !== 'expert';
}

/**
 * Sequence length of the next round. Fixed levels escalate by one on a pass
 * (capped at maxSequenceLength) and hold on a failure. Adaptive moves ±1
 * within [initialSequenceLength, maxSequenceLength].
 */
export function nextSequenceLength(
  prevLength: number,
  passed: boolean,
  level: DifficultyLevel,
  params: PatternTapBackDifficultyParams,
): number {
  if (level === 'adaptive') {
    const min = params.initialSequenceLength;
    const max = params.maxSequenceLength;
    return Math.min(max, Math.max(min, prevLength + (passed ? 1 : -1)));
  }
  return passed ? Math.min(params.maxSequenceLength, prevLength + 1) : prevLength;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final sequence length mapped linearly
 * into [0, 1] over [initialSequenceLength, maxSequenceLength].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalSequenceLength: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = paramsFromProfile(profile);
  const min = params.initialSequenceLength;
  const max = params.maxSequenceLength;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalSequenceLength - min) / span))
    : profile.challengeRating;
}

/**
 * Determine the active grid size for a given round in adaptive mode.
 * Rounds 0-2 use the base grid (3×3); round 3+ escalate to the larger grid.
 */
export function adaptiveGridSize(
  roundIndex: number,
  params: PatternTapBackDifficultyParams,
): number {
  if (params.escalatedGridSize !== undefined) {
    return roundIndex >= 3 ? params.escalatedGridSize : params.gridSize;
  }
  return params.gridSize;
}
