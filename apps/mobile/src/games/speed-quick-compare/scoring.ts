/**
 * Scoring + normalization for the Quick Compare game.
 *
 * Raw scoring is game-owned; `normalizeQuickCompareResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring (documented, deterministic):
 *
 *   answerSpeed(windowMs, reactionMs) = clamp01((windowMs - reactionMs) / windowMs)
 *   correctPoints(windowMs, reactionMs) = 100 + 50 * answerSpeed
 *
 * An instant correct answer scores 150; an answer at the deadline scores 100;
 * an incorrect/timeout answer scores 0. Reaction time is the monotonic clock
 * delta from round start to answer; render latency is never measured.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy = roundsCorrect / roundsTotal         (0 when nothing resolved)
 *   speed    = mean(answerSpeed) over answered rounds (0 when none answered)
 *   value    = accuracy × (0.5 + 0.5 × speed)
 *
 * Accuracy dominates (did you pick the right relationship); speed rewards
 * fast, confident answers inside the window. A perfect, instant session
 * reaches 1.0, an all-miss session reaches 0. Difficulty is deliberately NOT
 * folded into the value — it is recorded on the raw result / diagnostic
 * metadata so the Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { QuickCompareDifficultyParams, QuickCompareRawResult, QuickCompareStats } from './types';

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/**
 * Fraction of the window the player had left when answering:
 * 0 = answered exactly at the deadline, 1 = answered instantly.
 */
export function answerSpeed(windowMs: number, reactionMs: number): number {
  if (windowMs <= 0 || !Number.isFinite(windowMs)) {
    throw new RangeError(`windowMs must be a positive finite number, got ${windowMs}`);
  }
  return clamp01((windowMs - reactionMs) / windowMs);
}

/** Points for one correct answer: 100 base + up to 50 speed bonus. */
export function correctPoints(windowMs: number, reactionMs: number): number {
  return 100 + 50 * answerSpeed(windowMs, reactionMs);
}

/** Score of a hypothetically perfect session (all rounds, instant answers). */
export function perfectSessionScore(params: QuickCompareDifficultyParams): number {
  return params.rounds * 150;
}

/** Share of rounds answered correctly; 0 when nothing was played. */
export function accuracyOf(roundsCorrect: number, roundsTotal: number): number {
  return roundsTotal > 0 ? roundsCorrect / roundsTotal : 0;
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

/** Mean per-answer speed factor; 0 when nothing was answered. */
export function meanSpeedOf(speedFactors: readonly number[]): number {
  if (speedFactors.length === 0) {
    return 0;
  }
  return clamp01(
    speedFactors.reduce((sum, value) => sum + value, 0) / speedFactors.length,
  );
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeQuickCompareResult(
  raw: QuickCompareRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsCorrect, raw.roundsTotal);
  const speed = meanSpeedOf(raw.speedFactors);
  const value = clamp01(accuracy * (0.5 + 0.5 * speed));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Quick Compare game. */
export const quickComparePerformanceNormalizer: PerformanceNormalizer<QuickCompareRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeQuickCompareResult,
};

/** Helper used by the reducer to fold a round's outcome into the stats. */
export function applyRoundOutcome(
  stats: QuickCompareStats,
  outcome: 'correct' | 'incorrect' | 'miss',
  windowMs: number,
  reactionMs: number,
): QuickCompareStats {
  if (outcome === 'correct') {
    const factor = answerSpeed(windowMs, reactionMs);
    const streak = stats.streak + 1;
    return {
      ...stats,
      score: stats.score + correctPoints(windowMs, reactionMs),
      roundsCorrect: stats.roundsCorrect + 1,
      reactions: [...stats.reactions, reactionMs],
      speedFactors: [...stats.speedFactors, factor],
      bestStreak: Math.max(stats.bestStreak, streak),
      streak,
    };
  }
  if (outcome === 'incorrect') {
    const factor = answerSpeed(windowMs, reactionMs);
    return {
      ...stats,
      roundsWrong: stats.roundsWrong + 1,
      reactions: [...stats.reactions, reactionMs],
      speedFactors: [...stats.speedFactors, factor],
      streak: 0,
    };
  }
  return { ...stats, roundsMissed: stats.roundsMissed + 1, streak: 0 };
}
