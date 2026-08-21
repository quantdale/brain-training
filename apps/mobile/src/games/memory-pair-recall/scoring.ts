/**
 * Scoring + normalization for the Pair Recall game.
 *
 * Raw scoring is game-owned; `normalizePairRecallResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring per round:
 *
 *   perfectRound = 100 + 20 × max(0, pairCount − initialPairCount)
 *   roundPoints  = max(0, round(perfectRound × correctCues / pairCount)
 *                      − WRONG_TAP_PENALTY × wrongCues)
 *
 * so partial recall earns proportional credit and wrong picks cost points
 * (total score floored at 0).
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy     = roundsPassed / roundsPlayed            (0..1)
 *   pairProgress = bestRecall / referenceMaxPairs         (clamped 0..1)
 *   value        = accuracy * (0.5 + 0.5 * pairProgress)
 *
 * The blend is multiplicative: accuracy is the base, and escalation (how many
 * partners the player ever recalled in a single round relative to the level's
 * reachable maximum) contributes up to half the value. Difficulty itself is
 * deliberately NOT folded into the value — it is recorded on the raw result /
 * diagnostic metadata so the Phase-2 rating pipeline can weight it.
 *
 * `referenceMaxPairs` is the largest pair count reachable at the chosen level:
 * `initialPairCount + (rounds - 1)`, capped at `maxPairCount`.
 */
import type {
  NormalizeContext,
  NormalizedPerformance,
  PerformanceNormalizer,
} from "@/sdk";

import { GAME_ID } from "./types";
import type {
  PairRecallDifficultyParams,
  PairRecallRawResult,
} from "./types";

/** Points deducted per wrong response pick within a round. */
export const WRONG_TAP_PENALTY = 15;

/** Points for a perfectly recalled round: 100 base + 20 per extra pair past the start. */
export function roundScore(
  pairCount: number,
  initialPairCount: number,
): number {
  return 100 + 20 * Math.max(0, pairCount - initialPairCount);
}

/**
 * Score of a hypothetically perfect session (every round perfectly recalled,
 * pair count escalated to the cap). Used by QA force-win and tests.
 */
export function perfectSessionScore(
  params: PairRecallDifficultyParams,
): number {
  let total = 0;
  for (let round = 0; round < params.rounds; round += 1) {
    const count = Math.min(
      params.initialPairCount + round,
      params.maxPairCount,
    );
    total += roundScore(count, params.initialPairCount);
  }
  return total;
}

/** Largest pair count reachable within a level's escalation. */
export function referenceMaxPairs(
  params: PairRecallDifficultyParams,
): number {
  return Math.min(
    params.maxPairCount,
    params.initialPairCount + (params.rounds - 1),
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
export function pairProgress(
  bestRecall: number,
  referenceMax: number,
): number {
  if (referenceMax <= 0) {
    return bestRecall >= referenceMax ? 1 : 0;
  }
  return clamp01(bestRecall / referenceMax);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizePairRecallResult(
  raw: PairRecallRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  // The raw result stores the resolved params' initial + max pair counts; the
  // escalation cap also depends on rounds, so recover the reference max from
  // the raw result's own fields.
  const referenceMax = Math.min(
    raw.maxPairCount,
    raw.initialPairCount + (raw.totalRounds - 1),
  );
  const progress = pairProgress(raw.bestRecall, referenceMax);
  const value = clamp01(accuracy * (0.5 + 0.5 * progress));
  return { value, scale: "0..1", raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Pair Recall game. */
export const pairRecallPerformanceNormalizer: PerformanceNormalizer<PairRecallRawResult> =
  {
    gameId: GAME_ID,
    normalize: normalizePairRecallResult,
  };
