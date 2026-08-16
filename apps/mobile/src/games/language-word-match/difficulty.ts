/**
 * Named difficulty → concrete Word Match parameters.
 *
 * `resolveLanguageDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Tier
 * selection is a numeric bitmask (t1=1, t2=2, t3=4) because the SDK profile
 * parameters are numbers; `tiersFromMask` decodes it. Fixed levels carry the
 * SDK default challenge ratings; `adaptive` starts at the neutral 0.5
 * baseline and the final rating derives from the tier the player reached
 * (`sessionChallengeRating`).
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import { isTier } from './content-validation';
import type { Tier } from './content-validation';
import type { LanguageDifficultyParams } from './types';

/** Tier → bit value for the difficulty-profile tier mask. */
export const TIER_BITS: Readonly<Record<Tier, number>> = { t1: 1, t2: 2, t3: 4 } as const;

/** Tier → 1-based ordinal (adaptive rating math). */
export const TIER_NUMBERS: Readonly<Record<Tier, number>> = { t1: 1, t2: 2, t3: 3 } as const;

const TIER_BY_NUMBER: Readonly<Record<number, Tier>> = { 1: 't1', 2: 't2', 3: 't3' } as const;

/** 1-based tier ordinal (1..3). */
export function tierNumber(tier: Tier): number {
  return TIER_NUMBERS[tier];
}

/** Tier for a 1-based ordinal; throws outside 1..3. */
export function tierOfNumber(number: number): Tier {
  const tier = TIER_BY_NUMBER[number];
  if (tier === undefined) {
    throw new RangeError(`language: tier must be 1..3, got ${number}`);
  }
  return tier;
}

/** Decode a tier bitmask into the ordered tier list it selects. */
export function tiersFromMask(mask: number): readonly Tier[] {
  if (!Number.isInteger(mask) || mask < 1 || mask > 7) {
    throw new RangeError(`language: tierMask must be an integer in [1, 7], got ${mask}`);
  }
  return (['t1', 't2', 't3'] as const).filter((tier) => (mask & TIER_BITS[tier]) !== 0);
}

/** Fixed-level tuning: tier pool, round count, per-round answer budget. */
export const LANGUAGE_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, LanguageDifficultyParams>
> = {
  easy: { tierMask: TIER_BITS.t1, rounds: 5, timePerRoundMs: 10_000 },
  normal: { tierMask: TIER_BITS.t1 | TIER_BITS.t2, rounds: 6, timePerRoundMs: 8_000 },
  hard: { tierMask: TIER_BITS.t2 | TIER_BITS.t3, rounds: 7, timePerRoundMs: 6_500 },
  expert: { tierMask: TIER_BITS.t3, rounds: 8, timePerRoundMs: 5_000 },
};

/** Adaptive tuning: all tiers; budget moves within [4000, 9000] by 500ms steps. */
export const ADAPTIVE_PARAMS: Readonly<LanguageDifficultyParams> = Object.freeze({
  tierMask: TIER_BITS.t1 | TIER_BITS.t2 | TIER_BITS.t3,
  rounds: 6,
  timePerRoundMs: 6_000,
  minTimePerRoundMs: 4_000,
  maxTimePerRoundMs: 9_000,
  timeStepMs: 500,
  initialTier: 1,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function languageParamsForLevel(level: DifficultyLevel): LanguageDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...LANGUAGE_DIFFICULTY_PARAMS[level] };
}

/** Resolve a level into a full difficulty profile carrying the game tuning. */
export function resolveLanguageDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, { ...languageParamsForLevel(level) });
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * or an adaptive bound is nonsensical, instead of silently producing a broken
 * session.
 */
export function languageParamsFromProfile(profile: DifficultyProfile): LanguageDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`language: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const tierMask = requireNumber('tierMask');
  if (!Number.isInteger(tierMask) || tierMask < 1 || tierMask > 7) {
    throw new Error(`language: difficulty profile has invalid tierMask ${tierMask}`);
  }
  const rounds = requireNumber('rounds');
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new Error(`language: difficulty profile has invalid rounds ${rounds}`);
  }
  const timePerRoundMs = requireNumber('timePerRoundMs');
  if (timePerRoundMs <= 0) {
    throw new Error(`language: difficulty profile has invalid timePerRoundMs ${timePerRoundMs}`);
  }
  const optional = (key: string): number | undefined => {
    const value = p[key];
    if (value === undefined) {
      return undefined;
    }
    const number = requireNumber(key);
    if (number <= 0) {
      throw new Error(`language: difficulty profile has invalid ${key} ${number}`);
    }
    return number;
  };
  const minTimePerRoundMs = optional('minTimePerRoundMs');
  const maxTimePerRoundMs = optional('maxTimePerRoundMs');
  const timeStepMs = optional('timeStepMs');
  const initialTier = optional('initialTier');
  if (initialTier !== undefined && (initialTier < 1 || initialTier > 3 || !Number.isInteger(initialTier))) {
    throw new Error(`language: difficulty profile has invalid initialTier ${initialTier}`);
  }
  if (minTimePerRoundMs !== undefined && maxTimePerRoundMs !== undefined && minTimePerRoundMs > maxTimePerRoundMs) {
    throw new Error('language: difficulty profile has minTimePerRoundMs > maxTimePerRoundMs');
  }
  return {
    tierMask,
    rounds,
    timePerRoundMs,
    ...(minTimePerRoundMs !== undefined ? { minTimePerRoundMs } : {}),
    ...(maxTimePerRoundMs !== undefined ? { maxTimePerRoundMs } : {}),
    ...(timeStepMs !== undefined ? { timeStepMs } : {}),
    ...(initialTier !== undefined ? { initialTier } : {}),
  };
}

export interface NextRoundTuning {
  /** Tiers the next round's item may come from. */
  readonly tiers: readonly Tier[];
  /** Answer budget for the next round in ms. */
  readonly timePerRoundMs: number;
  /** Adaptive only: the active tier of the next round; null for fixed levels. */
  readonly currentTier: Tier | null;
}

/**
 * Tuning of the next round. Fixed levels keep their tier pool and budget.
 * Adaptive moves the active tier ±1 (capped at t1/t3) and the budget ±step
 * (clamped to [min, max]) after every round: a pass pushes harder, a fail
 * (wrong or timeout) eases up.
 */
export function nextRoundParams(
  level: DifficultyLevel,
  params: LanguageDifficultyParams,
  currentTier: Tier | null,
  roundBudgetMs: number,
  passed: boolean,
): NextRoundTuning {
  if (level !== 'adaptive') {
    return {
      tiers: tiersFromMask(params.tierMask),
      timePerRoundMs: params.timePerRoundMs,
      currentTier: null,
    };
  }
  const tier = currentTier ?? tierOfNumber(params.initialTier ?? 1);
  const nextTierNumber = passed ? Math.min(3, tierNumber(tier) + 1) : Math.max(1, tierNumber(tier) - 1);
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
  if (level !== 'adaptive' || finalTier === null) {
    return profile.challengeRating;
  }
  return Math.min(1, Math.max(0, (tierNumber(finalTier) - 1) / 2));
}

/** True when `value` is a declared pack tier (validation helper). */
export function isValidTier(value: unknown): value is Tier {
  return isTier(value);
}
