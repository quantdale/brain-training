/**
 * Named difficulty → concrete Word Chain parameters.
 *
 * `resolveWordChainDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Tier
 * selection is a numeric bitmask (t1=1, t2=2, t3=4) because the SDK profile
 * parameters are numbers; `tiersFromMask` decodes it. Fixed levels carry the
 * SDK default challenge ratings; `adaptive` starts at the neutral 0.5
 * baseline and the final rating derives from the tier the player reached
 * (`sessionChallengeRating`).
 */
import { resolveDifficulty } from "@/sdk";
import type { DifficultyLevel, DifficultyProfile } from "@/sdk";

import { isTier } from "./content-validation";
import type { Tier } from "./content-validation";
import type { WordChainDifficultyParams } from "./types";

/** Tier → bit value for the difficulty-profile tier mask. */
export const TIER_BITS: Readonly<Record<Tier, number>> = {
  t1: 1,
  t2: 2,
  t3: 4,
} as const;

/** Tier → 1-based ordinal (adaptive rating math). */
export const TIER_NUMBERS: Readonly<Record<Tier, number>> = {
  t1: 1,
  t2: 2,
  t3: 3,
} as const;

const TIER_BY_NUMBER: Readonly<Record<number, Tier>> = {
  1: "t1",
  2: "t2",
  3: "t3",
} as const;

/** 1-based tier ordinal (1..3). */
export function tierNumber(tier: Tier): number {
  return TIER_NUMBERS[tier];
}

/** Tier for a 1-based ordinal; throws outside 1..3. */
export function tierOfNumber(number: number): Tier {
  const tier = TIER_BY_NUMBER[number];
  if (tier === undefined) {
    throw new RangeError(
      `language-word-chain: tier must be 1..3, got ${number}`,
    );
  }
  return tier;
}

/** Decode a tier bitmask into the ordered tier list it selects. */
export function tiersFromMask(mask: number): readonly Tier[] {
  if (!Number.isInteger(mask) || mask < 1 || mask > 7) {
    throw new RangeError(
      `language-word-chain: tierMask must be an integer in [1, 7], got ${mask}`,
    );
  }
  return (["t1", "t2", "t3"] as const).filter(
    (tier) => (mask & TIER_BITS[tier]) !== 0,
  );
}

const BASE: Omit<WordChainDifficultyParams, "tierMask" | "rounds"> = {
  timePerRoundMs: 12_000,
  minChainLen: 5,
  maxChainLen: 6,
  minBlanks: 1,
  maxBlanks: 2,
  optionsPerStep: 3,
};

/** Fixed-level tuning: tier pool, chain count, budget, blanks, options. */
export const WORD_CHAIN_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, "adaptive">, WordChainDifficultyParams>
> = {
  easy: {
    ...BASE,
    tierMask: TIER_BITS.t1,
    rounds: 5,
    timePerRoundMs: 14_000,
    minChainLen: 5,
    maxChainLen: 5,
    minBlanks: 1,
    maxBlanks: 2,
    optionsPerStep: 3,
  },
  normal: {
    ...BASE,
    tierMask: TIER_BITS.t1 | TIER_BITS.t2,
    rounds: 6,
    timePerRoundMs: 12_000,
    minChainLen: 5,
    maxChainLen: 6,
    minBlanks: 2,
    maxBlanks: 3,
    optionsPerStep: 4,
  },
  hard: {
    ...BASE,
    tierMask: TIER_BITS.t2 | TIER_BITS.t3,
    rounds: 7,
    timePerRoundMs: 10_000,
    minChainLen: 6,
    maxChainLen: 6,
    minBlanks: 2,
    maxBlanks: 4,
    optionsPerStep: 4,
  },
  expert: {
    ...BASE,
    tierMask: TIER_BITS.t3,
    rounds: 8,
    timePerRoundMs: 8_500,
    minChainLen: 6,
    maxChainLen: 6,
    minBlanks: 3,
    maxBlanks: 4,
    optionsPerStep: 5,
  },
};

