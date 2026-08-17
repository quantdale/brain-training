/**
 * Scoring + normalization for the Color Stroop game.
 *
 * Raw scoring is game-owned; `normalizeColorStroopResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy       = correctTrials / trialsPlayed            (0..1)
 *   speedBonus     = clamp((2000 - avgResponseTimeMs) / 1500, 0, 1)  (faster = better)
 *   flipBonus      = postFlipCorrect / max(1, totalFlips)    (0..1)
 *   value          = accuracy * (0.4 + 0.3 * speedBonus + 0.3 * flipBonus)
 *
 * The blend weights accuracy as the primary factor, with speed and rule-tracking
 * (post-flip accuracy) as secondary factors.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { ColorStroopDifficultyParams, ColorStroopRawResult, ColorStroopStats } from './types';

/** Points for a correct trial: 100 base + speed bonus. */
export function trialScore(responseTimeMs: number, isPostFlip: boolean): number {
  const base = 100;
  // Speed bonus: faster responses get more points (up to +50).
  const speedBonus = Math.max(0, Math.min(50, Math.floor((2000 - responseTimeMs) / 40)));
  // Post-flip bonus: correct answers after a rule flip earn extra.
  const flipBonus = isPostFlip ? 25 : 0;
  return base + speedBonus + flipBonus;
}

/** Score of a hypothetically perfect session. */
export function perfectSessionScore(
  params: ColorStroopDifficultyParams,
  totalFlips: number,
): number {
  let total = 0;
  for (let i = 0; i < params.trials; i += 1) {
    const isPostFlip = i > 0 && i % params.flipFrequency === 0;
    total += trialScore(300, isPostFlip); // Perfect speed (300ms)
  }
  return total;
}

/** Share of correct trials; 0 when nothing was played. */
export function accuracyOf(correctTrials: number, trialsPlayed: number): number {
  return trialsPlayed > 0 ? correctTrials / trialsPlayed : 0;
}

/** Clamp to [0, 1]; rejects non-finite input. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** Speed bonus factor: faster responses yield higher values. */
export function speedBonus(avgResponseTimeMs: number): number {
  return clamp01((2000 - avgResponseTimeMs) / 1500);
}

/** Flip bonus factor: correct post-flip trials indicate rule tracking. */
export function flipBonusFactor(postFlipCorrect: number, totalFlips: number): number {
  if (totalFlips <= 0) {
    return 0.5; // Neutral when no flips occurred.
  }
  return clamp01(postFlipCorrect / totalFlips);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeColorStroopResult(
  raw: ColorStroopRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.correctTrials, raw.trialsPlayed);
  const speed = speedBonus(raw.avgResponseTimeMs);
  const flips = flipBonusFactor(raw.postFlipCorrect, Math.floor(raw.totalTrials / 4));
  const value = clamp01(accuracy * (0.4 + 0.3 * speed + 0.3 * flips));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Color Stroop game. */
export const colorStroopPerformanceNormalizer: PerformanceNormalizer<ColorStroopRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeColorStroopResult,
};