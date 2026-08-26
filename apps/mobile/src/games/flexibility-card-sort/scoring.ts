/**
 * Scoring + normalization for the Card Sort game.
 *
 * Raw scoring is game-owned; `normalizeFlexibilityResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring (speed + accuracy + mistake penalties):
 *
 *   roundScore(correct, responseMs) = correct ? 100 + speedBonus : 0
 *   speedBonus = 50 * clamp01(1 - responseMs / speedTargetMs)
 *
 * A wrong pick earns 0 for the round (the mistake penalty) and drags accuracy;
 * a slow correct pick still earns the 100 base. The fastest possible session
 * scores 150 per round.
 *
 * Normalization rule (documented, deterministic; v1.2 adds discovery):
 *
 *   accuracy          = correctPicks / roundsPlayed                 (0..1)
 *   speedScore        = clamp01(1 - meanResponseMs / speedTargetMs)  (0..1)
 *   switchAccuracy    = postSwitchCorrect / postSwitchPlayed         (0..1)
 *   discoveryAccuracy = discoveryCorrect / discoveryPlayed           (0..1)
 *
 *   without discovery rounds played (easy tiers — exact v1 formula):
 *     value = accuracy * (0.6 + 0.2 * speedScore + 0.2 * switchAccuracy)
 *   with discovery rounds played, 10 points of the switchAccuracy weight are
 *   additively re-blended into discovery accuracy (the inference diagnostic
 *   is a strictly harder version of the same "recover the rule" skill):
 *     value = accuracy * (0.6 + 0.2 * speedScore
 *                          + 0.1 * switchAccuracy + 0.1 * discoveryAccuracy)
 *
 * Accuracy is the base; speed and switch-rule accuracy each contribute up to
 * 20% of the blend (or 10% each once discovery stretches exist). Branching on
 * `discoveryPlayed` keeps tier ceilings stable: sessions with no discovery
 * blocks still reach exactly 1.0. A perfect, instant, switch-perfect run
 * reaches 1.0 in both branches. Difficulty itself is deliberately NOT folded
 * into the value — it is recorded on the raw result / diagnostic metadata so
 * the Phase-2 rating pipeline can weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { FlexibilityDifficultyParams, FlexibilityRawResult } from './types';

/** Points for a correct pick: 100 base + up to 50 speed bonus. */
export function roundScore(correct: boolean, responseMs: number, speedTargetMs: number): number {
  if (!correct) {
    return 0;
  }
  return 100 + 50 * clamp01(1 - responseMs / speedTargetMs);
}

/** Score of a hypothetically perfect session (all rounds correct, instant). */
export function perfectSessionScore(params: FlexibilityDifficultyParams): number {
  return params.rounds * 150;
}

/** Share of rounds answered correctly; 0 when nothing was played. */
export function accuracyOf(correctPicks: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? correctPicks / roundsPlayed : 0;
}

/**
 * Average-speed score over the picked rounds; 0 when nothing was picked
 * (division guard). A response exactly at `speedTargetMs` scores 0, faster
 * scores linearly up to 1, slower clamps to 0.
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

/** Share of post-switch rounds answered correctly; 0 when none were played. */
export function switchAccuracyOf(postSwitchCorrect: number, postSwitchPlayed: number): number {
  return postSwitchPlayed > 0 ? postSwitchCorrect / postSwitchPlayed : 0;
}

/** Share of discovery-block rounds answered correctly; 0 when none were played. */
export function discoveryAccuracyOf(discoveryCorrect: number, discoveryPlayed: number): number {
  return discoveryPlayed > 0 ? discoveryCorrect / discoveryPlayed : 0;
}

/**
 * The combined switch+discovery contribution to the normalize multiplier.
 *
 * Without discovery rounds this is exactly the v1 weight (0.2 × switch), so
 * cued-only sessions keep their historical ceiling. Once discovery stretches
 * were played, half of that weight moves onto discovery accuracy — an
 * additive re-blend (not a new multiplicative term) so the maximum stays
 * exactly 1.0 and the two diagnostics remain directly comparable.
 */
export function switchBlendFactorOf(
  discoveryPlayed: number,
  switchAccuracy: number,
  discoveryAccuracy: number,
): number {
  if (discoveryPlayed > 0) {
    return 0.1 * switchAccuracy + 0.1 * discoveryAccuracy;
  }
  return 0.2 * switchAccuracy;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeFlexibilityResult(
  raw: FlexibilityRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.correctPicks, raw.roundsPlayed);
  const speed = speedScoreOf(raw.totalResponseMs, raw.scoredPicks, raw.speedTargetMs);
  const switchAccuracy = switchAccuracyOf(raw.postSwitchCorrect, raw.postSwitchPlayed);
  const discoveryAccuracy = discoveryAccuracyOf(
    raw.discoveryCorrect ?? 0,
    raw.discoveryPlayed ?? 0,
  );
  const inner =
    0.6 + 0.2 * speed + switchBlendFactorOf(raw.discoveryPlayed ?? 0, switchAccuracy, discoveryAccuracy);
  const value = clamp01(accuracy * inner);
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Card Sort game. */
export const flexibilityPerformanceNormalizer: PerformanceNormalizer<FlexibilityRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeFlexibilityResult,
};
