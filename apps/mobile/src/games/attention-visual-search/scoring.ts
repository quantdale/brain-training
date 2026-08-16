/**
 * Scoring + normalization for the Visual Search game.
 *
 * Raw scoring is game-owned; `normalizeVisualSearchResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Round score: 100 base points for a passed round plus up to 100 speed bonus
 * proportional to the fraction of the response window left when the target
 * was tapped (instant tap → 200, last-moment tap → 100). Failed rounds score
 * nothing.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy = roundsPassed / roundsPlayed             (0..1)
 *   speed    = mean remaining-window ratio over passed rounds (0..1)
 *   value    = accuracy * (0.5 + 0.5 * speed)          (clamped 0..1)
 *
 * The blend is multiplicative: accuracy is the base, and selection speed
 * contributes up to half the value. A player who only passes rounds at the
 * last moment cannot reach a high normalized score, and a perfect run with
 * instant taps reaches 1.0. Difficulty itself is deliberately NOT folded into
 * the value — it is recorded on the raw result / diagnostic metadata so the
 * Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { VisualSearchDifficultyParams, VisualSearchRawResult } from './types';

/** Base points for a passed round. */
export const BASE_ROUND_POINTS = 100;

/** Maximum speed bonus for a passed round (instant tap). */
export const MAX_SPEED_BONUS = 100;

/** Points for a passed round: base + speed bonus from the window left over. */
export function roundScore(windowMs: number, remainingMs: number): number {
  const ratio = clamp01(windowMs > 0 ? remainingMs / windowMs : 0);
  return BASE_ROUND_POINTS + Math.round(MAX_SPEED_BONUS * ratio);
}

/** Score of a hypothetically perfect session (every round passed instantly). */
export function perfectSessionScore(params: VisualSearchDifficultyParams): number {
  return params.rounds * (BASE_ROUND_POINTS + MAX_SPEED_BONUS);
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

/** Mean remaining-window ratio over passed rounds; 0 when none passed. */
export function avgSpeedRatio(sumResponseRatio: number, roundsPassed: number): number {
  return roundsPassed > 0 ? clamp01(sumResponseRatio / roundsPassed) : 0;
}

/** Mean response time over passed rounds; 0 when none passed. */
export function avgResponseMsOf(sumResponseMs: number, roundsPassed: number): number {
  return roundsPassed > 0 ? sumResponseMs / roundsPassed : 0;
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeVisualSearchResult(
  raw: VisualSearchRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  const speed = clamp01(raw.avgSpeedRatio);
  const value = clamp01(accuracy * (0.5 + 0.5 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Visual Search game. */
export const visualSearchPerformanceNormalizer: PerformanceNormalizer<VisualSearchRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeVisualSearchResult,
};