/** Adaptive tuning: all tiers; budget moves within [7000, 14000] by 1000ms steps. */
export const ADAPTIVE_PARAMS: Readonly<WordChainDifficultyParams> =
  Object.freeze({
    tierMask: TIER_BITS.t1 | TIER_BITS.t2 | TIER_BITS.t3,
    rounds: 6,
    timePerRoundMs: 9_000,
    minChainLen: 5,
    maxChainLen: 6,
    minBlanks: 1,
    maxBlanks: 3,
    optionsPerStep: 4,
    minTimePerRoundMs: 7_000,
    maxTimePerRoundMs: 14_000,
    timeStepMs: 1000,
    initialTier: 1,
  });

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function wordChainParamsForLevel(
  level: DifficultyLevel,
): WordChainDifficultyParams {
  if (level === "adaptive") {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...WORD_CHAIN_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveWordChainDifficulty(
  level: DifficultyLevel,
): DifficultyProfile {
  return resolveDifficulty(level, { ...wordChainParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * or an adaptive bound is nonsensical, instead of silently producing a broken
 * session.
 */
export function wordChainParamsFromProfile(
  profile: DifficultyProfile,
): WordChainDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(
        `language-word-chain: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const tierMask = requireNumber("tierMask");
  if (!Number.isInteger(tierMask) || tierMask < 1 || tierMask > 7) {
    throw new Error(
      `language-word-chain: difficulty profile has invalid tierMask ${tierMask}`,
    );
  }
  const rounds = requireNumber("rounds");
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new Error(
      `language-word-chain: difficulty profile has invalid rounds ${rounds}`,
    );
  }
  const timePerRoundMs = requireNumber("timePerRoundMs");
  if (timePerRoundMs <= 0) {
    throw new Error(
      `language-word-chain: difficulty profile has invalid timePerRoundMs ${timePerRoundMs}`,
    );
  }
  const minChainLen = requireNumber("minChainLen");
  if (!Number.isInteger(minChainLen) || minChainLen < 3) {
    throw new Error(
      `language-word-chain: difficulty profile has invalid minChainLen ${minChainLen}`,
    );
  }
  const maxChainLen = requireNumber("maxChainLen");
  if (!Number.isInteger(maxChainLen) || maxChainLen < minChainLen) {
    throw new Error(
      `language-word-chain: difficulty profile has invalid maxChainLen ${maxChainLen}`,
    );
  }
  const minBlanks = requireNumber("minBlanks");
  if (!Number.isInteger(minBlanks) || minBlanks < 1) {
    throw new Error(
      `language-word-chain: difficulty profile has invalid minBlanks ${minBlanks}`,
    );
  }
  const maxBlanks = requireNumber("maxBlanks");
  if (!Number.isInteger(maxBlanks) || maxBlanks < minBlanks) {
    throw new Error(
      `language-word-chain: difficulty profile has invalid maxBlanks ${maxBlanks}`,
    );
  }
  const optionsPerStep = requireNumber("optionsPerStep");
  if (!Number.isInteger(optionsPerStep) || optionsPerStep < 2) {
    throw new Error(
      `language-word-chain: difficulty profile has invalid optionsPerStep ${optionsPerStep}`,
    );
  }
  const optional = (key: string): number | undefined => {
    const value = p[key];
    if (value === undefined) {
      return undefined;
    }
    const number = requireNumber(key);
    if (number <= 0) {
      throw new Error(
        `language-word-chain: difficulty profile has invalid ${key} ${number}`,
      );
    }
    return number;
  };
  const minTimePerRoundMs = optional("minTimePerRoundMs");
  const maxTimePerRoundMs = optional("maxTimePerRoundMs");
  const timeStepMs = optional("timeStepMs");
  const initialTier = optional("initialTier");
  if (
    initialTier !== undefined &&
    (initialTier < 1 || initialTier > 3 || !Number.isInteger(initialTier))
  ) {
    throw new Error(
      `language-word-chain: difficulty profile has invalid initialTier ${initialTier}`,
    );
  }
  if (
    minTimePerRoundMs !== undefined &&
    maxTimePerRoundMs !== undefined &&
    minTimePerRoundMs > maxTimePerRoundMs
  ) {
    throw new Error(
      "language-word-chain: difficulty profile has minTimePerRoundMs > maxTimePerRoundMs",
    );
  }
  return {
    tierMask,
    rounds,
    timePerRoundMs,
    minChainLen,
    maxChainLen,
    minBlanks,
    maxBlanks,
    optionsPerStep,
    ...(minTimePerRoundMs !== undefined ? { minTimePerRoundMs } : {}),
    ...(maxTimePerRoundMs !== undefined ? { maxTimePerRoundMs } : {}),
    ...(timeStepMs !== undefined ? { timeStepMs } : {}),
    ...(initialTier !== undefined ? { initialTier } : {}),
  };
}

export interface NextRoundTuning {
  /** Tiers the next chain's items may come from. */
  readonly tiers: readonly Tier[];
  /** Answer budget for the next chain in ms. */
  readonly timePerRoundMs: number;
  /** Adaptive only: the active tier of the next chain; null for fixed levels. */
  readonly currentTier: Tier | null;
}

/**
 * Tuning of the next chain. Fixed levels keep their tier pool and budget.
 * Adaptive moves the active tier ±1 (capped at t1/t3) and the budget ±step
 * (clamped to [min, max]) after every chain: a pass pushes harder, a fail
 * (wrong or timeout) eases up.
 */
export function nextRoundParams(
  level: DifficultyLevel,
  params: WordChainDifficultyParams,
  currentTier: Tier | null,
  roundBudgetMs: number,
  passed: boolean,
): NextRoundTuning {
  if (level !== "adaptive") {
    return {
      tiers: tiersFromMask(params.tierMask),
      timePerRoundMs: params.timePerRoundMs,
      currentTier: null,
    };
  }
  const tier = currentTier ?? tierOfNumber(params.initialTier ?? 1);
  const nextTierNumber = passed
    ? Math.min(3, tierNumber(tier) + 1)
    : Math.max(1, tierNumber(tier) - 1);
  const minTime = params.minTimePerRoundMs ?? params.timePerRoundMs;
  const maxTime = params.maxTimePerRoundMs ?? params.timePerRoundMs;
  const step = params.timeStepMs ?? 0;
  const nextBudget = passed
    ? Math.max(minTime, roundBudgetMs - step)
    : Math.min(maxTime, roundBudgetMs + step);
  return {
    tiers: [tierOfNumber(nextTierNumber)],
    timePerRoundMs: nextBudget,
    currentTier: tierOfNumber(nextTierNumber),
  };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final tier mapped linearly into
 * [0, 1] over [t1, t3].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalTier: Tier | null,
): number {
  if (level !== "adaptive" || finalTier === null) {
    return profile.challengeRating;
  }
  return Math.min(1, Math.max(0, (tierNumber(finalTier) - 1) / 2));
}

/** True when `value` is a declared pack tier (validation helper). */
export function isValidTier(value: unknown): value is Tier {
  return isTier(value);
}
