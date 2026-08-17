/**
 * Named difficulty → concrete Sentence Builder parameters.
 *
 * `resolveSentenceBuilderDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile is exactly what gets persisted
 * with each session.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { SentenceBuilderDifficultyParams } from './types';

/** Fixed-level tuning: word range, rounds, time budget, category filter. */
export const DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, SentenceBuilderDifficultyParams>
> = {
  easy: {
    minWords: 4,
    maxWords: 5,
    rounds: 4,
    timeBudgetMs: 30_000,
    allowedCategories: [],
  },
  normal: {
    minWords: 5,
    maxWords: 7,
    rounds: 5,
    timeBudgetMs: 25_000,
    allowedCategories: [],
  },
  hard: {
    minWords: 6,
    maxWords: 9,
    rounds: 6,
    timeBudgetMs: 20_000,
    allowedCategories: [],
  },
  expert: {
    minWords: 7,
    maxWords: 12,
    rounds: 7,
    timeBudgetMs: 15_000,
    allowedCategories: [],
  },
};

/** Adaptive tuning: neutral starting point; escalates during play. */
export const ADAPTIVE_PARAMS: Readonly<SentenceBuilderDifficultyParams> = Object.freeze({
  minWords: 4,
  maxWords: 12,
  rounds: 5,
  timeBudgetMs: 25_000,
  allowedCategories: [],
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function paramsForLevel(level: DifficultyLevel): SentenceBuilderDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveSentenceBuilderDifficulty(
  level: DifficultyLevel,
): DifficultyProfile {
  const p = paramsForLevel(level);
  return resolveDifficulty(level, {
    minWords: p.minWords,
    maxWords: p.maxWords,
    rounds: p.rounds,
    timeBudgetMs: p.timeBudgetMs,
  });
}

/**
 * Recover validated parameters from a resolved profile.
 * Throws when a required parameter is missing/non-finite.
 */
export function paramsFromProfile(
  profile: DifficultyProfile,
): SentenceBuilderDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`sentence-builder: difficulty profile missing numeric parameter "${key}"`);
    }
    return value;
  };
  return {
    minWords: requireNumber('minWords'),
    maxWords: requireNumber('maxWords'),
    rounds: requireNumber('rounds'),
    timeBudgetMs: requireNumber('timeBudgetMs'),
    allowedCategories: [],
  };
}

/**
 * Escalate the word range for the next round in adaptive mode.
 * On pass, tighten the range upward; on failure, hold or loosen.
 */
export function nextWordRange(
  prevMinWords: number,
  prevMaxWords: number,
  passed: boolean,
  level: DifficultyLevel,
): { minWords: number; maxWords: number } {
  if (level !== 'adaptive') {
    return { minWords: prevMinWords, maxWords: prevMaxWords };
  }
  if (passed) {
    // Escalate: shift range up by 1, capped at 12.
    const newMin = Math.min(12, prevMinWords + 1);
    const newMax = Math.min(12, prevMaxWords + 1);
    return { minWords: newMin, maxWords: Math.max(newMin, newMax) };
  }
  // Hold on failure (no regression in adaptive).
  return { minWords: prevMinWords, maxWords: prevMaxWords };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default;
 * adaptive maps the final word count linearly into [0, 1] over [4, 12].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalWordCount: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const span = 12 - 4;
  return span > 0
    ? Math.min(1, Math.max(0, (finalWordCount - 4) / span))
    : profile.challengeRating;
}
