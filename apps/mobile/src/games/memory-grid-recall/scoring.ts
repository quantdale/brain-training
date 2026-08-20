/**
 * Scoring + normalization for the Grid Recall game.
 *
 * Raw scoring is game-owned; `normalizeGridRecallResult` converts it to the
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
 * cells the player ever recalled on a single round relative to the level's
 * reachable maximum) contributes up to half the value. Difficulty itself is
 * deliberately NOT folded into the value — it is recorded on the raw result /
 * diagnostic metadata so the Phase-2 rating pipeline can weight it.
 *
 * `referenceMaxTargets` is the largest target count reachable at the chosen
 * level: `initialTargetCount + (rounds - 1)`, capped at `gridSize`. A single
 * perfect round into the top of the escalation range plus a clean accuracy
 * reaches 1.0.
 */
import type {
 NormalizeContext,
 NormalizedPerformance,
 PerformanceNormalizer,
} from "@/sdk";

import { GAME_ID } from "./types";
import type { GridRecallDifficultyParams, GridRecallRawResult } from "./types";

/** Points for a perfectly recalled round: 100 base + 15 per extra cell past the start. */
export function roundScore(
 targetCount: number,
 initialTargetCount: number,
): number {
 return 100 + 15 * Math.max(0, targetCount - initialTargetCount);
}

/**
 * Score of a hypothetically perfect session (every round perfectly recalled,
 * target count escalated to the cap). Used by QA force-win and tests.
 */
export function perfectSessionScore(
 params: GridRecallDifficultyParams,
): number {
 let total = 0;
 for (let round = 0; round < params.rounds; round += 1) {
  const count = Math.min(params.initialTargetCount + round, params.gridSize);
  total += roundScore(count, params.initialTargetCount);
 }
 return total;
}

/** Largest target count reachable within a level's escalation. */
export function referenceMaxTargets(
 params: GridRecallDifficultyParams,
): number {
 return Math.min(
  params.gridSize,
  params.initialTargetCount + (params.rounds - 1),
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
export function normalizeGridRecallResult(
 raw: GridRecallRawResult,
 _context: NormalizeContext,
): NormalizedPerformance {
 const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
 const progress = recallProgress(raw.bestRecall, referenceMaxTargetsGrid(raw));
 const value = clamp01(accuracy * (0.5 + 0.5 * progress));
 return { value, scale: "0..1", raw: { ...raw } };
}

/**
 * The raw result stores the resolved params' initial count + grid size, but
 * the escalation cap also depends on rounds; recover the reference max from
 * the raw result's own fields (gridSize, initialTargetCount, totalRounds).
 */
function referenceMaxTargetsGrid(raw: GridRecallRawResult): number {
 return Math.min(raw.gridSize, raw.initialTargetCount + (raw.totalRounds - 1));
}

/** SDK-conformant normalizer instance for the Grid Recall game. */
export const gridRecallPerformanceNormalizer: PerformanceNormalizer<GridRecallRawResult> =
 {
  gameId: GAME_ID,
  normalize: normalizeGridRecallResult,
 };
