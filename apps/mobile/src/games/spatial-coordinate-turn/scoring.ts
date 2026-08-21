/**
 * Scoring + normalization for the Spatial Coordinate Turn game.
 *
 * Raw scoring is game-owned; `normalizeSpatialCoordinateTurnResult` converts
 * it to the SDK's canonical `NormalizedPerformance` (scale 0..1) before any
 * shared rating/XP logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy = correctPicks / roundsPlayed                  (0..1)
 *   speed    = clamp01(1 - averageResponseMs / speedTargetMs)
 *   value    = clamp01(accuracy * (0.7 + 0.3 * speed))
 *
 * Accuracy is the base; speed contributes up to 30%. Difficulty itself is
 * deliberately NOT folded into the value — it is recorded on the raw result /
 * diagnostic metadata so the Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { SpatialCoordinateTurnDifficultyParams, SpatialCoordinateTurnRawResult } from './types';

/** Base points for a correct answer. */
export const BASE_POINTS = 100;
/** Maximum speed bonus for an instant answer. */
export const MAX_SPEED_BONUS = 50;
/** Score of a hypothetically perfect round (base + full speed bonus). */
export const PERFECT_ROUND_SCORE = BASE_POINTS + MAX_SPEED_BONUS;

/** Score for one round. */
export function roundScore(correct: boolean, responseMs: number, speedTargetMs: number): number {
  if (!correct) {
    return 0;
  }
  const speed = clamp01(1 - responseMs / speedTargetMs);
  return BASE_POINTS + Math.round(speed * MAX_SPEED_BONUS);
}

/** Score of a hypothetically perfect session (all rounds correct + fast). */
export function perfectSessionScore(params: SpatialCoordinateTurnDifficultyParams): number {
  return params.rounds * PERFECT_ROUND_SCORE;
}

/** Share of picked rounds that were correct; 0 when nothing was played. */
export function accuracyOf(correctPicks: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? correctPicks / roundsPlayed : 0;
}

/** Speed score in [0, 1]; 1 when answering instantly, 0 when very slow. */
export function speedScoreOf(averageResponseMs: number, speedTargetMs: number): number {
  return clamp01(1 - averageResponseMs / speedTargetMs);
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeSpatialCoordinateTurnResult(
  raw: SpatialCoordinateTurnRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.correctPicks, raw.roundsPlayed);
  const speed = speedScoreOf(raw.averageResponseMs, raw.speedTargetMs);
  const value = clamp01(accuracy * (0.7 + 0.3 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Spatial Coordinate Turn game. */
export const spatialCoordinateTurnPerformanceNormalizer: PerformanceNormalizer<SpatialCoordinateTurnRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeSpatialCoordinateTurnResult,
};
