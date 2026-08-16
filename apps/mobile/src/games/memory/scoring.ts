/**
 * Scoring + normalization for the Memory game.
 *
 * Raw scoring is game-owned; `normalizeMemoryResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy      = roundsPassed / roundsPlayed            (0..1)
 *   lengthProgress = (longestSequence - initialSequenceLength)
 *                    / (gridSize - initialSequenceLength)  (clamped 0..1)
 *   value          = accuracy * (0.5 + 0.5 * lengthProgress)
 *
 * The blend is multiplicative: accuracy is the base, and escalation (how far
 * past the starting length the player got) contributes up to half the value.
 * A player who only passes short rounds cannot reach a high normalized score,
 * and a perfect run on a 4×4 grid reaches 1.0 only when the sequence spans
 * the whole grid. Difficulty itself is deliberately NOT folded into the
 * value — it is recorded on the raw result / diagnostic metadata so the
 * Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { MemoryDifficultyParams, MemoryRawResult } from './types';

/** Points for a passed round: 100 base + 25 per extra tile past the start. */
export function roundScore(length: number, initialSequenceLength: number): number {
  return 100 + 25 * Math.max(0, length - initialSequenceLength);
}

/** Score of a hypothetically perfect session (all rounds passed, escalated). */
export function perfectSessionScore(params: MemoryDifficultyParams): number {
  let total = 0;
  for (let round = 0; round < params.rounds; round += 1) {
    const length = Math.min(params.initialSequenceLength + round, params.gridSize);
    total += roundScore(length, params.initialSequenceLength);
  }
  return total;
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

/** Escalation progress relative to the grid capacity, clamped to [0, 1]. */
export function lengthProgress(
  longestSequence: number,
  initialSequenceLength: number,
  gridSize: number,
): number {
  const span = gridSize - initialSequenceLength;
  if (span <= 0) {
    return longestSequence >= gridSize ? 1 : 0;
  }
  return clamp01((longestSequence - initialSequenceLength) / span);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeMemoryResult(
  raw: MemoryRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const progress = lengthProgress(
    raw.longestSequence,
    raw.initialSequenceLength,
    raw.gridSize,
  );
  const value = clamp01(accuracy * (0.5 + 0.5 * progress));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Memory game. */
export const memoryPerformanceNormalizer: PerformanceNormalizer<MemoryRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeMemoryResult,
};
