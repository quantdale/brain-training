/**
 * Scoring + normalization for the Task Switch game.
 *
 * Raw scoring is game-owned; `normalizeFlexibilityTaskSwitchResult` converts
 * it to the SDK's canonical `NormalizedPerformance` (scale 0..1) before any
 * shared rating/XP logic runs.
 *
 * Raw scoring (speed + accuracy):
 *
 *   roundScore(correct, responseMs) = correct ? 100 + 50 * speedBonus : 0
 *   speedBonus = clamp01(1 - responseMs / speedTargetMs)
 *
 * A wrong answer earns 0 for the round (the mistake penalty) and drags
 * accuracy; a slow correct answer still earns the 100 base.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy        = correctPicks / roundsPlayed                  (0..1)
 *   speedScore      = clamp01(1 - meanResponseMs / speedTargetMs)  (0..1; 0 with no picks)
 *   switchAccuracy  = switchCorrect / switchPlayed                (0..1)
 *   value           = accuracy * (0.7 + 0.2 * switchAccuracy + 0.1 * speedScore)
 *
 * Accuracy is the base (70%). Switch accuracy (the flexibility diagnostic)
 * contributes up to 20%. Speed is deliberately capped at 10% so device/timing
 * artifacts — which vary across 60/120 Hz displays and hardware — can NEVER
 * dominate the score (see the task brief: "measure switch cost fairly without
 * allowing timing artifacts to dominate"). A perfect, instant, switch-perfect
 * run reaches 1.0.
 */
import type {
 NormalizeContext,
 NormalizedPerformance,
 PerformanceNormalizer,
} from "@/sdk";

import { GAME_ID } from "./types";
import type {
 FlexibilityTaskSwitchDifficultyParams,
 FlexibilityTaskSwitchRawResult,
} from "./types";

/** Points for a correct answer: 100 base + up to 50 speed bonus. */
export function roundScore(
 correct: boolean,
 responseMs: number,
 speedTargetMs: number,
): number {
 if (!correct) {
  return 0;
 }
 return 100 + 50 * clamp01(1 - responseMs / speedTargetMs);
}

/** Score of a hypothetically perfect session (all rounds correct, instant). */
export function perfectSessionScore(
 params: FlexibilityTaskSwitchDifficultyParams,
): number {
 return params.rounds * 150;
}

/** Share of rounds answered correctly; 0 when nothing was played. */
export function accuracyOf(correctPicks: number, roundsPlayed: number): number {
 return roundsPlayed > 0 ? correctPicks / roundsPlayed : 0;
}

/**
 * Average-speed score over the picked rounds; 0 when nothing was picked.
 * A response exactly at `speedTargetMs` scores 0, faster scores linearly up
 * to 1, slower clamps to 0.
 */
export function speedScoreOf(
 totalResponseMs: number,
 scoredPicks: number,
 speedTargetMs: number,
): number {
 if (scoredPicks <= 0) {
  return 0;
 }
 return clamp01(1 - totalResponseMs / scoredPicks / speedTargetMs);
}

/** Share of switch trials answered correctly; 0 when none were played. */
export function switchAccuracyOf(
 switchCorrect: number,
 switchPlayed: number,
): number {
 return switchPlayed > 0 ? switchCorrect / switchPlayed : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
 if (!Number.isFinite(value)) {
  throw new RangeError(`normalized performance must be finite, got ${value}`);
 }
 return Math.min(1, Math.max(0, value));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeFlexibilityTaskSwitchResult(
 raw: FlexibilityTaskSwitchRawResult,
 _context: NormalizeContext,
): NormalizedPerformance {
 const accuracy = accuracyOf(raw.correctPicks, raw.roundsPlayed);
 const speed = speedScoreOf(
  raw.totalResponseMs,
  raw.scoredPicks,
  raw.speedTargetMs,
 );
 const switchAccuracy = switchAccuracyOf(raw.switchCorrect, raw.switchPlayed);
 const value = clamp01(accuracy * (0.7 + 0.2 * switchAccuracy + 0.1 * speed));
 return { value, scale: "0..1", raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Task Switch game. */
export const flexibilityTaskSwitchPerformanceNormalizer: PerformanceNormalizer<FlexibilityTaskSwitchRawResult> =
 {
  gameId: GAME_ID,
  normalize: normalizeFlexibilityTaskSwitchResult,
 };
