/**
 * Scoring + normalization for the Math Missing Operator game.
 *
 * Raw scoring is game-owned; `normalizeMathMissingOperatorResult` converts it
 * to the SDK's canonical `NormalizedPerformance` (scale 0..1) before any
 * shared rating/XP logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy = roundsCorrect / roundsPlayed                (0..1)
 *   speed    = 1 − clamp01(avgResponseMs / baseTimeMs)     (0..1)
 *   value    = accuracy * (0.6 + 0.4 * speed)
 *
 * The blend is multiplicative: accuracy is the base, and answering speed
 * (average response relative to the level's round-0 budget) contributes up to
 * 40% of the value. A player who answers slowly but correctly cannot reach a
 * high normalized score; a perfect run reaches 1.0 only with an instant
 * average response. Difficulty itself is deliberately NOT folded into the
 * value — it is recorded on the raw result / diagnostic metadata so the
 * Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type {
  MathMissingOperatorDifficultyParams,
  MathMissingOperatorRawResult,
  MathMissingOperatorStats,
} from './types';

/**
 * Points for an answered round: 100 base for a correct answer plus a speed
 * bonus of up to 50 (linear in the remaining budget share). Wrong answers and
 * timeouts score 0.
 */
export function roundScore(correct: boolean, responseMs: number, budgetMs: number): number {
  if (!correct) {
    return 0;
  }
  const speed = 1 - clamp01(responseMs / budgetMs);
  return 100 + Math.round(50 * speed);
}

/** Score of a hypothetically perfect session (all rounds correct, instant). */
export function perfectSessionScore(params: MathMissingOperatorDifficultyParams): number {
  return 150 * params.rounds;
}

/** Share of rounds answered correctly; 0 when nothing was played (division guard). */
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

/** Mean response time (ms) over answered rounds; 0 when none answered. */
export function avgResponseMs(stats: MathMissingOperatorStats): number {
  const answered = stats.roundsPlayed - stats.timeouts;
  return answered > 0 ? stats.totalResponseMs / answered : 0;
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeMathMissingOperatorResult(
  raw: MathMissingOperatorRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsCorrect, raw.roundsPlayed);
  const speed = 1 - clamp01(raw.avgResponseMs / raw.baseTimeMs);
  const value = clamp01(accuracy * (0.6 + 0.4 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for this game. */
export const mathMissingOperatorPerformanceNormalizer: PerformanceNormalizer<MathMissingOperatorRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeMathMissingOperatorResult,
};
