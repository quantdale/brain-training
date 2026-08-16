/**
 * Named difficulty → concrete Memory parameters.
 *
 * `resolveMemoryDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { MemoryDifficultyParams } from './types';

/** Fixed-level tuning: grid size, round-1 sequence length, reveal timing, rounds. */
export const MEMORY_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, MemoryDifficultyParams>
> = {
  easy: { gridSize: 9, initialSequenceLength: 3, revealMs: 1100, rounds: 4 },
  normal: { gridSize: 9, initialSequenceLength: 4, revealMs: 900, rounds: 5 },
  hard: { gridSize: 16, initialSequenceLength: 5, revealMs: 750, rounds: 6 },
  expert: { gridSize: 16, initialSequenceLength: 6, revealMs: 600, rounds: 7 },
};

/** Adaptive tuning: neutral 3×3 board; length moves within [3, 8] per round. */
export const ADAPTIVE_PARAMS: Readonly<MemoryDifficultyParams> = Object.freeze({
  gridSize: 9,
  initialSequenceLength: 4,
  revealMs: 900,
  rounds: 6,
  minSequenceLength: 3,
  maxSequenceLength: 8,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function memoryParamsForLevel(level: DifficultyLevel): MemoryDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...MEMORY_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Memory tuning. */
export function resolveMemoryDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...memoryParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function memoryParamsFromProfile(profile: DifficultyProfile): MemoryDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`memory: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const minSequenceLength =
    p.minSequenceLength === undefined ? undefined : requireNumber('minSequenceLength');
  const maxSequenceLength =
    p.maxSequenceLength === undefined ? undefined : requireNumber('maxSequenceLength');
  return {
    gridSize: requireNumber('gridSize'),
    initialSequenceLength: requireNumber('initialSequenceLength'),
    revealMs: requireNumber('revealMs'),
    rounds: requireNumber('rounds'),
    ...(minSequenceLength !== undefined ? { minSequenceLength } : {}),
    ...(maxSequenceLength !== undefined ? { maxSequenceLength } : {}),
  };
}

/**
 * Sequence length of the next round. Fixed levels escalate by one on a pass
 * (capped at the grid size) and hold on a failure; adaptive moves ±1 within
 * [minSequenceLength, maxSequenceLength].
 */
export function nextSequenceLength(
  prevLength: number,
  passed: boolean,
  level: DifficultyLevel,
  params: MemoryDifficultyParams,
): number {
  if (level === 'adaptive') {
    const min = params.minSequenceLength ?? params.initialSequenceLength;
    const max = params.maxSequenceLength ?? params.gridSize;
    return Math.min(max, Math.max(min, prevLength + (passed ? 1 : -1)));
  }
  return passed ? Math.min(params.gridSize, prevLength + 1) : prevLength;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final sequence length mapped linearly
 * into [0, 1] over [minSequenceLength, maxSequenceLength].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalSequenceLength: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = memoryParamsFromProfile(profile);
  const min = params.minSequenceLength ?? params.initialSequenceLength;
  const max = params.maxSequenceLength ?? params.gridSize;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalSequenceLength - min) / span))
    : profile.challengeRating;
}
