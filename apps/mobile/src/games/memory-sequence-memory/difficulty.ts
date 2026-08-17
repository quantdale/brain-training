/**
 * Named difficulty → concrete Sequence Memory parameters.
 *
 * `resolveSequenceMemoryDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 *
 * Tuning notes:
 * - Easy/Normal play the classic 2×2 Simon pad; Hard/Expert move to a 3×3
 *   pad. `maxLength` may exceed `tileCount`, so long sequences intentionally
 *   repeat tiles (the generator suppresses adjacent duplicates only).
 * - The score attack runs `sessionSeconds` per difficulty (1–3 minutes).
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { SequenceMemoryDifficultyParams } from './types';

/** Fixed-level tuning: pad size, base/max sequence length, reveal speed, budget. */
export const SEQUENCE_MEMORY_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, SequenceMemoryDifficultyParams>
> = {
  easy: { tileCount: 4, baseLength: 2, maxLength: 6, revealMs: 1100, sessionSeconds: 60 },
  normal: { tileCount: 4, baseLength: 3, maxLength: 8, revealMs: 900, sessionSeconds: 90 },
  hard: { tileCount: 9, baseLength: 4, maxLength: 12, revealMs: 700, sessionSeconds: 120 },
  expert: { tileCount: 9, baseLength: 5, maxLength: 14, revealMs: 550, sessionSeconds: 180 },
};

/** Adaptive tuning: 2×2 pad; length moves within [2, 10] per round outcome. */
export const ADAPTIVE_PARAMS: Readonly<SequenceMemoryDifficultyParams> = Object.freeze({
  tileCount: 4,
  baseLength: 3,
  maxLength: 10,
  revealMs: 900,
  sessionSeconds: 90,
  minLength: 2,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function sequenceMemoryParamsForLevel(
  level: DifficultyLevel,
): SequenceMemoryDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...SEQUENCE_MEMORY_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the tuning. */
export function resolveSequenceMemoryDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...sequenceMemoryParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken pad.
 */
export function sequenceMemoryParamsFromProfile(
  profile: DifficultyProfile,
): SequenceMemoryDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(
        `memory-sequence-memory: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const minLength = p.minLength === undefined ? undefined : requireNumber('minLength');
  return {
    tileCount: requireNumber('tileCount'),
    baseLength: requireNumber('baseLength'),
    maxLength: requireNumber('maxLength'),
    revealMs: requireNumber('revealMs'),
    sessionSeconds: requireNumber('sessionSeconds'),
    ...(minLength !== undefined ? { minLength } : {}),
  };
}

/**
 * Sequence length of the next round. Fixed levels escalate by one on a pass
 * (capped at `maxLength`) and restart at `baseLength` on a failure — the
 * classic Simon rule: one mistake wipes the pattern back to the start.
 * Adaptive moves ±1 within [minLength, maxLength].
 */
export function nextSequenceLength(
  prevLength: number,
  passed: boolean,
  level: DifficultyLevel,
  params: SequenceMemoryDifficultyParams,
): number {
  if (level === 'adaptive') {
    const min = params.minLength ?? params.baseLength;
    return Math.min(params.maxLength, Math.max(min, prevLength + (passed ? 1 : -1)));
  }
  return passed ? Math.min(params.maxLength, prevLength + 1) : params.baseLength;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final sequence length mapped linearly
 * into [0, 1] over [minLength, maxLength].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalSequenceLength: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = sequenceMemoryParamsFromProfile(profile);
  const min = params.minLength ?? params.baseLength;
  const span = params.maxLength - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalSequenceLength - min) / span))
    : profile.challengeRating;
}
