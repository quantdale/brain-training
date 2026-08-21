/**
 * Scoring + normalization for the Order Sweep game.
 *
 * Raw scoring is game-owned; `normalizeOrderSweepResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring (documented, deterministic):
 *
 *   paceMs(windowMs, count)           = windowMs / count
 *   speedFactor(paceMs, gapMs)        = clamp01((paceMs - gapMs) / paceMs)
 *   correctPoints(paceMs, gapMs)      = 100 + 50 * speedFactor
 *   perfectRoundBonus(count)          = 40 * count  (round swept with zero wrong taps)
 *
 * A token cleared at exactly the average available pace scores 100 points; an
 * instant clear scores up to 150. A perfect round adds 40 points per token.
 *
 * Normalization rule (documented, deterministic):
 *
 *   clearRatio = tokensCleared / totalTokens                (0 when nothing dealt)
 *   meanSpeed  = mean(speedFactor) over cleared tokens      (0 when nothing cleared)
 *   value      = 0.6 * clearRatio + 0.4 * meanSpeed         (clamped 0..1)
 *
 * Clearing the board dominates because the task is completion (did the sweep
 * finish inside the window); meanSpeed rewards fast, confident sweeps. A
 * perfect session with instant clears reaches 1.0, a session that clears
 * nothing reaches 0. Difficulty is deliberately NOT folded into the value —
 * it is recorded on the raw result / diagnostic metadata so the Phase-2
 * rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { OrderSweepDifficultyParams, OrderSweepRawResult } from './types';

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Average wall time available per token in a round. The reference pace the
 * speed factor is measured against.
 */
export function paceMs(windowMs: number, count: number): number {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError(`count must be a positive integer, got ${count}`);
  }
  if (windowMs <= 0 || !Number.isFinite(windowMs)) {
    throw new RangeError(`windowMs must be a positive finite number, got ${windowMs}`);
  }
  return windowMs / count;
}

/**
 * Fraction of the per-token pace left when the token was cleared:
 * 0 = cleared at (or after) the average pace, 1 = cleared instantly.
 */
export function speedFactor(referencePaceMs: number, gapMs: number): number {
  if (referencePaceMs <= 0 || !Number.isFinite(referencePaceMs)) {
    throw new RangeError(
      `referencePaceMs must be a positive finite number, got ${referencePaceMs}`,
    );
  }
  return clamp01((referencePaceMs - gapMs) / referencePaceMs);
}

/** Points for one correct clear: 100 base + up to 50 speed bonus. */
export function correctPoints(referencePaceMs: number, gapMs: number): number {
  return 100 + 50 * speedFactor(referencePaceMs, gapMs);
}

/** Bonus for sweeping a round with every token and zero wrong taps. */
export function perfectRoundBonus(count: number): number {
  return 40 * count;
}

/**
 * Score of a hypothetically perfect session: every token cleared instantly
 * (150 pts) plus the perfect-round bonus (40 pts/token) → 190 pts/token.
 */
export function perfectSessionScore(params: OrderSweepDifficultyParams): number {
  return params.rounds * params.count * 190;
}

/** Share of tokens swept; 0 when nothing was dealt (division guard). */
export function clearRatioOf(tokensCleared: number, totalTokens: number): number {
  return totalTokens > 0 ? tokensCleared / totalTokens : 0;
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

/** Mean per-clear speed factor; 0 when nothing was cleared (division guard). */
export function meanSpeedOf(speedFactors: readonly number[]): number {
  if (speedFactors.length === 0) {
    return 0;
  }
  return clamp01(speedFactors.reduce((sum, value) => sum + value, 0) / speedFactors.length);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeOrderSweepResult(
  raw: OrderSweepRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const clear = clearRatioOf(raw.tokensCleared, raw.totalTokens);
  // The raw result persists the final mean speed (already a clamped-factor
  // mean computed at build time); it does not carry the per-token array.
  const speed = clamp01(raw.meanSpeed);
  const value = clamp01(0.6 * clear + 0.4 * speed);
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Order Sweep game. */
export const orderSweepPerformanceNormalizer: PerformanceNormalizer<OrderSweepRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeOrderSweepResult,
};
