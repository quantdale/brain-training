/**
 * Scoring + normalization for the Rule Flip game.
 *
 * Raw scoring is game-owned; `normalizeFlexibilityRuleFlipResult` converts it
 * to the SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring (speed + accuracy + switch/uncued-correct bonuses):
 *
 *   roundScore(correct, responseMs) = correct ? 100 + speedBonus : 0
 *   speedBonus = 50 * clamp01(1 - responseMs / speedTargetMs)
 *   SWITCH_CORRECT_BONUS = +20 on top of a correct SWITCH trial (rewarding
 *     correct flexible re-anchoring when the rule flips)
 *   UNCUED_FIRST_PICK_BONUS = +30 on top of a correct UNCUED-window trial.
 *     Slightly higher than the switch bonus on purpose (campaign 014): inside
 *     an uncued window the player gets no banner at all, so every pick is an
 *     inference act — it must both find A rule AND hold it across silent
 *     flips. The extra reward prices that extra uncertainty in.
 *
 * A wrong pick earns 0 for the round (the mistake penalty) and drags accuracy;
 * a slow correct pick still earns the 100 base. The fastest possible switch
 * trial scores 170; the fastest possible uncued trial scores 180; the fastest
 * possible repeat (cued) trial scores 150.
 *
 * Normalization rule (documented, deterministic; v2 adds the uncued blend):
 *
 *   accuracy          = correctPicks / roundsPlayed                  (0..1)
 *   speedScore        = clamp01(1 - meanResponseMs / speedTargetMs)  (0..1)
 *   switchAccuracy    = switchCorrect / switchPlayed                 (0..1)
 *   uncuedAccuracy    = uncuedCorrect / uncuedPlayed                 (0..1)
 *
 *   with uncued trials played:
 *     value = accuracy * (0.50 + 0.25 * speedScore
 *                          + 0.15 * switchAccuracy + 0.10 * uncuedAccuracy)
 *   without uncued trials (easy tiers keep the v1 formula so legacy-tier
 *   ceilings do not silently drop):
 *     value = accuracy * (0.55 + 0.25 * speedScore + 0.20 * switchAccuracy)
 *
 * Accuracy is the base; speed contributes up to 25%, switch-rule accuracy up
 * to 20% (or 15% once inference windows exist), and uncued-first-pick accuracy
 * — how well the player classifies while the rule banner is hidden — up to an
 * additional 10%. Both branches cap at exactly 1.0 for perfect runs.
 * Difficulty itself is deliberately NOT folded into the value — it is recorded
 * on the raw result / diagnostic metadata so the Phase-2 rating pipeline can
 * weight it.
 */
import type { NormalizeContext, NormalizedPerformance, PerformanceNormalizer } from '@/sdk';

import { GAME_ID } from './types';
import type { FlexibilityRuleFlipDifficultyParams, FlexibilityRuleFlipRawResult } from './types';

/** Points for a correct pick: 100 base + up to 50 speed bonus. */
export function roundScore(correct: boolean, responseMs: number, speedTargetMs: number): number {
  if (!correct) {
    return 0;
  }
  return 100 + 50 * clamp01(1 - responseMs / speedTargetMs);
}

/** Extra points for answering a switch (rule-flip) trial correctly. */
export const SWITCH_CORRECT_BONUS = 20;

/**
 * Extra points for answering an UNCUED-window trial correctly. Every pick in
 * an uncued window is a first-pick inference (the banner hid the rule), so it
 * earns slightly more than the cued switch bonus — see the module docs.
 */
export const UNCUED_FIRST_PICK_BONUS = 30;

/**
 * Raw score of a single trial (correctness + speed + switch/uncued bonuses).
 * Mirrors exactly what the reducer adds on a pick.
 */
export function trialRawScore(
  correct: boolean,
  responseMs: number,
  speedTargetMs: number,
  isSwitch: boolean,
  isUncued = false,
): number {
  if (!correct) {
    return 0;
  }
  return (
    roundScore(true, responseMs, speedTargetMs) +
    (isSwitch ? SWITCH_CORRECT_BONUS : 0) +
    (isUncued ? UNCUED_FIRST_PICK_BONUS : 0)
  );
}

/** Score of a hypothetically perfect session (all rounds correct, instant). */
export function perfectSessionScore(params: FlexibilityRuleFlipDifficultyParams): number {
  return params.rounds * 150;
}

/**
 * Score of a hypothetically perfect plan (switch and uncued trials also earn
 * their bonuses). Plan items may predate the uncued flag (`uncued` undefined →
 * treated as cued) so older persisted plans stay scorable.
 */
export function perfectPlanScore(plan: readonly { isSwitch: boolean; uncued?: boolean }[]): number {
  return plan.reduce(
    (sum, round) => sum + trialRawScore(true, 0, 1, round.isSwitch, round.uncued === true),
    0,
  );
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

/** Share of rule-switch trials answered correctly; 0 when none were played. */
export function switchAccuracyOf(switchCorrect: number, switchPlayed: number): number {
  return switchPlayed > 0 ? switchCorrect / switchPlayed : 0;
}

/** Share of uncued-window (inference) trials answered correctly; 0 when none were played. */
export function uncuedAccuracyOf(uncuedCorrect: number, uncuedPlayed: number): number {
  return uncuedPlayed > 0 ? uncuedCorrect / uncuedPlayed : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`normalized performance must be finite, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** Raw → normalized (see module docs for the v2 formula). */
export function normalizeFlexibilityRuleFlipResult(
  raw: FlexibilityRuleFlipRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.correctPicks, raw.roundsPlayed);
  const speed = speedScoreOf(raw.totalResponseMs, raw.scoredPicks, raw.speedTargetMs);
  const switchAccuracy = switchAccuracyOf(raw.switchCorrect, raw.switchPlayed);
  const uncuedAccuracy = uncuedAccuracyOf(raw.uncuedCorrect ?? 0, raw.uncuedPlayed ?? 0);
  // Branch on whether the session contained inference windows at all so tiers
  // without them keep the exact v1 ceiling (no silent nerf for easy players).
  const inner =
    (raw.uncuedPlayed ?? 0) > 0
      ? 0.5 + 0.25 * speed + 0.15 * switchAccuracy + 0.1 * uncuedAccuracy
      : 0.55 + 0.25 * speed + 0.2 * switchAccuracy;
  const value = clamp01(accuracy * inner);
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Rule Flip game. */
export const flexibilityRuleFlipPerformanceNormalizer: PerformanceNormalizer<FlexibilityRuleFlipRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeFlexibilityRuleFlipResult,
};
