/**
 * Scoring + normalization for the Fast Math game.
 *
 * Raw scoring is game-owned; `normalizeMathResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Raw scoring: each problem is worth 100 base points plus a speed bonus of up
 * to 50 points that decays linearly with the response time — an instant
 * answer earns 150, an answer at the budget boundary earns 100, and anything
 * past the budget is scored as a timeout (0 points). Untimed sessions
 * (budgetMs ≤ 0) pay a flat 100 per correct answer.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy   = problemsCorrect / problemsPlayed        (0..1)
 *   speed      = 1 − avgCorrectMs / timeBudgetMs         (0..1; 1 = instant,
 *               0 = answered at/after the budget; 1 when untimed, 0 when no
 *               correct answer exists)
 *   value      = accuracy × (0.5 + 0.5 × speed)
 *
 * The blend is multiplicative, mirroring the Memory game: accuracy is the
 * base, and speed contributes up to half the value. A player who only wins
 * slowly cannot reach a high normalized score, and a perfect run reaches 1.0
 * only with instant responses. Difficulty itself is deliberately NOT folded
 * into the value — it is recorded on the raw result / diagnostic metadata so
 * the Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { MathDifficultyParams, MathRawResult } from './types';

/** Base points per correct answer. */
export const BASE_PROBLEM_POINTS = 100;

/** Max speed bonus per correct answer (reached only at instant responses). */
export const SPEED_BONUS_POINTS = 50;

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Points for one correct answer. `budgetMs <= 0` means untimed (flat base).
 * The response time is the active-only elapsed ms at submit; answers past the
 * budget never reach this function (they are scored as timeouts).
 */
export function problemScore(elapsedMs: number, budgetMs: number): number {
  if (budgetMs <= 0) {
    return BASE_PROBLEM_POINTS;
  }
  const speed = clamp01(1 - elapsedMs / budgetMs);
  return BASE_PROBLEM_POINTS + Math.round(SPEED_BONUS_POINTS * speed);
}

/** Score of a hypothetically perfect session (all problems, instant answers). */
export function perfectSessionScore(params: MathDifficultyParams): number {
  return params.rounds * (BASE_PROBLEM_POINTS + SPEED_BONUS_POINTS);
}

/** Share of problems answered correctly; 0 when nothing was played. */
export function accuracyOf(problemsCorrect: number, problemsPlayed: number): number {
  return problemsPlayed > 0 ? problemsCorrect / problemsPlayed : 0;
}

/**
 * Speed factor in [0, 1]: 1 minus the average correct response time as a
 * fraction of the budget. 1 when untimed (no time pressure), 0 when there is
 * no correct answer to measure.
 */
export function speedFactor(avgCorrectMs: number | null, budgetMs: number): number {
  if (budgetMs <= 0) {
    return 1;
  }
  if (avgCorrectMs === null) {
    return 0;
  }
  return clamp01(1 - avgCorrectMs / budgetMs);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeMathResult(
  raw: MathRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.problemsCorrect, raw.problemsPlayed);
  const speed = speedFactor(raw.avgCorrectMs, raw.timeBudgetMs);
  const value = clamp01(accuracy * (0.5 + 0.5 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Fast Math game. */
export const mathPerformanceNormalizer: PerformanceNormalizer<MathRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeMathResult,
};
