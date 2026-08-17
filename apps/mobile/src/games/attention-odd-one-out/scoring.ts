/**
 * Scoring + normalization for the Odd One Out game.
 *
 * Raw scoring is game-owned; `normalizeOddOneOutResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring: a passed round awards 100 base points plus a 25-point
 * first-try bonus (no wrong tap in the round); each wrong tap deducts 25
 * points immediately (total score floored at 0); a timed-out round awards 0.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy     = roundsPassed / roundsPlayed                     (0..1)
 *   firstTryRate = firstTryCorrect / roundsPlayed                  (0..1)
 *   speed        = 1 - avgSolveRatio                               (0..1)
 *   value        = accuracy * (0.5 + 0.5 * firstTryRate)
 *                       * (0.5 + 0.5 * speed)                     (0..1)
 *
 * The blend is multiplicative over three facets: accuracy is the base
 * (solving rounds at all), firstTryRate rewards precision (no penalty taps),
 * and speed rewards finding the odd item quickly relative to the round's own
 * window — the raw result's `avgSolveRatio` (per-round solveMs/windowMs,
 * each clamped to [0, 1]) keeps the speed term fair when the window varies
 * between rounds (adaptive mode). Difficulty itself is deliberately NOT
 * folded into the value — it is recorded on the raw result / diagnostic
 * metadata so the Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import type { OddOneOutDifficultyParams, OddOneOutRawResult } from './types';
import { GAME_ID } from './types';

/** Base points for a passed round. */
export const ROUND_POINTS = 100;
/** Bonus when the round is solved on the first tap. */
export const FIRST_TRY_BONUS = 25;
/** Points deducted per wrong tap (total score never goes below 0). */
export const WRONG_TAP_PENALTY = 25;

/** Points for a passed round: base plus the first-try bonus when applicable. */
export function roundPoints(firstTry: boolean): number {
  return ROUND_POINTS + (firstTry ? FIRST_TRY_BONUS : 0);
}

/** Score of a hypothetically perfect session (every round passed first-try). */
export function perfectSessionScore(params: OddOneOutDifficultyParams): number {
  return params.rounds * roundPoints(true);
}

/** Share of rounds solved; 0 when nothing was played (division guard). */
export function accuracyOf(roundsPassed: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? roundsPassed / roundsPlayed : 0;
}

/** Share of rounds solved on the first tap; 0 when nothing was played. */
export function firstTryRateOf(firstTryCorrect: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? firstTryCorrect / roundsPlayed : 0;
}

/** Mean solve-ratio over passed rounds; 0 when none passed (division guard). */
export function avgSolveRatioOf(solveRatioSum: number, roundsPassed: number): number {
  return roundsPassed > 0 ? solveRatioSum / roundsPassed : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** Speed component: 1 = solved instantly, 0 = used the whole window. */
export function speedOf(solveRatioSum: number, roundsPassed: number): number {
  return 1 - avgSolveRatioOf(solveRatioSum, roundsPassed);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeOddOneOutResult(
  raw: OddOneOutRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const firstTry = firstTryRateOf(raw.firstTryCorrect, raw.roundsPlayed);
  // avgSolveRatio is the raw result's authoritative speed input (mean of
  // per-round solveMs/windowMs over passed rounds).
  const speed = 1 - clamp01(raw.avgSolveRatio);
  const value = clamp01(accuracy * (0.5 + 0.5 * firstTry) * (0.5 + 0.5 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Odd One Out game. */
export const oddOneOutPerformanceNormalizer: PerformanceNormalizer<OddOneOutRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeOddOneOutResult,
};
