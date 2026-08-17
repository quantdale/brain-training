/**
 * Scoring + normalization for the Pattern Tap Back game.
 *
 * Raw scoring is game-owned; `normalizePatternTapBackResult` converts it to
 * the SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Scoring rule (documented, deterministic):
 *
 *   roundScore = 100 + 10 × sequenceLength
 *
 *   accuracy      = roundsCompleted / totalRounds
 *   lengthProgress = avg over completed rounds of
 *     (roundLength - initialSequenceLength) / (maxSequenceLength - initialSequenceLength)
 *   normalized    = accuracy × (0.5 + 0.5 × lengthProgress)
 *
 * No time pressure during recall — pure accuracy scoring.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { PatternTapBackDifficultyParams, PatternTapBackRawResult } from './types';

/** Points for a correct round: 100 base + 10 per sequence step. */
export function roundScore(length: number): number {
  return 100 + 10 * length;
}

/** Score of a hypothetically perfect session (all rounds completed, escalated). */
export function perfectSessionScore(params: PatternTapBackDifficultyParams): number {
  let total = 0;
  for (let round = 0; round < params.rounds; round += 1) {
    const length = Math.min(
      params.initialSequenceLength + round,
      params.maxSequenceLength,
    );
    total += roundScore(length);
  }
  return total;
}

/** Share of rounds completed; 0 when nothing was played (division guard). */
export function accuracyOf(roundsCompleted: number, totalRounds: number): number {
  return totalRounds > 0 ? roundsCompleted / totalRounds : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Length progress for a single round: how far the sequence length has
 * escalated relative to the range [initialSequenceLength, maxSequenceLength],
 * clamped to [0, 1].
 */
export function roundLengthProgress(
  roundLength: number,
  initialSequenceLength: number,
  maxSequenceLength: number,
): number {
  const span = maxSequenceLength - initialSequenceLength;
  if (span <= 0) {
    return roundLength >= maxSequenceLength ? 1 : 0;
  }
  return clamp01((roundLength - initialSequenceLength) / span);
}

/** Average length progress across completed rounds. */
export function avgLengthProgress(
  roundLengths: readonly number[],
  initialSequenceLength: number,
  maxSequenceLength: number,
): number {
  if (roundLengths.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const len of roundLengths) {
    sum += roundLengthProgress(len, initialSequenceLength, maxSequenceLength);
  }
  return sum / roundLengths.length;
}

/** Raw → normalized (see module docs for the formula). */
export function normalizePatternTapBackResult(
  raw: PatternTapBackRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.totalRounds);
  const progress = avgLengthProgress(
    raw.completedRoundLengths,
    raw.initialSequenceLength,
    raw.maxSequenceLength,
  );
  const value = clamp01(accuracy * (0.5 + 0.5 * progress));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Pattern Tap Back game. */
export const patternTapBackPerformanceNormalizer: PerformanceNormalizer<PatternTapBackRawResult> = {
  gameId: GAME_ID,
  normalize: normalizePatternTapBackResult,
};
