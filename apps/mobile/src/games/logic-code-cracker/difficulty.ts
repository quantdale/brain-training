/**
 * Named difficulty → concrete Code Cracker parameters.
 *
 * `resolveCodeCrackerDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how many guesses the
 * player used relative to the budget.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { CodeCrackerDifficultyParams } from './types';

/** Fixed-level tuning: code length, color count, guess budget, rounds. */
export const CODE_CRACKER_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, CodeCrackerDifficultyParams>
> = {
  easy: { codeLength: 3, colorCount: 4, guessBudget: 10, rounds: 3 },
  normal: { codeLength: 4, colorCount: 6, guessBudget: 10, rounds: 4 },
  hard: { codeLength: 4, colorCount: 8, guessBudget: 8, rounds: 5 },
  expert: { codeLength: 5, colorCount: 8, guessBudget: 8, rounds: 6 },
};

/** Adaptive tuning: starts at easy-ish settings; length moves within bounds. */
export const ADAPTIVE_PARAMS: Readonly<CodeCrackerDifficultyParams> = Object.freeze({
  codeLength: 4,
  colorCount: 6,
  guessBudget: 10,
  rounds: 5,
  minLength: 3,
  maxLength: 6,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function codeCrackerParamsForLevel(level: DifficultyLevel): CodeCrackerDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...CODE_CRACKER_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Code Cracker tuning. */
export function resolveCodeCrackerDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, { ...codeCrackerParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function codeCrackerParamsFromProfile(profile: DifficultyProfile): CodeCrackerDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`code-cracker: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const minLength = p.minLength === undefined ? undefined : requireNumber('minLength');
  const maxLength = p.maxLength === undefined ? undefined : requireNumber('maxLength');
  return {
    codeLength: requireNumber('codeLength'),
    colorCount: requireNumber('colorCount'),
    guessBudget: requireNumber('guessBudget'),
    rounds: requireNumber('rounds'),
    ...(minLength !== undefined ? { minLength } : {}),
    ...(maxLength !== undefined ? { maxLength } : {}),
  };
}

/**
 * Code length of the next round. Fixed levels hold constant (the puzzle is
 * already tuned per level); adaptive moves ±1 within [minLength, maxLength]
 * based on whether the previous round was solved.
 */
export function nextCodeLength(
  prevLength: number,
  solved: boolean,
  level: DifficultyLevel,
  params: CodeCrackerDifficultyParams,
): number {
  if (level === 'adaptive') {
    const min = params.minLength ?? params.codeLength;
    const max = params.maxLength ?? params.codeLength;
    return Math.min(max, Math.max(min, prevLength + (solved ? 1 : -1)));
  }
  // Fixed levels keep the code length constant across rounds.
  return params.codeLength;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports based on average solve efficiency.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  roundsSolved: number,
  totalGuessesUsed: number,
  totalGuessesBudget: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  if (totalGuessesBudget === 0 || roundsSolved === 0) {
    return profile.challengeRating;
  }
  // Efficiency: how many guesses were used vs budget, higher is better.
  const efficiency = 1 - totalGuessesUsed / totalGuessesBudget;
  // Scale to [0, 1] from the adaptive baseline.
  return Math.min(1, Math.max(0, 0.5 + efficiency * 0.5));
}
