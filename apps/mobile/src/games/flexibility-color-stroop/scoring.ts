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
 *
 * Raw POINT scoring (campaign 014, scoringVersion 1.3.0):
 *
 *   trialScore     = 100 base
 *                  + round(MAX_SPEED_BONUS_POINTS × clamp01((stimulusMs - rt) / stimulusMs))
 *                  + 25 when the trial is a correct post-flip answer
 *
 * The speed bonus is normalized against the LEVEL'S OWN stimulus window
 * (`params.stimulusMs`), so an instant answer earns the full +50 and an answer
 * at the window edge earns +0 on EVERY difficulty. (The previous formula,
 * `(2000 - ms) / 40`, silently assumed a fixed 2000 ms window — expert's
 * 1000 ms window made levels incomparable.) `perfectSessionScore` derives from
 * the same formula at `PERFECT_RESPONSE_MS`, keeping QA force-win totals and
 * session arithmetic coherent across difficulties.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { ColorStroopDifficultyParams, ColorStroopRawResult } from './types';

/** Maximum speed-bonus points awarded on top of the 100-point base. */
export const MAX_SPEED_BONUS_POINTS = 50;

/**
 * Canonical reference response time (ms) of a "perfect" trial — the constant
 * `perfectSessionScore` plugs into `trialScore`. It is a REFERENCE pace for
 * perfect-round arithmetic, not a cap: faster real answers simply score more.
 */
export const PERFECT_RESPONSE_MS = 300;

/**
 * Speed-bonus points for one trial, normalized against the level's stimulus
 * window: `MAX_SPEED_BONUS_POINTS × clamp01((stimulusMs - rt) / stimulusMs)`.
 * Instant (rt = 0) → full bonus; rt ≥ window → 0. Throws on a non-positive
 * window rather than silently inverting the ratio.
 */
export function speedBonusPoints(responseTimeMs: number, stimulusMs: number): number {
  if (!Number.isFinite(stimulusMs) || stimulusMs <= 0) {
    throw new RangeError(`stimulusMs must be a positive finite number, got ${stimulusMs}`);
  }
  const ratio = clamp01((stimulusMs - responseTimeMs) / stimulusMs);
  return Math.round(MAX_SPEED_BONUS_POINTS * ratio);
}

/** Points for a correct trial: 100 base + speed bonus; post-flip answers earn extra. */
export function trialScore(
  responseTimeMs: number,
  stimulusMs: number,
  isPostFlip: boolean,
): number {
  const base = 100;
  const speedBonus = speedBonusPoints(responseTimeMs, stimulusMs);
  // Post-flip bonus: correct answers after a rule flip earn extra.
  const flipBonus = isPostFlip ? 25 : 0;
  return base + speedBonus + flipBonus;
}

/** Score of a hypothetically perfect session (perfect reference RT every trial). */
export function perfectSessionScore(
  params: ColorStroopDifficultyParams,
  totalFlips: number,
): number {
  let total = 0;
  for (let i = 0; i < params.trials; i += 1) {
    const isPostFlip = i > 0 && i % params.flipFrequency === 0;
    // Same formula as live play at the canonical reference RT, so session
    // totals stay arithmetically coherent with per-trial scoring on EVERY
    // difficulty's stimulus window.
    total += trialScore(PERFECT_RESPONSE_MS, params.stimulusMs, isPostFlip);
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

/**
 * Speed bonus factor for NORMALIZATION (0..1): faster average responses yield
 * higher values. Session-level diagnostic blend — deliberately independent of
 * the per-trial points formula above (changing this alters rating math).
 */
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
  // The flip denominator is the session's ACTUAL number of rule-flip trials.
  // Records persisted before `totalFlips` existed fall back to the legacy
  // floor(totalTrials / 4) estimate.
  const flips = flipBonusFactor(raw.postFlipCorrect, raw.totalFlips ?? Math.floor(raw.totalTrials / 4));
  const value = clamp01(accuracy * (0.4 + 0.3 * speed + 0.3 * flips));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Color Stroop game. */
export const colorStroopPerformanceNormalizer: PerformanceNormalizer<ColorStroopRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeColorStroopResult,
};