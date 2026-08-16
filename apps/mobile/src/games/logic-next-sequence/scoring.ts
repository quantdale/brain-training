/**
 * Scoring + normalization for the Next in Sequence game.
 *
 * Raw scoring is game-owned; `normalizeLogicResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Round score (documented, deterministic):
 *
 *   correct  → 100 base + up to 50 speed bonus
 *   speed    = clamp01(referenceMs / responseMs)     (≤ 1, so answering at
 *              or faster than the reference earns the full bonus; responseMs
 *              ≤ 0 counts as instantaneous)
 *   wrong    → 0
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy = roundsPassed / roundsPlayed                  (0..1)
 *   speed    = clamp01(targetMs / max(targetMs, totalMs))   (0..1; session
 *              responses vs the accumulated per-round reference times; 0
 *              elapsed time counts as perfect speed)
 *   value    = accuracy * (0.6 + 0.4 * speed)
 *
 * The blend is multiplicative: accuracy is the base and speed contributes up
 * to 40% of the value, so a slow-but-correct session cannot reach a high
 * score and a fast-but-wrong session cannot either. Difficulty itself is
 * deliberately NOT folded into the value — it is recorded on the raw result /
 * diagnostic metadata so the Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { LogicDifficultyParams, LogicRawResult } from './types';

/** Speed factor of one round; ≤ 1 (instant or faster-than-reference = 1). */
export function speedFactor(responseMs: number, referenceMs: number): number {
  if (responseMs <= 0) {
    return 1;
  }
  return clamp01(referenceMs / responseMs);
}

/**
 * Points for an answered round: 100 base plus up to 50 speed bonus scaled by
 * how close the response was to the reference time. Wrong answers earn 0.
 */
export function roundScore(
  responseMs: number,
  referenceMs: number,
  correct: boolean,
): number {
  if (!correct) {
    return 0;
  }
  return 100 + Math.round(50 * speedFactor(responseMs, referenceMs));
}

/** Score of a hypothetically perfect session (all rounds, max speed bonus). */
export function perfectSessionScore(params: LogicDifficultyParams): number {
  return params.rounds * 150;
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
 * Session speed: total responses vs the accumulated reference times.
 * 0 elapsed time (e.g. QA-forced sessions) counts as perfect speed.
 */
export function sessionSpeed(targetMs: number, totalMs: number): number {
  if (totalMs <= 0) {
    return 1;
  }
  return clamp01(targetMs / Math.max(targetMs, totalMs));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeLogicResult(
  raw: LogicRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const speed = sessionSpeed(raw.targetMs, raw.totalMs);
  const value = clamp01(accuracy * (0.6 + 0.4 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the game. */
export const logicPerformanceNormalizer: PerformanceNormalizer<LogicRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeLogicResult,
};
