import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import { isTier } from './content-validation';
import type { Tier } from './content-validation';
import type { ContextFitDifficultyParams } from './types';

export const TIER_BITS: Readonly<Record<Tier, number>> = { t1: 1, t2: 2, t3: 4 } as const;
export const TIER_NUMBERS: Readonly<Record<Tier, number>> = { t1: 1, t2: 2, t3: 3 } as const;
const TIER_BY_NUMBER: Readonly<Record<number, Tier>> = { 1: 't1', 2: 't2', 3: 't3' } as const;

export function tierNumber(tier: Tier): number {
  return TIER_NUMBERS[tier];
}

export function tierOfNumber(number: number): Tier {
  const tier = TIER_BY_NUMBER[number];
  if (tier === undefined) throw new RangeError(`context-fit: tier must be 1..3, got ${number}`);
  return tier;
}

export function tiersFromMask(mask: number): readonly Tier[] {
  if (!Number.isInteger(mask) || mask < 1 || mask > 7) {
    throw new RangeError(`context-fit: tierMask must be an integer in [1, 7], got ${mask}`);
  }
  return (['t1', 't2', 't3'] as const).filter((tier) => (mask & TIER_BITS[tier]) !== 0);
}

export const CONTEXT_FIT_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, ContextFitDifficultyParams>
> = {
  easy: { tierMask: TIER_BITS.t1, rounds: 5, timePerRoundMs: 12_000 },
  normal: { tierMask: TIER_BITS.t1 | TIER_BITS.t2, rounds: 6, timePerRoundMs: 9_000 },
  hard: { tierMask: TIER_BITS.t2 | TIER_BITS.t3, rounds: 7, timePerRoundMs: 7_000 },
  expert: { tierMask: TIER_BITS.t3, rounds: 8, timePerRoundMs: 5_500 },
};

export const ADAPTIVE_PARAMS: Readonly<ContextFitDifficultyParams> = Object.freeze({
  tierMask: TIER_BITS.t1 | TIER_BITS.t2 | TIER_BITS.t3,
  rounds: 6,
  timePerRoundMs: 7_000,
  minTimePerRoundMs: 4_500,
  maxTimePerRoundMs: 11_000,
  timeStepMs: 500,
  initialTier: 1,
});

export function contextFitParamsForLevel(level: DifficultyLevel): ContextFitDifficultyParams {
  if (level === 'adaptive') return { ...ADAPTIVE_PARAMS };
  return { ...CONTEXT_FIT_DIFFICULTY_PARAMS[level] };
}

export function resolveContextFitDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, { ...contextFitParamsForLevel(level) });
}

export function contextFitParamsFromProfile(profile: DifficultyProfile): ContextFitDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`context-fit: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const tierMask = requireNumber('tierMask');
  if (!Number.isInteger(tierMask) || tierMask < 1 || tierMask > 7) {
    throw new Error(`context-fit: difficulty profile has invalid tierMask ${tierMask}`);
  }
  const rounds = requireNumber('rounds');
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new Error(`context-fit: difficulty profile has invalid rounds ${rounds}`);
  }
  const timePerRoundMs = requireNumber('timePerRoundMs');
  if (timePerRoundMs <= 0) {
    throw new Error(`context-fit: difficulty profile has invalid timePerRoundMs ${timePerRoundMs}`);
  }
  const optional = (key: string): number | undefined => {
    const value = p[key];
    if (value === undefined) return undefined;
    const number = requireNumber(key);
    if (number <= 0) throw new Error(`context-fit: difficulty profile has invalid ${key} ${number}`);
    return number;
  };
  const minTimePerRoundMs = optional('minTimePerRoundMs');
  const maxTimePerRoundMs = optional('maxTimePerRoundMs');
  const timeStepMs = optional('timeStepMs');
  const initialTier = optional('initialTier');
  if (initialTier !== undefined && (initialTier < 1 || initialTier > 3 || !Number.isInteger(initialTier))) {
    throw new Error(`context-fit: difficulty profile has invalid initialTier ${initialTier}`);
  }
  if (minTimePerRoundMs !== undefined && maxTimePerRoundMs !== undefined && minTimePerRoundMs > maxTimePerRoundMs) {
    throw new Error('context-fit: difficulty profile has minTimePerRoundMs > maxTimePerRoundMs');
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
  readonly tiers: readonly Tier[];
  readonly timePerRoundMs: number;
  readonly currentTier: Tier | null;
}

export function nextRoundParams(
  level: DifficultyLevel,
  params: ContextFitDifficultyParams,
  currentTier: Tier | null,
  roundBudgetMs: number,
  passed: boolean,
): NextRoundTuning {
  if (level !== 'adaptive') {
    return { tiers: tiersFromMask(params.tierMask), timePerRoundMs: params.timePerRoundMs, currentTier: null };
  }
  const tier = currentTier ?? tierOfNumber(params.initialTier ?? 1);
  const nextTierNumber = passed ? Math.min(3, tierNumber(tier) + 1) : Math.max(1, tierNumber(tier) - 1);
  const minTime = params.minTimePerRoundMs ?? params.timePerRoundMs;
  const maxTime = params.maxTimePerRoundMs ?? params.timePerRoundMs;
  const step = params.timeStepMs ?? 0;
  const nextBudget = passed ? Math.max(minTime, roundBudgetMs - step) : Math.min(maxTime, roundBudgetMs + step);
  return { tiers: [tierOfNumber(nextTierNumber)], timePerRoundMs: nextBudget, currentTier: tierOfNumber(nextTierNumber) };
}

export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalTier: Tier | null,
): number {
  if (level !== 'adaptive' || finalTier === null) return profile.challengeRating;
  return Math.min(1, Math.max(0, (tierNumber(finalTier) - 1) / 2));
}

export function isValidTier(value: unknown): value is Tier {
  return isTier(value);
}
