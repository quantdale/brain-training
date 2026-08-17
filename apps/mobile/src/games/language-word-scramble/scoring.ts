/**
 * Scoring + normalization for the Word Scramble game.
 *
 * Raw scoring is game-owned; `normalizeWordScrambleResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy   = roundsPassed / roundsPlayed            (0..1)
 *   wordFactor = (longestWord - minWordLength) / (maxWordLength - minWordLength) (clamped 0..1)
 *   value      = accuracy * (0.5 + 0.5 * wordFactor)
 *
 * The blend is multiplicative: accuracy is the base, and word difficulty
 * (longer words = harder scrambles) contributes up to half the value.
 * Difficulty itself is deliberately NOT folded into the value — it is recorded
 * on the raw result / diagnostic metadata so the Phase-2 rating pipeline
 * can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { WordScrambleDifficultyParams, WordScrambleRawResult } from './types';

/** Points for a passed round: 100 base + 10 per letter in the word. */
export function roundScore(wordLength: number): number {
  return 100 + 10 * wordLength;
}

/** Score of a hypothetically perfect session (all rounds passed). */
export function perfectSessionScore(params: WordScrambleDifficultyParams): number {
  // Use midpoint of word length range for each round to estimate.
  const midWordLen = Math.round((params.minWordLength + params.maxWordLength) / 2);
  return params.rounds * roundScore(midWordLen);
}

/** Share of rounds passed; 0 when nothing was played (division guard). */
export function accuracyOf(roundsPassed: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? roundsPassed / roundsPlayed : 0;
}

/** Clamp to [0, 1]; rejects non-finite input. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** Word difficulty progress relative to the length range, clamped to [0, 1]. */
export function wordDifficultyProgress(
  longestWord: number,
  minWordLength: number,
  maxWordLength: number,
): number {
  const span = maxWordLength - minWordLength;
  if (span <= 0) {
    return longestWord >= maxWordLength ? 1 : 0;
  }
  return clamp01((longestWord - minWordLength) / span);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeWordScrambleResult(
  raw: WordScrambleRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const minLen = raw.minWordLength ?? 4;
  const maxLen = raw.maxWordLength ?? 10;
  const progress = wordDifficultyProgress(raw.longestWord, minLen, maxLen);
  const value = clamp01(accuracy * (0.5 + 0.5 * progress));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Word Scramble game. */
export const wordScramblePerformanceNormalizer: PerformanceNormalizer<WordScrambleRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeWordScrambleResult,
};
