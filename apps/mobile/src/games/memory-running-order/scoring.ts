/**
 * Scoring + normalization for the Running Order game.
 *
 * Raw scoring is game-owned; `normalizeRunningOrderResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy      = roundsPassed / roundsPlayed               (0..1)
 *   recallProgress = bestRecall / referenceMaxTargets          (clamped 0..1)
 *   value          = accuracy * (0.5 + 0.5 * recallProgress)
 *
 * The blend is multiplicative: accuracy is the base, and escalation (how many
 * trailing symbols the player ever recalled in order, relative to the level's
 * reachable maximum) contributes up to half the value. Difficulty itself is
 * deliberately NOT folded into the value — it is recorded on the raw result /
 * diagnostic metadata so the Phase-2 rating pipeline can weight it.
 *
 * `referenceMaxTargets` is the largest recall length reachable at the chosen
 * level: `initialRecallLength + (rounds - 1)`, capped at `streamLen`.
 */
import type {
 NormalizeContext,
 NormalizedPerformance,
 PerformanceNormalizer,
} from "@/sdk";

import { GAME_ID } from "./types";
import type {
 RunningOrderDifficultyParams,
 RunningOrderRawResult,
} from "./types";

/** Points for a perfectly recalled round: 100 base + 20 per extra item past the start. */
export function roundScore(
 recallLength: number,
 initialRecallLength: number,
): number {
 return 100 + 20 * Math.max(0, recallLength - initialRecallLength);
}

/**
 * Score of a hypothetically perfect session (every round perfectly recalled,
 * recall length escalated to the cap). Used by QA force-win and tests.
 */
export function perfectSessionScore(
 params: RunningOrderDifficultyParams,
): number {
 let total = 0;
 for (let round = 0; round < params.rounds; round += 1) {
  const length = Math.min(params.initialRecallLength + round, params.streamLen);
  total += roundScore(length, params.initialRecallLength);
 }
 return total;
}

/** Largest recall length reachable within a level's escalation. */
export function referenceMaxTargets(
 params: RunningOrderDifficultyParams,
): number {
 return Math.min(
  params.streamLen,
  params.initialRecallLength + (params.rounds - 1),
 );
}

/** Share of rounds passed; 0 when nothing was played (division guard). */
export function accuracyOf(roundsPassed: number, roundsPlayed: number): number {
 return roundsPlayed > 0 ? roundsPassed / roundsPlayed : 0;
}

/** Clamp to [0, 1]; rejects non-finite input (mirrors the SDK clamp). */
export function clamp01(value: number): number {
 if (!Number.isFinite(value)) {
  throw new RangeError(`normalized performance must be finite, got ${value}`);
 }
 return Math.min(1, Math.max(0, value));
}

/** Escalation progress relative to the level's reachable maximum, clamped to [0, 1]. */
export function recallProgress(
 bestRecall: number,
 referenceMax: number,
): number {
 if (referenceMax <= 0) {
  return bestRecall >= referenceMax ? 1 : 0;
 }
 return clamp01(bestRecall / referenceMax);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeRunningOrderResult(
 raw: RunningOrderRawResult,
 _context: NormalizeContext,
): NormalizedPerformance {
 const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
 const progress = recallProgress(raw.bestRecall, referenceMaxTargetsGrid(raw));
 const value = clamp01(accuracy * (0.5 + 0.5 * progress));
 return { value, scale: "0..1", raw: { ...raw } };
}

function referenceMaxTargetsGrid(raw: RunningOrderRawResult): number {
 return Math.min(
  raw.streamLen,
  raw.initialRecallLength + (raw.totalRounds - 1),
 );
}

/** SDK-conformant normalizer instance for the Running Order game. */
export const runningOrderPerformanceNormalizer: PerformanceNormalizer<RunningOrderRawResult> =
 {
  gameId: GAME_ID,
  normalize: normalizeRunningOrderResult,
 };
