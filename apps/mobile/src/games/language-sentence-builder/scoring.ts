/**
 * Scoring + normalization for the Sentence Builder game.
 *
 * Raw scoring is game-owned; `normalizeSentenceBuilderResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1).
 *
 * Scoring rule (per packet):
 *   100 points per correct sentence + 10 × wordCount bonus.
 *   Partial credit: 50 points if 80%+ words are in the correct position.
 *
 * Normalization rule:
 *   accuracy = roundsPassed / roundsPlayed  (0..1)
 *   avgWordLengthFactor = avg word length across all rounds, normalized to [0,1]
 *                         (mapped linearly from [3, 8] chars to [0, 1])
 *   value = accuracy × (0.5 + 0.5 × avgWordLengthFactor)
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { SentenceBuilderDifficultyParams, SentenceBuilderRawResult } from './types';

/** Points for a perfectly solved sentence: 100 base + 10 × wordCount. */
export function perfectRoundScore(wordCount: number): number {
  return 100 + 10 * wordCount;
}

/** Partial credit score for a sentence with 80%+ correct position. */
export function partialRoundScore(): number {
  return 50;
}

/**
 * Compute per-word position accuracy for a round.
 * Returns the fraction of words in the correct position.
 */
export function positionAccuracy(
  original: readonly string[],
  playerOrder: readonly string[],
): number {
  if (original.length === 0) return 0;
  let correct = 0;
  const len = Math.min(original.length, playerOrder.length);
  for (let i = 0; i < len; i += 1) {
    if (original[i] === playerOrder[i]) {
      correct += 1;
    }
  }
  return correct / original.length;
}

/**
 * Compute the round score given the original and player's word order.
 */
export function computeRoundScore(
  original: readonly string[],
  playerOrder: readonly string[],
): { points: number; passed: boolean } {
  const accuracy = positionAccuracy(original, playerOrder);
  const perfect = accuracy >= 1.0;
  const passed = accuracy >= 0.8;

  if (perfect) {
    return { points: perfectRoundScore(original.length), passed: true };
  }
  if (passed) {
    return { points: partialRoundScore(), passed: true };
  }
  return { points: 0, passed: false };
}

/** Score of a hypothetically perfect session. */
export function perfectSessionScore(params: SentenceBuilderDifficultyParams): number {
  let total = 0;
  for (let i = 0; i < params.rounds; i += 1) {
    // Average word count at midpoint of the range.
    const avgWords = Math.round((params.minWords + params.maxWords) / 2);
    total += perfectRoundScore(avgWords);
  }
  return total;
}

/** Share of rounds passed; 0 when nothing was played. */
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

/**
 * Average word length factor normalized to [0, 1].
 * Maps word lengths from [3, 8] to [0, 1].
 */
export function avgWordLengthFactor(avgWordLength: number): number {
  return clamp01((avgWordLength - 3) / (8 - 3));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeSentenceBuilderResult(
  raw: SentenceBuilderRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const value = clamp01(accuracy * (0.5 + 0.5 * raw.avgWordLengthFactor));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance. */
export const sentenceBuilderPerformanceNormalizer: PerformanceNormalizer<SentenceBuilderRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeSentenceBuilderResult,
};
