/**
 * Scoring + normalization for the Number Line Estimation game.
 *
 * Raw scoring is game-owned; `normalizeNumberLineResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring (documented, deterministic, bounded-error):
 *
 *   toleranceSpan = tolerancePct / 100 × (lineMax − lineMin)
 *   closeness     = clamp01(1 − |estimate − target| / toleranceSpan)
 *   hit           = |estimate − target| ≤ toleranceSpan
 *   roundScore    = hit ? 100 + round(50 × closeness) : 0
 *
 * An estimate inside the tolerance band scores 100–150 by closeness (an exact
 * tap scores 150); an estimate outside the band — and a timeout — scores 0.
 * The error is bounded by construction: the score depends only on the
 * absolute distance to the target relative to the band, never on where on the
 * line the player tapped.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy = roundsHit / roundsPlayed            (0 when nothing resolved)
 *   meanCloseness = mean(closeness over resolved rounds; misses count 0)
 *   value    = accuracy × (0.5 + 0.5 × meanCloseness)
 *
 * Accuracy dominates (did you land in the band at all); closeness rewards
 * precise estimates within it. A perfect session of exact taps reaches 1.0,
 * an all-miss session reaches 0. Difficulty is deliberately NOT folded into
 * the value — it is recorded on the raw result / diagnostic metadata so the
 * Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { NumberLineDifficultyParams, NumberLineRawResult } from './types';

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** Hit tolerance expressed in value units (a span fraction of the line). */
export function toleranceSpan(params: NumberLineDifficultyParams): number {
  return (params.tolerancePct / 100) * (params.lineMax - params.lineMin);
}

/**
 * Closeness of an estimate in [0, 1]: 1 = exact tap, 0 = at/ beyond the
 * tolerance band edge. Negative errors are impossible (absolute distance).
 */
export function closenessOf(absoluteError: number, tolSpan: number): number {
  if (tolSpan <= 0 || !Number.isFinite(tolSpan)) {
    throw new RangeError(`toleranceSpan must be a positive finite number, got ${tolSpan}`);
  }
  return clamp01(1 - Math.abs(absoluteError) / tolSpan);
}

/** True when the estimate lands inside the tolerance band. */
export function isHit(absoluteError: number, tolSpan: number): boolean {
  return Math.abs(absoluteError) <= tolSpan;
}

/** Points for one resolved round: 100 base + up to 50 closeness bonus. */
export function roundScore(absoluteError: number, tolSpan: number): number {
  if (!isHit(absoluteError, tolSpan)) {
    return 0;
  }
  return 100 + Math.round(50 * closenessOf(absoluteError, tolSpan));
}

/** Score of a hypothetically perfect session (every round an exact tap). */
export function perfectSessionScore(params: NumberLineDifficultyParams): number {
  return params.rounds * 150;
}

/** Share of rounds hit; 0 when nothing was played (division guard). */
export function accuracyOf(roundsHit: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? roundsHit / roundsPlayed : 0;
}

/** Mean of a numeric list; null for an empty list. */
export function meanOf(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Mean per-round closeness; 0 when nothing was resolved (division guard). */
export function meanClosenessOf(totalCloseness: number, roundsPlayed: number): number {
  if (roundsPlayed <= 0) {
    return 0;
  }
  return clamp01(totalCloseness / roundsPlayed);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeNumberLineResult(
  raw: NumberLineRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsHit, raw.roundsPlayed);
  const closeness = meanClosenessOf(
    raw.roundsPlayed > 0 ? raw.meanCloseness * raw.roundsPlayed : 0,
    raw.roundsPlayed,
  );
  const value = clamp01(accuracy * (0.5 + 0.5 * closeness));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Number Line Estimation game. */
export const numberLinePerformanceNormalizer: PerformanceNormalizer<NumberLineRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeNumberLineResult,
};
