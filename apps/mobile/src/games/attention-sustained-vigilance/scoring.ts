/**
 * Scoring + normalization for the Sustained Vigilance game.
 *
 * Raw scoring is game-owned; `normalizeVigilanceResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring (documented, deterministic, bounded-error):
 *
 *   speedFactor = clamp01(1 − (rt − rtTargetMs) / (rtFailMs − rtTargetMs))
 *   hit         = go trial answered inside the window
 *   hitScore    = 100 + round(50 × speedFactor)      (100–150 by speed)
 *   holdScore   = 120                                 (correct withhold)
 *   omission    = 0                                   (missed go trial)
 *   commission  = −80                                 (tapped a stop digit)
 *
 * The running score never goes below zero (`applyScoreDelta` floors at 0), so
 * a bad stretch cannot produce negative totals; commissions still hurt via
 * the normalization's hold-accuracy term. Reaction times only ever come from
 * the monotonic active-time clock, so pausing cannot inflate speed marks.
 *
 * Normalization rule (documented, deterministic):
 *
 *   goAccuracy  = hits / (hits + omissions)          (0 when no go trial)
 *   holdAccuracy= correctHolds / (correctHolds + commissions)
 *   meanSpeed   = mean(speedFactor over hits)        (0 when no hit)
 *   value       = clamp01(0.5·goAccuracy + 0.3·holdAccuracy + 0.2·meanSpeed)
 *
 * Weights: sustained responding dominates (0.5), correct inhibition on rare
 * targets is the signature skill (0.3), and response speed breaks ties
 * (0.2). A perfect session — every go trial hit fast, every target held —
 * reaches exactly 1.0; an all-commission/all-omission session reaches 0.
 * Difficulty is deliberately NOT folded into the value — it is recorded on
 * the raw result / diagnostic metadata so the rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { VigilanceDifficultyParams, VigilanceRawResult } from './types';

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Speed factor of a reaction time in [0, 1]: 1 at/below `rtTargetMs`, 0 at/
 * above `rtFailMs`, linear in between.
 */
export function speedFactorOf(rtMs: number, params: VigilanceDifficultyParams): number {
  const span = params.rtFailMs - params.rtTargetMs;
  if (span <= 0 || !Number.isFinite(span)) {
    throw new RangeError(`rtFailMs - rtTargetMs must be a positive finite number, got ${span}`);
  }
  return clamp01(1 - (rtMs - params.rtTargetMs) / span);
}

/** Points for one valid go-trial response: 100 base + up to 50 speed bonus. */
export function hitScore(rtMs: number, params: VigilanceDifficultyParams): number {
  return 100 + Math.round(50 * speedFactorOf(rtMs, params));
}

/** Points for one correctly withheld target trial. */
export const HOLD_SCORE = 120;

/** Points subtracted for tapping a stop-digit trial (commission). */
export const COMMISSION_PENALTY = 80;

/**
 * Fold a signed delta into the running score, floored at zero so the total
 * can never go negative.
 */
export function applyScoreDelta(score: number, delta: number): number {
  return Math.max(0, score + delta);
}

/** Score of a hypothetically perfect session (fastest hits + all holds). */
export function perfectSessionScore(
  params: VigilanceDifficultyParams,
  targetCount: number,
): number {
  return (params.trials - targetCount) * 150 + targetCount * HOLD_SCORE;
}

/** Share of go trials hit; 0 when no go trial was resolved (division guard). */
export function goAccuracyOf(hits: number, omissions: number): number {
  const goTrials = hits + omissions;
  return goTrials > 0 ? hits / goTrials : 0;
}

/** Share of target trials held; 0 when no target was resolved. */
export function holdAccuracyOf(correctHolds: number, commissions: number): number {
  const targetTrials = correctHolds + commissions;
  return targetTrials > 0 ? correctHolds / targetTrials : 0;
}

/**
 * Overall trial accuracy on the shared analytics scale: correct trials
 * (hits + correct holds) over all played trials; 0 when nothing was played.
 */
export function overallAccuracyOf(
  hits: number,
  correctHolds: number,
  trialsPlayed: number,
): number {
  return trialsPlayed > 0 ? (hits + correctHolds) / trialsPlayed : 0;
}

/** Mean of a numeric list; null for an empty list. */
export function meanOf(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Mean per-hit speed factor; 0 when there were no hits (division guard). */
export function meanSpeedOf(totalSpeed: number, hits: number): number {
  if (hits <= 0) {
    return 0;
  }
  return clamp01(totalSpeed / hits);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeVigilanceResult(
  raw: VigilanceRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const goAccuracy = goAccuracyOf(raw.hits, raw.omissions);
  const holdAccuracy = holdAccuracyOf(raw.correctHolds, raw.commissions);
  const meanSpeed = meanSpeedOf(
    raw.meanSpeed * raw.hits,
    raw.hits,
  );
  const value = clamp01(0.5 * goAccuracy + 0.3 * holdAccuracy + 0.2 * meanSpeed);
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Sustained Vigilance game. */
export const vigilancePerformanceNormalizer: PerformanceNormalizer<VigilanceRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeVigilanceResult,
};
