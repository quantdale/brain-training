/**
 * Scoring + normalization for the Tap Rush game.
 *
 * Raw scoring is game-owned; `normalizeTapRushResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Raw scoring (documented, deterministic):
 *
 *   speedFactor(windowMs, reactionMs) = clamp01((windowMs - reactionMs) / windowMs)
 *   hitPoints(windowMs, reactionMs)   = 100 + 50 * speedFactor
 *   perfectRoundBonus(count)          = 50 * count   (a round with zero misses)
 *
 * A tap at the last instant scores 100 points; an instant tap scores up to
 * 150. A perfect round adds 50 points per target.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy  = targetsHit / (targetsHit + targetsMissed)   (0 when nothing resolved)
 *   meanSpeed = mean(speedFactor) over hits                 (0 when no hits)
 *   value     = 0.6 * accuracy + 0.4 * meanSpeed            (clamped 0..1)
 *
 * Accuracy dominates because the task is completion (did the target get hit);
 * meanSpeed rewards fast taps inside the window. A perfect session with
 * instant reactions reaches 1.0, an all-miss session reaches 0. Difficulty is
 * deliberately NOT folded into the value — it is recorded on the raw result /
 * diagnostic metadata so the Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { TapRushDifficultyParams, TapRushRawResult } from './types';

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Fraction of the window the player had left when tapping:
 * 0 = tapped exactly at the deadline, 1 = tapped instantly.
 */
export function speedFactor(windowMs: number, reactionMs: number): number {
  if (windowMs <= 0 || !Number.isFinite(windowMs)) {
    throw new RangeError(`windowMs must be a positive finite number, got ${windowMs}`);
  }
  return clamp01((windowMs - reactionMs) / windowMs);
}

/** Points for one hit: 100 base + up to 50 speed bonus. */
export function hitPoints(windowMs: number, reactionMs: number): number {
  return 100 + 50 * speedFactor(windowMs, reactionMs);
}

/** Bonus for finishing a round with every target hit. */
export function perfectRoundBonus(count: number): number {
  return 50 * count;
}

/**
 * Score of a hypothetically perfect session: every target hit instantly
 * (150 pts) plus the perfect-round bonus (50 pts/target) → 200 pts/target.
 */
export function perfectSessionScore(params: TapRushDifficultyParams): number {
  return params.rounds * params.count * 200;
}

/** Share of targets hit; 0 when nothing was resolved (division guard). */
export function accuracyOf(targetsHit: number, targetsMissed: number): number {
  const resolved = targetsHit + targetsMissed;
  return resolved > 0 ? targetsHit / resolved : 0;
}

/** Mean of a numeric list; null for an empty list. */
export function meanOf(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Minimum of a numeric list; null for an empty list. */
export function bestOf(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.min(...values);
}

/** Mean per-hit speed factor; 0 when no hit was recorded (division guard). */
export function meanSpeedOf(speedFactors: readonly number[]): number {
  if (speedFactors.length === 0) {
    return 0;
  }
  return clamp01(speedFactors.reduce((sum, value) => sum + value, 0) / speedFactors.length);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeTapRushResult(
  raw: TapRushRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.targetsHit, raw.targetsMissed);
  const speed = meanSpeedOf(raw.speedFactors);
  const value = clamp01(0.6 * accuracy + 0.4 * speed);
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Tap Rush game. */
export const tapRushPerformanceNormalizer: PerformanceNormalizer<TapRushRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeTapRushResult,
};
