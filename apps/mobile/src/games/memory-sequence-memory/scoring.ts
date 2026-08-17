/**
 * Scoring + normalization for the Sequence Memory game.
 *
 * Raw scoring is game-owned; `normalizeSequenceMemoryResult` converts it to
 * the SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw score: 100 points per passed sequence, plus 25 per extra tile past the
 * difficulty's `baseLength` — longer patterns pay more, so the score attack
 * rewards escalation, not just survival.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy        = roundsPassed / roundsPlayed          (0..1)
 *   lengthProgress  = (longestSequence - baseLength)
 *                     / (maxLength - baseLength)           (clamped 0..1)
 *   value           = 0.5 * accuracy + 0.5 * lengthProgress
 *
 * The blend is an equal-weight average of the two player-facing dimensions:
 * how reliably the player repeats patterns, and how far they escalated. A
 * player who never fails short rounds gets accuracy 1 but cannot exceed ~0.5
 * without also climbing, and a lucky climber who fails constantly is dragged
 * down by accuracy. Difficulty itself is deliberately NOT folded into the
 * value — it is recorded on the raw result / diagnostic metadata so the
 * Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { SequenceMemoryDifficultyParams, SequenceMemoryRawResult } from './types';

/** Points for a passed sequence: 100 base + 25 per extra tile past the start. */
export function sequenceScore(length: number, baseLength: number): number {
  return 100 + 25 * Math.max(0, length - baseLength);
}

/**
 * Rounds in the canonical perfect run: one round per length from `baseLength`
 * up to and including `maxLength`. Because the score attack is time-bounded
 * (round count is not fixed), this climb is the deterministic perfect-session
 * definition used by the QA force-perfect hook.
 */
export function perfectClimbRounds(params: SequenceMemoryDifficultyParams): number {
  return params.maxLength - params.baseLength + 1;
}

/** Score of the canonical perfect run (see `perfectClimbRounds`). */
export function perfectSessionScore(params: SequenceMemoryDifficultyParams): number {
  let total = 0;
  for (let length = params.baseLength; length <= params.maxLength; length += 1) {
    total += sequenceScore(length, params.baseLength);
  }
  return total;
}

/** Sum of the perfect run's per-round sequence lengths (taps in the run). */
export function perfectClimbTaps(params: SequenceMemoryDifficultyParams): number {
  return (
    ((params.baseLength + params.maxLength) * perfectClimbRounds(params)) / 2
  );
}

/** Share of rounds passed; 0 when nothing was played (division guard). */
export function accuracyOf(roundsPassed: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? roundsPassed / roundsPlayed : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** Escalation progress relative to the pad ceiling, clamped to [0, 1]. */
export function lengthProgress(
  longestSequence: number,
  baseLength: number,
  maxLength: number,
): number {
  const span = maxLength - baseLength;
  if (span <= 0) {
    return longestSequence >= maxLength ? 1 : 0;
  }
  return clamp01((longestSequence - baseLength) / span);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeSequenceMemoryResult(
  raw: SequenceMemoryRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const progress = lengthProgress(raw.longestSequence, raw.baseLength, raw.maxLength);
  const value = clamp01(0.5 * accuracy + 0.5 * progress);
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Sequence Memory game. */
export const sequenceMemoryPerformanceNormalizer: PerformanceNormalizer<SequenceMemoryRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeSequenceMemoryResult,
};
