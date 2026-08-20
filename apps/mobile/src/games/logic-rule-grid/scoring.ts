/**
 * Scoring + normalization for the Rule Grid game.
 *
 * Raw scoring is game-owned; `normalizeRuleGridResult` converts it to the SDK's
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
 * the value. A player who solves every round but slowly cannot reach a high
 * normalized score. Difficulty itself is deliberately NOT folded into the
 * value — it is recorded on the raw result / diagnostic metadata so the
 * Phase-2 rating pipeline can weight it.
 *
 * Points:
 *   - Correct round: 100 base + size * 10 bonus (bigger grids are worth more).
 *   - Wrong/timeout round: 0 points.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { RuleGridDifficultyParams, RuleGridRawResult } from './types';

/** Points for a round: 100 base + size*10 for a correct answer, 0 otherwise. */
export function roundScore(correct: boolean, size: number): number {
  return correct ? 100 + size * 10 : 0;
}

/** Score of a hypothetically perfect session (every round correct). */
export function perfectSessionScore(params: RuleGridDifficultyParams): number {
  return params.rounds * (100 + params.size * 10);
}

/** Share of rounds answered correctly; 0 when nothing was played (guard). */
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
 * instantly (relative to the budget); 0.0 means all budget was consumed.
 */
export function efficiency(totalElapsedMs: number, totalBudgetMs: number): number {
  if (totalBudgetMs <= 0) {
    return 0;
  }
  return clamp01(1 - totalElapsedMs / totalBudgetMs);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeRuleGridResult(
  raw: RuleGridRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const acc = accuracyOf(raw.roundsCorrect, raw.roundsPlayed);
  const eff = efficiency(raw.totalElapsedMs, raw.totalBudgetMs);
  const value = clamp01(acc * (0.5 + 0.5 * eff));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Rule Grid game. */
export const ruleGridPerformanceNormalizer: PerformanceNormalizer<RuleGridRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeRuleGridResult,
};
