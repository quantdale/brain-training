/**
 * Named difficulty → concrete Task Switch parameters.
 *
 * `resolveFlexibilityTaskSwitchDifficulty` plugs the game's tuning into the
 * SDK's `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from the per-session switch
 * rate the player settled at (see `sessionChallengeRating`).
 *
 * Difficulty is driven by: the size of the task pool (2 vs 3 tasks — adding
 * the color task increases interference), the per-trial switch rate (higher =
 * more task switching), and the answer-option count (2 vs 4).
 *
 * The task pool is encoded into numeric flags (`task_parity` / `task_magnitude`
 * / `task_color`) so it round-trips through the SDK's numeric-only profile
 * `parameters` map (same trick as transform-match's transform flags).
 */
import { resolveDifficulty } from "@/sdk";
import type { DifficultyLevel, DifficultyProfile } from "@/sdk";

import type { FlexibilityTaskSwitchDifficultyParams, TaskId } from "./types";

/** Fixed-level tuning. */
export const DIFFICULTY_PARAMS: Readonly<
  Record<
    Exclude<DifficultyLevel, "adaptive">,
    FlexibilityTaskSwitchDifficultyParams
  >
> = {
  easy: {
    rounds: 10,
    switchRate: 0.4,
    taskPool: ["parity", "magnitude"],
    numColors: 3,
    numShapes: 3,
    numNumbers: 9,
    speedTargetMs: 5000,
  },
  normal: {
    rounds: 12,
    switchRate: 0.5,
    taskPool: ["parity", "magnitude"],
    numColors: 3,
    numShapes: 3,
    numNumbers: 9,
    speedTargetMs: 4500,
  },
  hard: {
    rounds: 12,
    switchRate: 0.55,
    taskPool: ["parity", "magnitude", "color"],
    numColors: 4,
    numShapes: 4,
    numNumbers: 9,
    speedTargetMs: 4000,
  },
  expert: {
    rounds: 14,
    switchRate: 0.65,
    taskPool: ["parity", "magnitude", "color"],
    numColors: 4,
    numShapes: 4,
    numNumbers: 9,
    speedTargetMs: 3500,
  },
};

/** Adaptive tuning: 2-task pool; switch rate stays constant and maps to rating. */
export const ADAPTIVE_PARAMS: Readonly<FlexibilityTaskSwitchDifficultyParams> =
  Object.freeze({
    rounds: 12,
    switchRate: 0.5,
    // `as const` keeps the literal a TaskId tuple through Object.freeze inference.
    taskPool: ["parity", "magnitude"] as const,
    numColors: 3,
    numShapes: 3,
    numNumbers: 9,
    speedTargetMs: 4500,
    minSwitchRate: 0.3,
    maxSwitchRate: 0.8,
  });

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function paramsForLevel(
  level: DifficultyLevel,
): FlexibilityTaskSwitchDifficultyParams {
  if (level === "adaptive") {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...DIFFICULTY_PARAMS[level] };
}

/** Encode the task pool as numeric flags so it survives the profile parameters map. */
function taskPoolToFlags(pool: readonly TaskId[]): Record<string, number> {
  return {
    task_parity: pool.includes("parity") ? 1 : 0,
    task_magnitude: pool.includes("magnitude") ? 1 : 0,
    task_color: pool.includes("color") ? 1 : 0,
  };
}

/** Reconstruct the task pool from numeric flags (canonical order). */
function flagsToTaskPool(p: Record<string, unknown>): TaskId[] {
  const out: TaskId[] = [];
  if (p.task_parity === 1) out.push("parity");
  if (p.task_magnitude === 1) out.push("magnitude");
  if (p.task_color === 1) out.push("color");
  return out.length > 0 ? out : ["parity", "magnitude"];
}

/** Resolve a level into a full difficulty profile carrying the Task Switch tuning. */
export function resolveFlexibilityTaskSwitchDifficulty(
  level: DifficultyLevel,
): DifficultyProfile {
  const params = paramsForLevel(level);
  return resolveDifficulty(level, {
    rounds: params.rounds,
    switchRate: params.switchRate,
    ...taskPoolToFlags(params.taskPool),
    numColors: params.numColors,
    numShapes: params.numShapes,
    numNumbers: params.numNumbers,
    speedTargetMs: params.speedTargetMs,
    ...(params.minSwitchRate !== undefined
      ? { minSwitchRate: params.minSwitchRate }
      : {}),
    ...(params.maxSwitchRate !== undefined
      ? { maxSwitchRate: params.maxSwitchRate }
      : {}),
  });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken round.
 */
export function flexibilityTaskSwitchParamsFromProfile(
  profile: DifficultyProfile,
): FlexibilityTaskSwitchDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(
        `flexibility-task-switch: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const taskPool = flagsToTaskPool(p);
  const minSwitchRate =
    p.minSwitchRate === undefined ? undefined : requireNumber("minSwitchRate");
  const maxSwitchRate =
    p.maxSwitchRate === undefined ? undefined : requireNumber("maxSwitchRate");
  return {
    rounds: requireNumber("rounds"),
    switchRate: requireNumber("switchRate"),
    taskPool,
    numColors: requireNumber("numColors"),
    numShapes: requireNumber("numShapes"),
    numNumbers: requireNumber("numNumbers"),
    speedTargetMs: requireNumber("speedTargetMs"),
    ...(minSwitchRate !== undefined ? { minSwitchRate } : {}),
    ...(maxSwitchRate !== undefined ? { maxSwitchRate } : {}),
  };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's constant switch rate mapped linearly
 * into [0, 1] (higher switch rate = harder = higher rating).
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalSwitchRate: number,
): number {
  if (level !== "adaptive") {
    return profile.challengeRating;
  }
  const params = flexibilityTaskSwitchParamsFromProfile(profile);
  const min = params.minSwitchRate ?? 0;
  const max = params.maxSwitchRate ?? finalSwitchRate;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalSwitchRate - min) / span))
    : profile.challengeRating;
}
