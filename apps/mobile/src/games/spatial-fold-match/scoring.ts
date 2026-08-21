/**
 * Scoring + normalization for the Spatial Fold Match game.
 *
 * Raw scoring is game-owned; `normalizeSpatialFoldMatchResult` converts it to
 * the SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring rule (documented, deterministic):
 *   round score = correct ? 100 + 50 * clamp01(1 - answerMs / speedTargetMs) : 0
 *   (faster correct answers earn up to a 50-point speed bonus)
 *
 * Normalization rule (documented, deterministic):
 *   accuracy   = roundsPassed / roundsPlayed            (0..1)
 *   speedScore = clamp01(1 - averageAnswerMs / (sourceRevealMs + 10_000))
 *   value      = clamp01(accuracy * (0.7 + 0.3 * speedScore))
 *
 * Difficulty itself is deliberately NOT folded into the value — it is recorded
 * on the raw result / diagnostic metadata so the Phase-2 rating pipeline can
 * weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { SpatialFoldMatchDifficultyParams, SpatialFoldMatchRawResult } from './types';

/** Base points for a correct answer. */
export const CORRECT_POINTS = 100;

/** Max speed bonus for a fast correct answer. */
export const SPEED_BONUS = 50;

/** Max raw points available per round. */
export const MAX_ROUND_SCORE = CORRECT_POINTS + SPEED_BONUS;

/** Raw score for a single answer. */
export function roundScore(correct: boolean, answerMs: number, speedTargetMs: number): number {
  if (!correct) {
    return 0;
  }
  return CORRECT_POINTS + SPEED_BONUS * clamp01(1 - answerMs / speedTargetMs);
}

/** Score of a hypothetically perfect session (all rounds fast-correct). */
export function perfectSessionScore(params: SpatialFoldMatchDifficultyParams): number {
  return params.rounds * MAX_ROUND_SCORE;
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
 * Speed score: 1 when answering instantly, 0 when answering extremely slowly.
 * The denominator caps the scale so very slow answers don't go negative.
 */
export function speedScoreOf(averageAnswerMs: number, speedTargetMs: number): number {
  return clamp01(1 - averageAnswerMs / speedTargetMs);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeSpatialFoldMatchResult(
  raw: SpatialFoldMatchRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const speedScore = speedScoreOf(raw.averageAnswerMs, raw.sourceRevealMs + 10_000);
  // Algebraically identical to `accuracy * (0.7 + 0.3 * speedScore)` but free
  // of float dust at the boundaries (perfect play normalizes to exactly 1).
  const value = clamp01(accuracy - 0.3 * accuracy * (1 - speedScore));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Spatial Fold Match game. */
export const spatialFoldMatchPerformanceNormalizer: PerformanceNormalizer<SpatialFoldMatchRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeSpatialFoldMatchResult,
};
