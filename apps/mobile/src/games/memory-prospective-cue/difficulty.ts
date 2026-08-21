/**
 * Named difficulty → concrete Cue Keeper parameters.
 *
 * `resolveProspectiveCueDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how many simultaneous
 * signals the player was holding at the end (see `sessionChallengeRating`).
 *
 * Two escalation axes per passed round: MORE simultaneous signals to hold
 * (initialSignalCount → maxSignalCount) and a FASTER stream window
 * (initialItemMs → minItemMs, shrinking by ITEM_MS_STEP). Failed rounds hold
 * both on fixed levels; adaptive steps the signal count back down instead.
 */
import { resolveDifficulty } from "@/sdk";
import type { DifficultyLevel, DifficultyProfile } from "@/sdk";

import type { ProspectiveCueDifficultyParams } from "./types";

/** Per-pass shrink of the per-item response window (ms), floored at minItemMs. */
export const ITEM_MS_STEP = 150;

/** Fixed-level tuning: signal count, response window, stream length, rounds. */
export const PROSPECTIVE_CUE_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, "adaptive">, ProspectiveCueDifficultyParams>
> = {
  easy: {
    initialSignalCount: 1,
    maxSignalCount: 3,
    initialItemMs: 2200,
    minItemMs: 1600,
    streamLen: 12,
    rounds: 4,
  },
  normal: {
    initialSignalCount: 2,
    maxSignalCount: 4,
    initialItemMs: 1900,
    minItemMs: 1300,
    streamLen: 14,
    rounds: 5,
  },
  hard: {
    initialSignalCount: 2,
    maxSignalCount: 5,
    initialItemMs: 1600,
    minItemMs: 1100,
    streamLen: 16,
    rounds: 6,
  },
  expert: {
    initialSignalCount: 3,
    maxSignalCount: 6,
    initialItemMs: 1400,
    minItemMs: 950,
    streamLen: 18,
    rounds: 7,
  },
};

/**
 * Adaptive tuning: neutral 2-signal start; the count moves within [2, 6]
 * while the window stays at a mid pace.
 */
export const ADAPTIVE_PARAMS: Readonly<ProspectiveCueDifficultyParams> =
  Object.freeze({
    initialSignalCount: 2,
    maxSignalCount: 6,
    initialItemMs: 1700,
    minItemMs: 1200,
    streamLen: 16,
    rounds: 6,
    minSignalCount: 2,
  });

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function prospectiveCueParamsForLevel(
  level: DifficultyLevel,
): ProspectiveCueDifficultyParams {
  if (level === "adaptive") {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...PROSPECTIVE_CUE_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the Cue Keeper tuning. */
export function resolveProspectiveCueDifficulty(
  level: DifficultyLevel,
): DifficultyProfile {
  return resolveDifficulty(level, {
    ...prospectiveCueParamsForLevel(level),
  });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken stream.
 */
export function prospectiveCueParamsFromProfile(
  profile: DifficultyProfile,
): ProspectiveCueDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(
        `memory-prospective-cue: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const minSignalCount =
    p.minSignalCount === undefined ? undefined : requireNumber("minSignalCount");
  return {
    initialSignalCount: requireNumber("initialSignalCount"),
    maxSignalCount: requireNumber("maxSignalCount"),
    initialItemMs: requireNumber("initialItemMs"),
    minItemMs: requireNumber("minItemMs"),
    streamLen: requireNumber("streamLen"),
    rounds: requireNumber("rounds"),
    ...(minSignalCount !== undefined ? { minSignalCount } : {}),
  };
}

/**
 * Active signal count of the next round. Fixed levels escalate by one on a
 * pass (capped at `maxSignalCount`) and hold on a failure; adaptive moves ±1
 * within [minSignalCount ?? 2, maxSignalCount].
 */
export function nextSignalCount(
  prevCount: number,
  passed: boolean,
  level: DifficultyLevel,
  params: ProspectiveCueDifficultyParams,
): number {
  if (level === "adaptive") {
    const min = params.minSignalCount ?? params.initialSignalCount;
    return Math.min(
      params.maxSignalCount,
      Math.max(min, prevCount + (passed ? 1 : -1)),
    );
  }
  return passed
    ? Math.min(params.maxSignalCount, prevCount + 1)
    : prevCount;
}

/**
 * Per-item response window of the next round: shrinks by ITEM_MS_STEP on a
 * pass (floored at `minItemMs`) and holds on a failure — every level.
 */
export function nextItemMs(
  prevItemMs: number,
  passed: boolean,
  params: ProspectiveCueDifficultyParams,
): number {
  return passed
    ? Math.max(params.minItemMs, prevItemMs - ITEM_MS_STEP)
    : prevItemMs;
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final simultaneous-signal count
 * mapped linearly into [0, 1] over [minSignalCount, maxSignalCount].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalSignalCount: number,
): number {
  if (level !== "adaptive") {
    return profile.challengeRating;
  }
  const params = prospectiveCueParamsFromProfile(profile);
  const min = params.minSignalCount ?? params.initialSignalCount;
  const span = params.maxSignalCount - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalSignalCount - min) / span))
    : profile.challengeRating;
}
