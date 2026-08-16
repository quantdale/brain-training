/**
 * Scoring + normalization for the Mental Rotation game.
 *
 * Raw scoring is game-owned; `normalizeSpatialResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy = roundsPassed / roundsPlayed                 (0..1)
 *   speed    = totalRemainingMs / totalBudgetMs            (0..1, clamped)
 *              — average share of the time budget left over
 *                across all played rounds (timeouts count 0 remaining)
 *   value    = accuracy * (0.5 + 0.5 * speed)
 *
 * The blend is multiplicative: accuracy is the base, and pacing (answering
 * fast, relative to each round's budget) contributes up to half the value.
 * A player who passes every round but always burns the full budget reaches
 * only 0.5; an instant perfect run reaches 1.0. Difficulty is deliberately
 * NOT folded into the value — it is recorded on the raw result / diagnostic
 * metadata so the Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { SpatialDifficultyParams, SpatialRawResult } from './types';

/**
 * Points for a passed round: 100 base + up to 50 speed bonus proportional to
 * the remaining budget share. Timeouts and wrong answers score 0.
 */
export function roundScore(timeBudgetMs: number, remainingMs: number): number {
  if (!Number.isFinite(timeBudgetMs) || timeBudgetMs <= 0) {
    throw new RangeError(`timeBudgetMs must be a positive finite number, got ${timeBudgetMs}`);
  }
  return 100 + Math.round(50 * clamp01(remainingMs / timeBudgetMs));
}

/**
 * Score of a hypothetically perfect session (every round passed instantly:
 * full remaining budget → 150 per round).
 */
export function perfectSessionScore(params: SpatialDifficultyParams): number {
  return 150 * params.rounds;
}

/** Share of rounds passed; 0 when nothing was played (division guard). */
export function accuracyOf(roundsPassed: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? roundsPassed / roundsPlayed : 0;
}

/** Average remaining-budget share across played rounds, 0..1 (division guard). */
export function speedOf(totalRemainingMs: number, totalBudgetMs: number): number {
  return totalBudgetMs > 0 ? clamp01(totalRemainingMs / totalBudgetMs) : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeSpatialResult(
  raw: SpatialRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const speed = speedOf(raw.totalRemainingMs, raw.totalBudgetMs);
  const value = clamp01(accuracy * (0.5 + 0.5 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Mental Rotation game. */
export const spatialPerformanceNormalizer: PerformanceNormalizer<SpatialRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeSpatialResult,
};
