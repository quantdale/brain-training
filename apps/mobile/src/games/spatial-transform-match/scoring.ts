/**
 * Scoring + normalization for the Spatial Transform Match game.
 *
 * Raw scoring is game-owned; `normalizeResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy      = roundsPassed / roundsPlayed            (0..1)
 *   speedProgress = 1 - (averageAnswerMs / (sourceRevealMs + 10_000))
 *                   (clamped 0..1, faster answers score higher)
 *   value         = accuracy * (0.7 + 0.3 * speedProgress)
 *
 * The blend is multiplicative: accuracy is the base, and speed contributes up
 * to 30% of the value. Difficulty itself is deliberately NOT folded into the
 * value — it is recorded on the raw result / diagnostic metadata so the
 * Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { SpatialTransformMatchDifficultyParams, SpatialTransformMatchRawResult } from './types';

/** Points for a correct answer: 100 base. */
export const CORRECT_POINTS = 100;

/** Points for a correct answer. */
export function roundScore(): number {
  return CORRECT_POINTS;
}

/** Score of a hypothetically perfect session (all rounds correct). */
export function perfectSessionScore(params: SpatialTransformMatchDifficultyParams): number {
  return params.rounds * CORRECT_POINTS;
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

/**
 * Speed progress: 1 when answering instantly, 0 when answering extremely
 * slowly. The denominator caps the scale so very slow answers don't go
 * negative.
 */
export function speedProgress(averageAnswerMs: number, sourceRevealMs: number): number {
  const maxMs = sourceRevealMs + 10_000;
  return clamp01(1 - averageAnswerMs / maxMs);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeResult(
  raw: SpatialTransformMatchRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const speed = speedProgress(raw.averageAnswerMs, raw.sourceRevealMs);
  const value = clamp01(accuracy * (0.7 + 0.3 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Spatial Transform Match game. */
export const spatialTransformMatchPerformanceNormalizer: PerformanceNormalizer<SpatialTransformMatchRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeResult,
};
