/**
 * Named difficulty → concrete Word Scramble parameters.
 *
 * `resolveWordScrambleDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { WordScrambleDifficultyParams } from './types';

/** Fixed-level tuning: options count, word length range, rounds, time budget. */
export const WORD_SCRAMBLE_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, WordScrambleDifficultyParams>
> = {
  easy: { optionsCount: 3, minWordLength: 4, maxWordLength: 5, rounds: 4, roundTimeMs: 30_000 },
  normal: { optionsCount: 4, minWordLength: 4, maxWordLength: 6, rounds: 5, roundTimeMs: 25_000 },
  hard: { optionsCount: 4, minWordLength: 5, maxWordLength: 8, rounds: 6, roundTimeMs: 20_000 },
  expert: { optionsCount: 5, minWordLength: 6, maxWordLength: 10, rounds: 7, roundTimeMs: 15_000 },
};

/** Adaptive tuning: neutral range; options and word length move within bounds. */
export const ADAPTIVE_PARAMS: Readonly<WordScrambleDifficultyParams> = Object.freeze({
  optionsCount: 4,
  minWordLength: 4,
  maxWordLength: 7,
  rounds: 6,
  roundTimeMs: 20_000,
  minOptionsCount: 3,
  maxOptionsCount: 5,
  adaptiveMinWordLength: 3,
  adaptiveMaxWordLength: 9,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function wordScrambleParamsForLevel(level: DifficultyLevel): WordScrambleDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...WORD_SCRAMBLE_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Word Scramble tuning. */
export function resolveWordScrambleDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, { ...wordScrambleParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile. Throws when a required
 * parameter is missing/non-finite.
 */
export function wordScrambleParamsFromProfile(
  profile: DifficultyProfile,
): WordScrambleDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`word-scramble: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const minOptionsCount =
    p.minOptionsCount === undefined ? undefined : requireNumber('minOptionsCount');
  const maxOptionsCount =
    p.maxOptionsCount === undefined ? undefined : requireNumber('maxOptionsCount');
  const adaptiveMinWordLength =
    p.adaptiveMinWordLength === undefined ? undefined : requireNumber('adaptiveMinWordLength');
  const adaptiveMaxWordLength =
    p.adaptiveMaxWordLength === undefined ? undefined : requireNumber('adaptiveMaxWordLength');
  return {
    optionsCount: requireNumber('optionsCount'),
    minWordLength: requireNumber('minWordLength'),
    maxWordLength: requireNumber('maxWordLength'),
    rounds: requireNumber('rounds'),
    roundTimeMs: requireNumber('roundTimeMs'),
    ...(minOptionsCount !== undefined ? { minOptionsCount } : {}),
    ...(maxOptionsCount !== undefined ? { maxOptionsCount } : {}),
    ...(adaptiveMinWordLength !== undefined ? { adaptiveMinWordLength } : {}),
    ...(adaptiveMaxWordLength !== undefined ? { adaptiveMaxWordLength } : {}),
  };
}

/**
 * Adaptive difficulty escalation: compute the next round's params based on
 * performance. Returns the same params for fixed levels.
 */
export function adaptiveRoundParams(
  level: DifficultyLevel,
  params: WordScrambleDifficultyParams,
  passed: boolean,
): { optionsCount: number; minWordLength: number; maxWordLength: number } {
  if (level !== 'adaptive') {
    return {
      optionsCount: params.optionsCount,
      minWordLength: params.minWordLength,
      maxWordLength: params.maxWordLength,
    };
  }
  const minOpts = params.minOptionsCount ?? 3;
  const maxOpts = params.maxOptionsCount ?? 5;
  const minLen = params.adaptiveMinWordLength ?? 4;
  const maxLen = params.adaptiveMaxWordLength ?? 9;
  // On pass: harder (more options, longer words). On fail: easier.
  return {
    optionsCount: Math.min(maxOpts, Math.max(minOpts, params.optionsCount + (passed ? 1 : -1))),
    minWordLength: Math.min(maxLen, Math.max(minLen, params.minWordLength + (passed ? 1 : -1))),
    maxWordLength: Math.min(maxLen, Math.max(minLen, params.maxWordLength + (passed ? 1 : -1))),
  };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's escalation mapped linearly into [0, 1].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalOptionsCount: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = wordScrambleParamsFromProfile(profile);
  const min = params.minOptionsCount ?? 3;
  const max = params.maxOptionsCount ?? 5;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalOptionsCount - min) / span))
    : profile.challengeRating;
}
