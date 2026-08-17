/**
 * Scoring + normalization for the Speed Color Match game.
 *
 * Raw scoring is game-owned; `normalizeSpeedColorMatchResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Scoring rule (documented, deterministic):
 * - 100 points per correct trial + speed bonus (up to +50 for fast responses).
 * - Streak bonus: +10 per streak step.
 * - Normalization: accuracy × (0.4 + 0.3 × speedFactor + 0.3 × streakBonus)
 *
 * Speed factor: maps avgReactionMs into [0,1] where 0ms → 1.0 and
 * stimulusTimeoutMs → 0.0. Faster is better.
 *
 * Streak bonus: bestStreak / totalTrials (0..1).
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { SpeedColorMatchDifficultyParams, SpeedColorMatchRawResult } from './types';

/**
 * Compute the score for a single correct trial.
 * Base 100 + speed bonus (up to 50).
 */
export function trialScore(reactionMs: number, stimulusTimeoutMs: number): number {
  const speedBonus = Math.max(0, 50 * (1 - reactionMs / stimulusTimeoutMs));
  return Math.round(100 + speedBonus);
}

/**
 * Streak bonus: +10 per streak step (consecutive correct trials).
 */
export function streakBonus(streak: number): number {
  return streak * 10;
}

/**
 * Speed factor: maps avgReactionMs into [0,1] where 0ms → 1.0 and
 * stimulusTimeoutMs → 0.0. Clamped to [0, 1].
 */
export function speedFactor(avgReactionMs: number, stimulusTimeoutMs: number): number {
  if (stimulusTimeoutMs <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - avgReactionMs / stimulusTimeoutMs));
}

/**
 * Streak factor: bestStreak / totalTrials (0..1).
 */
export function streakFactor(bestStreak: number, totalTrials: number): number {
  if (totalTrials <= 0) return 0;
  return Math.min(1, bestStreak / totalTrials);
}

/** Share of trials correct; 0 when nothing was played (division guard). */
export function accuracyOf(trialsCorrect: number, trialsPlayed: number): number {
  return trialsPlayed > 0 ? trialsCorrect / trialsPlayed : 0;
}

/** Clamp to [0, 1]; rejects non-finite input. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Raw → normalized (see module docs for the formula).
 * normalization = accuracy × (0.4 + 0.3 × speedFactor + 0.3 × streakBonus)
 */
export function normalizeSpeedColorMatchResult(
  raw: SpeedColorMatchRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.trialsCorrect, raw.trialsPlayed);
  const speed = speedFactor(raw.avgReactionMs, raw.stimulusTimeoutMs);
  const streak = streakFactor(raw.bestStreak, raw.totalTrials);
  const value = clamp01(accuracy * (0.4 + 0.3 * speed + 0.3 * streak));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Speed Color Match game. */
export const speedColorMatchPerformanceNormalizer: PerformanceNormalizer<SpeedColorMatchRawResult> =
  {
    gameId: GAME_ID,
    normalize: normalizeSpeedColorMatchResult,
  };
