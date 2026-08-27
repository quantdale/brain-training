/**
 * Named difficulty → concrete Rule Grid parameters.
 *
 * `resolveRuleGridDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from the player's accuracy.
 *
 * Chained-deduction scaling: difficulty also varies inference depth and
 * interacting constraint count (blanks) in addition to size/rounds/time.
 * See solver `minDepthForLevel` / `blanksForLevel`.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { RuleGridDifficultyParams } from './types';

/** Fixed-level tuning: grid size, round count, per-round time budget. */
export const RULE_GRID_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, RuleGridDifficultyParams>
> = {
  easy: { size: 3, rounds: 6, roundTimeMs: 15000 },
  normal: { size: 4, rounds: 7, roundTimeMs: 20000 },
  hard: { size: 5, rounds: 8, roundTimeMs: 25000 },
  expert: { size: 6, rounds: 9, roundTimeMs: 30000 },
};

/** Adaptive tuning: starts at normal settings. */
export const ADAPTIVE_PARAMS: Readonly<RuleGridDifficultyParams> = Object.freeze({
  size: 4,
  rounds: 7,
  roundTimeMs: 20000,
});

/** Number of hidden cells (blanks) per level — scales interacting constraints. */
export function blanksForLevel(level: DifficultyLevel): number {
  switch (level) {
    case 'easy':
      return 2;
    case 'normal':
      return 3;
    case 'hard':
      return 4;
    case 'expert':
      return 6;
    case 'adaptive':
      return 3;
    default:
      return 3;
  }
}

/** Minimum deduction depth required per level (≥2 for Hard/Expert enforces chain). */
export function minDepthForLevel(level: DifficultyLevel): number {
  switch (level) {
    case 'easy':
      return 1;
    case 'normal':
      return 1;
    case 'hard':
      return 2;
    case 'expert':
      return 2;
    default:
      return 1;
  }
}


/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function ruleGridParamsForLevel(level: DifficultyLevel): RuleGridDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...RULE_GRID_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Rule Grid tuning. */
export function resolveRuleGridDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, { ...ruleGridParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function ruleGridParamsFromProfile(profile: DifficultyProfile): RuleGridDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`rule-grid: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  return {
    size: requireNumber('size'),
    rounds: requireNumber('rounds'),
    roundTimeMs: requireNumber('roundTimeMs'),
  };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports based on accuracy (share of rounds answered
 * correctly), scaled from the 0.5 baseline.
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
  const accuracy = roundsPlayed > 0 ? roundsCorrect / roundsPlayed : 0;
  return Math.min(1, Math.max(0, 0.5 + accuracy * 0.5));
}
