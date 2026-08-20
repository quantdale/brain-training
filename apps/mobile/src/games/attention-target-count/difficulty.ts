/**
 * Named difficulty → concrete Target Count parameters.
 *
 * `resolveTargetCountDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how many rounds the
 * player counted correctly relative to how many they played.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { TargetCountDifficultyParams } from './types';

/** Fixed-level tuning: grid size, distractor variety, target range, time, rounds. */
export const TARGET_COUNT_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, TargetCountDifficultyParams>
> = {
  easy: {
    rows: 3,
    cols: 3,
    distractorClasses: 1,
    targetCountRange: [1, 3],
    roundTimeMs: 12000,
    rounds: 6,
  },
  normal: {
    rows: 4,
    cols: 4,
    distractorClasses: 2,
    targetCountRange: [2, 6],
    roundTimeMs: 9000,
    rounds: 8,
  },
  hard: {
    rows: 5,
    cols: 5,
    distractorClasses: 3,
    targetCountRange: [3, 10],
    roundTimeMs: 7000,
    rounds: 9,
  },
  expert: {
    rows: 6,
    cols: 6,
    distractorClasses: 4,
    targetCountRange: [4, 14],
    roundTimeMs: 5500,
    rounds: 10,
  },
};

/** Adaptive tuning: starts at normal-ish settings. */
export const ADAPTIVE_PARAMS: Readonly<TargetCountDifficultyParams> = Object.freeze({
  rows: 4,
  cols: 4,
  distractorClasses: 2,
  targetCountRange: [2, 6] as [number, number],
  roundTimeMs: 9000,
  rounds: 8,
});

/**
 * Flatten game params into the scalar-only shape the SDK profile accepts
 * (`parameters` is `Record<string, number>`); the target count *range* is
 * stored as its two scalar bounds and reconstructed by `targetCountParamsFromProfile`.
 */
function toProfileParams(p: TargetCountDifficultyParams): Record<string, number> {
  return {
    rows: p.rows,
    cols: p.cols,
    distractorClasses: p.distractorClasses,
    targetCountLo: p.targetCountRange[0],
    targetCountHi: p.targetCountRange[1],
    roundTimeMs: p.roundTimeMs,
    rounds: p.rounds,
  };
}

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function targetCountParamsForLevel(level: DifficultyLevel): TargetCountDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...TARGET_COUNT_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Target Count tuning. */
export function resolveTargetCountDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, toProfileParams(targetCountParamsForLevel(level)));
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function targetCountParamsFromProfile(profile: DifficultyProfile): TargetCountDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`target-count: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  return {
    rows: requireNumber('rows'),
    cols: requireNumber('cols'),
    distractorClasses: requireNumber('distractorClasses'),
    targetCountRange: [requireNumber('targetCountLo'), requireNumber('targetCountHi')],
    roundTimeMs: requireNumber('roundTimeMs'),
    rounds: requireNumber('rounds'),
  };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports based on counting accuracy (how many rounds the
 * player counted correctly relative to how many they played).
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  roundsCorrect: number,
  roundsPlayed: number,
  _totalElapsedMs: number,
  _totalBudgetMs: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  if (roundsPlayed <= 0) {
    return profile.challengeRating;
  }
  const accuracy = roundsCorrect / roundsPlayed;
  // Scale to [0, 1] from the adaptive baseline.
  return Math.min(1, Math.max(0, 0.5 + accuracy * 0.5));
}
