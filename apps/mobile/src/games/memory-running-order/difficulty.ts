/**
 * Named difficulty → concrete Running Order parameters.
 *
 * `resolveRunningOrderDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 */
import { resolveDifficulty } from "@/sdk";
import type { DifficultyLevel, DifficultyProfile } from "@/sdk";

import type { RunningOrderDifficultyParams } from "./types";

/** Fixed-level tuning: stream length, recall length, flash timing, rounds. */
export const RUNNING_ORDER_DIFFICULTY_PARAMS: Readonly<
 Record<Exclude<DifficultyLevel, "adaptive">, RunningOrderDifficultyParams>
> = {
 easy: { streamLen: 3, initialRecallLength: 2, flashMs: 900, rounds: 4 },
 normal: { streamLen: 4, initialRecallLength: 3, flashMs: 800, rounds: 5 },
 hard: { streamLen: 6, initialRecallLength: 3, flashMs: 700, rounds: 6 },
 expert: { streamLen: 8, initialRecallLength: 4, flashMs: 650, rounds: 7 },
};

/** Adaptive tuning: neutral 4-stream board; recall length moves within [2, 5]. */
export const ADAPTIVE_PARAMS: Readonly<RunningOrderDifficultyParams> =
 Object.freeze({
  streamLen: 5,
  initialRecallLength: 3,
  flashMs: 800,
  rounds: 6,
  minRecallLength: 2,
  maxRecallLength: 5,
 });

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function runningOrderParamsForLevel(
 level: DifficultyLevel,
): RunningOrderDifficultyParams {
 if (level === "adaptive") {
  return { ...ADAPTIVE_PARAMS };
 }
 return { ...RUNNING_ORDER_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Running Order tuning. */
export function resolveRunningOrderDifficulty(
 level: DifficultyLevel,
): DifficultyProfile {
 return resolveDifficulty(level, { ...runningOrderParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken board.
 */
export function runningOrderParamsFromProfile(
 profile: DifficultyProfile,
): RunningOrderDifficultyParams {
 const p = profile.parameters;
 const requireNumber = (key: string): number => {
  const value = p[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
   throw new Error(
    `memory-running-order: difficulty profile is missing numeric parameter "${key}"`,
   );
  }
  return value;
 };
 const minRecallLength =
  p.minRecallLength === undefined
   ? undefined
   : requireNumber("minRecallLength");
 const maxRecallLength =
  p.maxRecallLength === undefined
   ? undefined
   : requireNumber("maxRecallLength");
 return {
  streamLen: requireNumber("streamLen"),
  initialRecallLength: requireNumber("initialRecallLength"),
  flashMs: requireNumber("flashMs"),
  rounds: requireNumber("rounds"),
  ...(minRecallLength !== undefined ? { minRecallLength } : {}),
  ...(maxRecallLength !== undefined ? { maxRecallLength } : {}),
 };
}

/**
 * Recall length of the next round. Fixed levels escalate by one on a pass
 * (capped at the stream length) and hold on a failure; adaptive moves ±1
 * within [minRecallLength, maxRecallLength].
 */
export function nextRecallLength(
 prevLength: number,
 passed: boolean,
 level: DifficultyLevel,
 params: RunningOrderDifficultyParams,
): number {
 if (level === "adaptive") {
  const min = params.minRecallLength ?? params.initialRecallLength;
  const max = Math.min(
   params.maxRecallLength ?? params.streamLen,
   params.streamLen,
  );
  return Math.min(max, Math.max(min, prevLength + (passed ? 1 : -1)));
 }
 return passed ? Math.min(params.streamLen, prevLength + 1) : prevLength;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final recall length mapped linearly
 * into [0, 1] over [minRecallLength, maxRecallLength].
 */
export function sessionChallengeRating(
 level: DifficultyLevel,
 profile: DifficultyProfile,
 finalRecallLength: number,
): number {
 if (level !== "adaptive") {
  return profile.challengeRating;
 }
 const params = runningOrderParamsFromProfile(profile);
 const min = params.minRecallLength ?? params.initialRecallLength;
 const max = Math.min(
  params.maxRecallLength ?? params.streamLen,
  params.streamLen,
 );
 const span = max - min;
 return span > 0
  ? Math.min(1, Math.max(0, (finalRecallLength - min) / span))
  : profile.challengeRating;
}
