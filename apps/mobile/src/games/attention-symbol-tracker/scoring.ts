/**
 * Scoring + normalization for the Symbol Tracker game.
 *
 * Raw scoring is game-owned; `normalizeSymbolTrackerResult` converts it to the
 * SDK's canonical `NormalizedPerformance` (scale 0..1) before any shared
 * rating/XP logic runs.
 *
 * Normalization rule (documented, deterministic):
 *
 *   accuracy       = roundsPassed / roundsPlayed        (0..1)
 *   recallProgress = bestRecall / referenceMaxRecall    (clamped 0..1)
 *   value          = accuracy * (0.5 + 0.5 * recallProgress)
 *
 * The blend is multiplicative: accuracy is the base, and escalation (how many
 * symbols the player ever tracked on a single round relative to the level's
 * reachable maximum) contributes up to half the value. Difficulty itself is
 * deliberately NOT folded into the value — it is recorded on the raw result /
 * diagnostic metadata so the Phase-2 rating pipeline can weight it.
 *
 * `referenceMaxRecall` is the largest track count reachable at the chosen
 * level: `initialTrackCount + (rounds - 1)`, capped at the escalation cap
 * (`tokenCount`, or the adaptive `maxTrackCount`). A single perfect round into
 * the top of the escalation range plus a clean accuracy reaches 1.0.
 */
import type {
  NormalizeContext,
  NormalizedPerformance,
  PerformanceNormalizer,
} from '@/sdk';

import { GAME_ID } from './types';
import type { SymbolTrackerDifficultyParams, SymbolTrackerRawResult } from './types';

/** Points for a perfectly tracked round: 100 base + 15 per extra symbol past the start. */
export function roundScore(trackCount: number, initialTrackCount: number): number {
  return 100 + 15 * Math.max(0, trackCount - initialTrackCount);
}

/**
 * Largest track count reachable within a level's escalation: the token count,
 * or the adaptive `maxTrackCount` when it is lower.
 */
function escalationCap(params: SymbolTrackerDifficultyParams): number {
  return Math.min(params.maxTrackCount ?? params.tokenCount, params.tokenCount);
}

/**
 * Score of a hypothetically perfect session (every round perfectly tracked,
 * track count escalated to the cap). Used by QA force-win and tests.
 */
export function perfectSessionScore(params: SymbolTrackerDifficultyParams): number {
  const cap = escalationCap(params);
  let total = 0;
  for (let round = 0; round < params.rounds; round += 1) {
    const count = Math.min(params.initialTrackCount + round, cap);
    total += roundScore(count, params.initialTrackCount);
  }
  return total;
}

/** Largest track count reachable within a level's escalation. */
export function referenceMaxRecall(params: SymbolTrackerDifficultyParams): number {
  return Math.min(escalationCap(params), params.initialTrackCount + (params.rounds - 1));
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
export function recallProgress(bestRecall: number, referenceMax: number): number {
  if (referenceMax <= 0) {
    return bestRecall >= referenceMax ? 1 : 0;
  }
  return clamp01(bestRecall / referenceMax);
}

/** Raw → normalized (see module docs for the formula). */
export function normalizeSymbolTrackerResult(
  raw: SymbolTrackerRawResult,
  _context: NormalizeContext,
): NormalizedPerformance {
  const accuracy = accuracyOf(raw.roundsPassed, raw.roundsPlayed);
  // The raw result stores the resolved params' initial count + token count;
  // the escalation cap also depends on rounds, so recover the reference max
  // from the raw result's own fields.
  const referenceMax = Math.min(
    raw.tokenCount,
    raw.initialTrackCount + (raw.totalRounds - 1),
  );
  const progress = recallProgress(raw.bestRecall, referenceMax);
  const value = clamp01(accuracy * (0.5 + 0.5 * progress));
  return { value, scale: '0..1', raw: { ...raw } };
}

/** SDK-conformant normalizer instance for the Symbol Tracker game. */
export const symbolTrackerPerformanceNormalizer: PerformanceNormalizer<SymbolTrackerRawResult> = {
  gameId: GAME_ID,
  normalize: normalizeSymbolTrackerResult,
};
