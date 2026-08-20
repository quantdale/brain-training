/**
 * Named difficulty → concrete Grid Recall parameters.
 *
 * `resolveGridRecallDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 */
import { resolveDifficulty } from "@/sdk";
import type { DifficultyLevel, DifficultyProfile } from "@/sdk";

import type { GridRecallDifficultyParams } from "./types";

/** Fixed-level tuning: grid size, round-1 targets, study timing, rounds. */
export const GRID_RECALL_DIFFICULTY_PARAMS: Readonly<
 Record<Exclude<DifficultyLevel, "adaptive">, GridRecallDifficultyParams>
> = {
 easy: { gridSize: 9, initialTargetCount: 3, studyMs: 2000, rounds: 4 },
 normal: { gridSize: 16, initialTargetCount: 5, studyMs: 1800, rounds: 5 },
 hard: { gridSize: 25, initialTargetCount: 8, studyMs: 1500, rounds: 6 },
 expert: { gridSize: 36, initialTargetCount: 12, studyMs: 1300, rounds: 7 },
};

/** Adaptive tuning: neutral 4×4 board; target count moves within [3, 12]. */
export const ADAPTIVE_PARAMS: Readonly<GridRecallDifficultyParams> =
 Object.freeze({
  gridSize: 16,
  initialTargetCount: 5,
  studyMs: 1700,
  rounds: 6,
  minTargetCount: 3,
  maxTargetCount: 12,
 });

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function gridRecallParamsForLevel(
 level: DifficultyLevel,
): GridRecallDifficultyParams {
 if (level === "adaptive") {
  return { ...ADAPTIVE_PARAMS };
 }
 return { ...GRID_RECALL_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Grid Recall tuning. */
export function resolveGridRecallDifficulty(
 level: DifficultyLevel,
): DifficultyProfile {
 return resolveDifficulty(level, { ...gridRecallParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function gridRecallParamsFromProfile(
 profile: DifficultyProfile,
): GridRecallDifficultyParams {
 const p = profile.parameters;
 const requireNumber = (key: string): number => {
  const value = p[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
   throw new Error(
    `memory-grid-recall: difficulty profile is missing numeric parameter "${key}"`,
   );
  }
  return value;
 };
 const minTargetCount =
  p.minTargetCount === undefined ? undefined : requireNumber("minTargetCount");
 const maxTargetCount =
  p.maxTargetCount === undefined ? undefined : requireNumber("maxTargetCount");
 return {
  gridSize: requireNumber("gridSize"),
  initialTargetCount: requireNumber("initialTargetCount"),
  studyMs: requireNumber("studyMs"),
  rounds: requireNumber("rounds"),
  ...(minTargetCount !== undefined ? { minTargetCount } : {}),
  ...(maxTargetCount !== undefined ? { maxTargetCount } : {}),
 };
}

/**
 * Target count of the next round. Fixed levels escalate by one on a pass
 * (capped at the grid size) and hold on a failure; adaptive moves ±1 within
 * [minTargetCount, maxTargetCount].
 */
export function nextTargetCount(
 prevCount: number,
 passed: boolean,
 level: DifficultyLevel,
 params: GridRecallDifficultyParams,
): number {
 if (level === "adaptive") {
  const min = params.minTargetCount ?? params.initialTargetCount;
  const max = params.maxTargetCount ?? params.gridSize;
  return Math.min(max, Math.max(min, prevCount + (passed ? 1 : -1)));
 }
 return passed ? Math.min(params.gridSize, prevCount + 1) : prevCount;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final target count mapped linearly
 * into [0, 1] over [minTargetCount, maxTargetCount].
 */
export function sessionChallengeRating(
 level: DifficultyLevel,
 profile: DifficultyProfile,
 finalTargetCount: number,
): number {
 if (level !== "adaptive") {
  return profile.challengeRating;
 }
 const params = gridRecallParamsFromProfile(profile);
 const min = params.minTargetCount ?? params.initialTargetCount;
 const max = params.maxTargetCount ?? params.gridSize;
 const span = max - min;
 return span > 0
  ? Math.min(1, Math.max(0, (finalTargetCount - min) / span))
  : profile.challengeRating;
}
