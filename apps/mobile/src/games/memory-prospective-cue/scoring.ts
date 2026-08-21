/**
 * Scoring + normalization for the Cue Keeper game.
 *
 * Raw scoring is game-owned; `normalizeProspectiveCueResult` converts it to
 * the SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Raw scoring per stream item (elapsedFraction = window consumed at response):
 *
 *   signal item + SIGNAL response   → +SIGNAL_HIT_POINTS
 *   signal item + GO response       → −SIGNAL_MISS_PENALTY  (prospective miss)
 *   signal item + timeout           → −SIGNAL_MISS_PENALTY  (prospective miss)
 *   filler item + GO response       → +GO_HIT_POINTS
 *                                      + round(GO_SPEED_BONUS × (1 − elapsedFraction))
 *   filler item + SIGNAL response   → −FALSE_ALARM_PENALTY  (prospective false alarm)
 *   filler item + timeout           → −GO_MISS_PENALTY
 *
 * A round PASSES iff the prospective component was perfect: every signal
 * caught and no false alarms. Ongoing-task slips (slow/missed GOs) cost
 * points but do not fail the round — the skill under test is remembering to
 * act, not raw reaction speed.
 *
 * Normalization rule (documented, deterministic):
 *
 *   signalAccuracy = signalHits / totalSignals      (0..1; prospective core)
 *   accuracy       = correctResponses / totalItems  (0..1; ongoing task)
 *   value          = clamp01(signalAccuracy * (0.6 + 0.4 * accuracy))
 *
 * The blend is multiplicative: catching the signals is the base worth 60%,
 * ongoing-task accuracy contributes up to the remaining 40%. Difficulty is
 * deliberately NOT folded into the value — it is recorded on the raw result /
 * diagnostic metadata so the Phase-2 rating pipeline can weight it.
 */
import type {
  NormalizeContext,
  NormalizedPerformance,
  PerformanceNormalizer,
} from "@/sdk";

import { GAME_ID } from "./types";
import type {
  ItemResponse,
  ProspectiveCueDifficultyParams,
  ProspectiveCueRawResult,
} from "./types";

/** Points for catching one signal with the prospective SIGNAL response. */
export const SIGNAL_HIT_POINTS = 120;

/** Points deducted when a signal item does not get the SIGNAL response. */
export const SIGNAL_MISS_PENALTY = 30;

/** Points deducted for a SIGNAL response on a non-signal item. */
export const FALSE_ALARM_PENALTY = 40;

/** Base points for a timely GO on a filler item. */
export const GO_HIT_POINTS = 10;

/** Maximum speed bonus for a GO (scaled by remaining window fraction). */
export const GO_SPEED_BONUS = 10;

/** Points deducted when a filler item times out without a response. */
export const GO_MISS_PENALTY = 5;

/**
 * Points earned for one resolved stream item. `elapsedFraction` is only used
 * for filler GO speed bonus and is clamped to [0, 1].
 */
export function itemPoints(
  wasSignal: boolean,
  response: ItemResponse,
  elapsedFraction = 1,
): number {
  const fraction = Math.min(1, Math.max(0, elapsedFraction));
  if (wasSignal) {
    return response === "signal"
      ? SIGNAL_HIT_POINTS
      : -SIGNAL_MISS_PENALTY;
  }
  switch (response) {
    case "go":
      return GO_HIT_POINTS + Math.round(GO_SPEED_BONUS * (1 - fraction));
    case "signal":
      return -FALSE_ALARM_PENALTY;
    case "timeout":
      return -GO_MISS_PENALTY;
  }
}

/**
 * Score of a hypothetically perfect session: every round passes along the
 * escalation path (signal count grows by one per round up to the cap, every
 * GO lands instantly at full speed bonus). Used by QA force-win and tests.
 */
export function perfectSessionScore(
  params: ProspectiveCueDifficultyParams,
): number {
  let total = 0;
  for (let round = 0; round < params.rounds; round += 1) {
    const count = Math.min(
      params.maxSignalCount,
      params.initialSignalCount + round,
    );
    total += count * SIGNAL_HIT_POINTS;
    total += (params.streamLen - count) * (GO_HIT_POINTS + GO_SPEED_BONUS);
  }
  return total;
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

/** Prospective accuracy: share of signal items that were caught. */
export function signalAccuracyOf(
  signalHits: number,
  totalSignals: number,
): number {
  return totalSignals > 0 ? signalHits / totalSignals : 0;
}

/** Ongoing-task accuracy: share of all items answered correctly. */
export function itemAccuracyOf(
  correctResponses: number,
  totalItems: number,
): number {
  return totalItems > 0 ? correctResponses / totalItems : 0;
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeProspectiveCueResult(
  raw: ProspectiveCueRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const value = clamp01(raw.signalAccuracy * (0.6 + 0.4 * raw.accuracy));
  return { value, scale: "0..1", raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Cue Keeper game. */
export const prospectiveCuePerformanceNormalizer: PerformanceNormalizer<ProspectiveCueRawResult> =
  {
    gameId: GAME_ID,
    normalize: normalizeProspectiveCueResult,
  };
