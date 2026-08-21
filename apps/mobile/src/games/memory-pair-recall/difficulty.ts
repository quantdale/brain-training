/**
 * Named difficulty → concrete Pair Recall parameters.
 *
 * `resolvePairRecallDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 */
import { resolveDifficulty } from "@/sdk";
import type { DifficultyLevel, DifficultyProfile } from "@/sdk";

import type { PairRecallDifficultyParams } from "./types";

/** Fixed-level tuning: round-1 pair count, study timing, rounds, escalation cap. */
export const PAIR_RECALL_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, "adaptive">, PairRecallDifficultyParams>
> = {
  easy: { initialPairCount: 2, studyMs: 3200, rounds: 4, maxPairCount: 4 },
  normal: { initialPairCount: 3, studyMs: 2800, rounds: 5, maxPairCount: 6 },
  hard: { initialPairCount: 4, studyMs: 2400, rounds: 6, maxPairCount: 7 },
  expert: { initialPairCount: 5, studyMs: 2000, rounds: 7, maxPairCount: 8 },
};

/**
 * Adaptive tuning: neutral 3-pair start; pair count moves within [2, 8].
 */
export const ADAPTIVE_PARAMS: Readonly<PairRecallDifficultyParams> =
  Object.freeze({
    initialPairCount: 3,
    studyMs: 2600,
    rounds: 6,
    maxPairCount: 8,
    minPairCount: 2,
  });

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function pairRecallParamsForLevel(
  level: DifficultyLevel,
): PairRecallDifficultyParams {
  if (level === "adaptive") {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...PAIR_RECALL_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Pair Recall tuning. */
export function resolvePairRecallDifficulty(
  level: DifficultyLevel,
): DifficultyProfile {
  return resolveDifficulty(level, { ...pairRecallParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function pairRecallParamsFromProfile(
  profile: DifficultyProfile,
): PairRecallDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(
        `memory-pair-recall: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const minPairCount =
    p.minPairCount === undefined ? undefined : requireNumber("minPairCount");
  return {
    initialPairCount: requireNumber("initialPairCount"),
    studyMs: requireNumber("studyMs"),
    rounds: requireNumber("rounds"),
    maxPairCount: requireNumber("maxPairCount"),
    ...(minPairCount !== undefined ? { minPairCount } : {}),
  };
}

/**
 * Pair count of the next round. Fixed levels escalate by one on a pass
 * (capped at `maxPairCount`) and hold on a failure; adaptive moves ±1 within
 * [minPairCount, maxPairCount].
 */
export function nextPairCount(
  prevCount: number,
  passed: boolean,
  level: DifficultyLevel,
  params: PairRecallDifficultyParams,
): number {
  if (level === "adaptive") {
    const min = params.minPairCount ?? params.initialPairCount;
    return Math.min(
      params.maxPairCount,
      Math.max(min, prevCount + (passed ? 1 : -1)),
    );
  }
  return passed
    ? Math.min(params.maxPairCount, prevCount + 1)
    : prevCount;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final pair count mapped linearly
 * into [0, 1] over [minPairCount, maxPairCount].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalPairCount: number,
): number {
  if (level !== "adaptive") {
    return profile.challengeRating;
  }
  const params = pairRecallParamsFromProfile(profile);
  const min = params.minPairCount ?? params.initialPairCount;
  const span = params.maxPairCount - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalPairCount - min) / span))
    : profile.challengeRating;
}
