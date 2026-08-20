/**
 * Scoring + normalization for the Target Count game.
 *
 * Raw scoring is game-owned; `normalizeTargetCountResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy        = roundsCorrect / roundsPlayed            (0..1)
 *   efficiency      = 1 - (totalElapsedMs / totalBudgetMs)    (0..1, clamped)
 *   value           = accuracy * (0.5 + 0.5 * efficiency)
 *
 * The blend is multiplicative: accuracy is the base, and efficiency (how
 * quickly the player answered relative to the budget) contributes up to half
 * the value. A player who counts everything correctly but dawdles cannot reach
 * a high normalized score. Difficulty itself is deliberately NOT folded into
 * the value — it is recorded on the raw result / diagnostic metadata so the
 * Phase-2 rating pipeline can weight it.
 *
 * Points per round:
 *   - Correct: 100 base + speed bonus up to 100 (faster = more).
 *   - Wrong/timeout: 0.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { TargetCountDifficultyParams, TargetCountRawResult } from './types';

/** Points for a correct round: 100 base + up to 100 speed bonus. */
export function roundScore(correct: boolean, roundTimeMs: number, elapsedMs: number): number {
  if (!correct) {
    return 0;
  }
  const speedBonus = Math.max(0, Math.round(((roundTimeMs - elapsedMs) / roundTimeMs) * 100));
  return 100 + speedBonus;
}

/** Score of a hypothetically perfect session (every round correct + instant). */
export function perfectSessionScore(params: TargetCountDifficultyParams): number {
  return params.rounds * 200;
}

/** Share of rounds counted correctly; 0 when nothing was played (division guard). */
export function accuracyOf(roundsCorrect: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? roundsCorrect / roundsPlayed : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Efficiency relative to the time budget. 1.0 means every round was answered
 * instantly; 0.0 means the full budget was always used (or exceeded).
 */
export function efficiency(totalElapsedMs: number, totalBudgetMs: number): number {
  if (totalBudgetMs <= 0) {
    return 0;
  }
  return clamp01(1 - totalElapsedMs / totalBudgetMs);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeTargetCountResult(
  raw: TargetCountRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const acc = accuracyOf(raw.roundsCorrect, raw.roundsPlayed);
  const eff = efficiency(raw.totalElapsedMs, raw.totalBudgetMs);
  const value = clamp01(acc * (0.5 + 0.5 * eff));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Target Count game. */
export const targetCountPerformanceNormalizer: PerformanceNormalizer<TargetCountRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeTargetCountResult,
};
