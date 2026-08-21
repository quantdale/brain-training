/**
 * Named difficulty → concrete Deduction Table parameters.
 *
 * `resolveLogicDeductionDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Difficulty
 * scales real constraint complexity: more entities and attributes, and more
 * clues to read (constitution §10 logic procedural-content requirements).
 */
import { resolveDifficulty } from "@/sdk";
import type { DifficultyLevel, DifficultyProfile } from "@/sdk";

import type { LogicDeductionDifficultyParams } from "./types";

/** Fixed-level tuning: entities, attributes, clue target, rounds, time budget. */
export const LOGIC_DEDUCTION_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, "adaptive">, LogicDeductionDifficultyParams>
> = {
  easy: {
    entityCount: 3,
    attributeCount: 2,
    clueCount: 4,
    rounds: 5,
    roundTimeMs: 30_000,
  },
  normal: {
    entityCount: 3,
    attributeCount: 3,
    clueCount: 6,
    rounds: 6,
    roundTimeMs: 26_000,
  },
  hard: {
    entityCount: 4,
    attributeCount: 3,
    clueCount: 8,
    rounds: 6,
    roundTimeMs: 22_000,
  },
  expert: {
    entityCount: 5,
    attributeCount: 4,
    clueCount: 11,
    rounds: 7,
    roundTimeMs: 18_000,
  },
};

/** Adaptive tuning: neutral starting point; escalates during play. */
export const ADAPTIVE_PARAMS: Readonly<LogicDeductionDifficultyParams> =
  Object.freeze({
    entityCount: 3,
    attributeCount: 2,
    clueCount: 5,
    rounds: 6,
    roundTimeMs: 24_000,
    minEntityCount: 3,
    maxEntityCount: 5,
    minAttributeCount: 2,
    maxAttributeCount: 4,
    minClueCount: 4,
    maxClueCount: 12,
  });

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function logicDeductionParamsForLevel(
  level: DifficultyLevel,
): LogicDeductionDifficultyParams {
  if (level === "adaptive") {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...LOGIC_DEDUCTION_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveLogicDeductionDifficulty(
  level: DifficultyLevel,
): DifficultyProfile {
  return resolveDifficulty(level, { ...logicDeductionParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile. Throws when a required
 * parameter is missing/non-finite or out of bounds, instead of silently
 * producing a broken session.
 */
export function logicDeductionParamsFromProfile(
  profile: DifficultyProfile,
): LogicDeductionDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(
        `logic-deduction: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const entityCount = requireNumber("entityCount");
  const attributeCount = requireNumber("attributeCount");
  const clueCount = requireNumber("clueCount");
  const rounds = requireNumber("rounds");
  const roundTimeMs = requireNumber("roundTimeMs");
  if (entityCount < 2 || entityCount > 5) {
    throw new Error(`logic-deduction: invalid entityCount ${entityCount}`);
  }
  if (attributeCount < 1 || attributeCount > 5) {
    throw new Error(
      `logic-deduction: invalid attributeCount ${attributeCount}`,
    );
  }
  if (clueCount < 1 || rounds < 1 || roundTimeMs <= 0) {
    throw new Error(`logic-deduction: invalid clueCount/rounds/roundTimeMs`);
  }
  const optional = (key: string): number | undefined => {
    const value = p[key];
    if (value === undefined) return undefined;
    return requireNumber(key);
  };
  return {
    entityCount,
    attributeCount,
    clueCount,
    rounds,
    roundTimeMs,
    ...(optional("minEntityCount") !== undefined
      ? { minEntityCount: optional("minEntityCount") }
      : {}),
    ...(optional("maxEntityCount") !== undefined
      ? { maxEntityCount: optional("maxEntityCount") }
      : {}),
    ...(optional("minAttributeCount") !== undefined
      ? { minAttributeCount: optional("minAttributeCount") }
      : {}),
    ...(optional("maxAttributeCount") !== undefined
      ? { maxAttributeCount: optional("maxAttributeCount") }
      : {}),
    ...(optional("minClueCount") !== undefined
      ? { minClueCount: optional("minClueCount") }
      : {}),
    ...(optional("maxClueCount") !== undefined
      ? { maxClueCount: optional("maxClueCount") }
      : {}),
  };
}

/**
 * Adaptive escalation: on a pass, make the puzzle harder (more entities /
 * attributes / clues); on a fail, ease up. Bounded by the adaptive params.
 */
export function adaptiveRoundParams(
  level: DifficultyLevel,
  params: LogicDeductionDifficultyParams,
  passed: boolean,
): LogicDeductionDifficultyParams {
  if (level !== "adaptive") {
    return params;
  }
  const clamp = (
    v: number,
    lo: number | undefined,
    hi: number | undefined,
  ): number => {
    let r = v;
    if (lo !== undefined) r = Math.max(lo, r);
    if (hi !== undefined) r = Math.min(hi, r);
    return r;
  };
  const step = passed ? 1 : -1;
  return {
    entityCount: clamp(
      params.entityCount + step,
      params.minEntityCount,
      params.maxEntityCount,
    ),
    attributeCount: clamp(
      params.attributeCount + step,
      params.minAttributeCount,
      params.maxAttributeCount,
    ),
    clueCount: clamp(
      params.clueCount + step,
      params.minClueCount,
      params.maxClueCount,
    ),
    rounds: params.rounds,
    roundTimeMs: clamp(
      params.roundTimeMs + (passed ? -1000 : 1000),
      10_000,
      30_000,
    ),
    minEntityCount: params.minEntityCount,
    maxEntityCount: params.maxEntityCount,
    minAttributeCount: params.minAttributeCount,
    maxAttributeCount: params.maxAttributeCount,
    minClueCount: params.minClueCount,
    maxClueCount: params.maxClueCount,
  };
}

/**
 * Final challenge rating. Fixed levels report the SDK default rating; adaptive
 * reports the normalized escalation of (entities * attributes) over the range.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalEntityCount: number,
  finalAttributeCount: number,
): number {
  if (level !== "adaptive") {
    return profile.challengeRating;
  }
  const p = logicDeductionParamsFromProfile(profile);
  const minC = (p.minEntityCount ?? 3) * (p.minAttributeCount ?? 2);
  const maxC = (p.maxEntityCount ?? 5) * (p.maxAttributeCount ?? 4);
  const span = maxC - minC;
  const actual = finalEntityCount * finalAttributeCount;
  return span > 0
    ? Math.min(1, Math.max(0, (actual - minC) / span))
    : profile.challengeRating;
}
