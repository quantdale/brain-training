/**
 * Scoring + normalization for the Value Order game.
 *
 * Raw scoring is game-owned; `normalizeValueOrderingResult` converts it to
 * the SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring (documented, deterministic, bounded):
 *
 *   speedFactor = clamp01((budgetMs − elapsedMs) / budgetMs)   [perfect rounds]
 *   roundScore  = perfect ? 100 + round(50 × speedFactor) : 0
 *
 * A perfect round (every tile tapped in ascending order) scores 100–150 by
 * how much of the time budget remained at the final tap; a mistake and a
 * timeout score 0. The score depends only on the remaining-budget fraction,
 * never on which values were on the board.
 *
 * Normalization rule (documented, deterministic; mirrors the catalog family
 * where accuracy dominates and a graded factor rewards quality within
 * successful rounds — Number Line uses closeness, this game uses speed):
 *
 *   accuracy  = roundsHit / roundsPlayed            (0 when nothing resolved)
 *   meanSpeed = mean(speedFactor over resolved rounds; non-perfect count 0)
 *   value     = accuracy × (0.5 + 0.5 × meanSpeed)
 *
 * A perfect session of instant taps reaches 1.0, an all-mistake session
 * reaches 0. Difficulty is deliberately NOT folded into the value — it is
 * recorded on the raw result / diagnostic metadata so the rating pipeline
 * can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { ValueOrderingDifficultyParams, ValueOrderingRawResult } from './types';

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Remaining-budget fraction in [0, 1] after a perfect round: 1 = instant,
 * 0 = exactly at the deadline. Non-positive budgets yield 0.
 */
export function speedFactorOf(elapsedMs: number, budgetMs: number): number {
  if (budgetMs <= 0) {
    return 0;
  }
  return clamp01((budgetMs - elapsedMs) / budgetMs);
}

/** Points for one perfect round: 100 base + up to 50 speed bonus. */
export function roundScore(speedFactor: number): number {
  return 100 + Math.round(50 * clamp01(speedFactor));
}

/** Score of a hypothetically perfect session (every round instant). */
export function perfectSessionScore(params: ValueOrderingDifficultyParams): number {
  return params.rounds * 150;
}

/** Share of rounds ranked perfectly; 0 when nothing was played. */
export function accuracyOf(roundsHit: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? roundsHit / roundsPlayed : 0;
}

/** Mean per-round speed factor; 0 when nothing was resolved (division guard). */
export function meanSpeedFactorOf(totalSpeedFactor: number, roundsPlayed: number): number {
  if (roundsPlayed <= 0) {
    return 0;
  }
  return clamp01(totalSpeedFactor / roundsPlayed);
}

/** Mean progress fraction (correct taps / tiles); diagnostic only. */
export function meanProgressOf(totalProgress: number, roundsPlayed: number): number {
  if (roundsPlayed <= 0) {
    return 0;
  }
  return clamp01(totalProgress / roundsPlayed);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeValueOrderingResult(
  raw: ValueOrderingRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsHit, raw.roundsPlayed);
  const speed = meanSpeedFactorOf(
    raw.roundsPlayed > 0 ? raw.meanSpeedFactor * raw.roundsPlayed : 0,
    raw.roundsPlayed,
  );
  const value = clamp01(accuracy * (0.5 + 0.5 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Value Order game. */
export const valueOrderingPerformanceNormalizer: PerformanceNormalizer<ValueOrderingRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeValueOrderingResult,
};
