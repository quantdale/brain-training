/**
 * Scoring + normalization for the Equation Builder game.
 *
 * Raw scoring is game-owned; `normalizeMathEquationBuilderResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy       = roundsPassed / roundsPlayed                (0..1)
 *   avgTimeBonus   = totalTimeBonus / (roundsPlayed * 100)     (0..1)
 *   value          = accuracy × (0.5 + 0.5 × avgTimeBonus)
 *
 * The blend is multiplicative: accuracy is the base, and time bonus (how fast
 * the player solved puzzles) contributes up to half the value.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type {
  MathEquationBuilderDifficultyParams,
  MathEquationBuilderRawResult,
} from './types';

/** Points for a solved puzzle: 200 base + time bonus (up to +100). */
export function puzzleScore(timeRemainingMs: number, timeBudgetMs: number): {
  base: number;
  timeBonus: number;
  total: number;
} {
  const base = 200;
  const ratio = timeBudgetMs > 0 ? timeRemainingMs / timeBudgetMs : 0;
  const timeBonus = Math.round(100 * Math.max(0, Math.min(1, ratio)));
  return { base, timeBonus, total: base + timeBonus };
}

/** Partial credit for a valid but wrong-target equation: 50 points. */
export function partialCreditScore(): number {
  return 50;
}

/** Score of a hypothetically perfect session (all rounds solved with max time bonus). */
export function perfectSessionScore(params: MathEquationBuilderDifficultyParams): number {
  return params.rounds * (200 + 100);
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

/** Average time bonus per round, normalized to [0, 1]. */
export function avgTimeBonus(totalTimeBonus: number, roundsPlayed: number): number {
  if (roundsPlayed <= 0) return 0;
  return clamp01(totalTimeBonus / (roundsPlayed * 100));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeMathEquationBuilderResult(
  raw: MathEquationBuilderRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const timeBonus = avgTimeBonus(raw.totalTimeBonus, raw.roundsPlayed);
  const value = clamp01(accuracy * (0.5 + 0.5 * timeBonus));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Equation Builder game. */
export const mathEquationBuilderPerformanceNormalizer: PerformanceNormalizer<MathEquationBuilderRawResult> =
  {
    gameId: GAME_ID,
    normalize: normalizeMathEquationBuilderResult,
  };
