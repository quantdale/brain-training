/**
 * Scoring + normalization for the Reaction Time game.
 *
 * Raw scoring is game-owned; `normalizeSpeedResult` converts it to the SDK's
 * canonical `NormalizedPerformance` (scale 0..1) before any shared rating/XP
 * logic runs.
 *
 * Per-round score (deterministic):
 *
 *   rtMs <= targetMs → 150   (elite reaction)
 *   rtMs <= passMs   → 100   (passed round)
 *   otherwise        → 0     (too slow, false start, or timeout)
 *
 * Normalization rule (documented, deterministic — difficulty-scaled targets):
 *
 *   completion     = validReactions / totalRounds          (0..1)
 *   reactionScore  = clamp01((failMs - median) / (failMs - targetMs))
 *                    — 1 at targetMs or faster, 0 at failMs or slower
 *   falseStartScore = 1 - clamp01(falseStarts / (falseStartBudget + 1))
 *   value          = clamp01(completion * (0.5 + 0.5 * reactionScore) * falseStartScore)
 *
 * The blend is multiplicative: completion is the base (a session ended early
 * by false starts, or riddled with timeouts, cannot score high), reaction
 * speed contributes up to half the value against difficulty-scaled
 * thresholds, and each false start costs up to 1/(budget + 1) of the value.
 * A perfect run — every round reacted at or faster than `targetMs` with zero
 * false starts — reaches exactly 1.0. Difficulty itself is deliberately NOT
 * folded into the value — it is recorded on the raw result / diagnostic
 * metadata so the Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { SpeedDifficultyParams, SpeedRawResult } from './types';

/** Points for a passed round: 100, plus 50 when the reaction was elite. */
export function roundScore(rtMs: number, targetMs: number, passMs: number): number {
  if (rtMs <= targetMs) {
    return 150;
  }
  return rtMs <= passMs ? 100 : 0;
}

/** Score of a hypothetically perfect session (all rounds at target speed). */
export function perfectSessionScore(params: SpeedDifficultyParams): number {
  return params.rounds * 150;
}

/** Median of a reaction list; null when empty (division guard). */
export function medianOf(reactions: readonly number[]): number | null {
  if (reactions.length === 0) {
    return null;
  }
  const sorted = reactions.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Mean of a reaction list; null when empty (division guard). */
export function meanOf(reactions: readonly number[]): number | null {
  if (reactions.length === 0) {
    return null;
  }
  return reactions.reduce((sum, value) => sum + value, 0) / reactions.length;
}

/** Fastest reaction; null when empty. */
export function bestOf(reactions: readonly number[]): number | null {
  if (reactions.length === 0) {
    return null;
  }
  return Math.min(...reactions);
}

/** Share of the session's rounds completed with a valid reaction; 0 guard. */
export function completionOf(validReactions: number, totalRounds: number): number {
  return totalRounds > 0 ? validReactions / totalRounds : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Reaction component: 1 at `targetMs` or faster, 0 at `failMs` or slower,
 * linear in between. No valid reaction scores 0.
 */
export function reactionScore(
  medianReactionMs: number | null,
  targetMs: number,
  failMs: number,
): number {
  if (medianReactionMs === null) {
    return 0;
  }
  const span = failMs - targetMs;
  if (span <= 0) {
    return medianReactionMs <= targetMs ? 1 : 0;
  }
  return clamp01((failMs - medianReactionMs) / span);
}

/**
 * False-start penalty factor: 1 with no false starts, down to 0 at
 * budget + 1 (the point where the session aborts).
 */
export function falseStartScore(falseStarts: number, falseStartBudget: number): number {
  return 1 - clamp01(falseStarts / (falseStartBudget + 1));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeSpeedResult(
  raw: SpeedRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const completion = completionOf(raw.reactions.length, raw.totalRounds);
  const reaction = reactionScore(raw.medianReactionMs, raw.targetMs, raw.failMs);
  const falseStarts = falseStartScore(raw.falseStarts, raw.falseStartBudget);
  const value = clamp01(completion * (0.5 + 0.5 * reaction) * falseStarts);
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Reaction Time game. */
export const speedPerformanceNormalizer: PerformanceNormalizer<SpeedRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeSpeedResult,
};
