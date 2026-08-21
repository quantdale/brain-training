/**
 * Named difficulty → concrete Rule Flip parameters.
 *
 * `resolveFlexibilityRuleFlipDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from the per-block flip rate the
 * player settled at (see `sessionChallengeRating`).
 *
 * Difficulty is driven by four dials: the size of the stimulus alphabet
 * (more shapes/colors/numbers = more visual load), the block RUN LENGTH
 * (`blockMin`/`blockMax` — longer same-rule runs make the rare flip harder to
 * detect), the per-block `flipRate` (higher = more frequent re-anchoring — the
 * flexibility demand), and the speed target. Note the counterintuitive part:
 * higher difficulty uses a LARGER alphabet + LONGER runs + RARER flips, which
 * is harder because the rare flip must be noticed amid a long stable run.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import { ALL_RULES } from './types';
import type { FlexibilityRuleFlipDifficultyParams, RuleId } from './types';

/** Fixed-level tuning: alphabet size, rounds, block run length, flip rate, speed, arm. */
export const FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, FlexibilityRuleFlipDifficultyParams>
> = {
  easy: {
    numShapes: 3,
    numColors: 3,
    numNumbers: 3,
    rounds: 8,
    blockMin: 1,
    blockMax: 2,
    flipRate: 0.7,
    rulesPool: ALL_RULES,
    speedTargetMs: 6000,
    switchArmMs: 900,
  },
  normal: {
    numShapes: 3,
    numColors: 3,
    numNumbers: 4,
    rounds: 10,
    blockMin: 2,
    blockMax: 3,
    flipRate: 0.55,
    rulesPool: ALL_RULES,
    speedTargetMs: 5000,
    switchArmMs: 800,
  },
  hard: {
    numShapes: 4,
    numColors: 4,
    numNumbers: 5,
    rounds: 12,
    blockMin: 3,
    blockMax: 5,
    flipRate: 0.45,
    rulesPool: ALL_RULES,
    speedTargetMs: 4000,
    switchArmMs: 700,
  },
  expert: {
    numShapes: 4,
    numColors: 4,
    numNumbers: 6,
    rounds: 12,
    blockMin: 4,
    blockMax: 7,
    flipRate: 0.35,
    rulesPool: ALL_RULES,
    speedTargetMs: 3000,
    switchArmMs: 600,
  },
};

/**
 * Adaptive tuning: neutral 3×3×4 alphabet; the per-block flip rate stays
 * constant for the session and the challenge rating is mapped from it at the
 * end (no mid-session change needed).
 */
export const ADAPTIVE_PARAMS: Readonly<FlexibilityRuleFlipDifficultyParams> = Object.freeze({
  numShapes: 3,
  numColors: 3,
  numNumbers: 4,
  rounds: 10,
  blockMin: 2,
  blockMax: 4,
  flipRate: 0.5,
  rulesPool: ALL_RULES,
  speedTargetMs: 4000,
  switchArmMs: 700,
  minFlipRate: 0.3,
  maxFlipRate: 0.9,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function flexibilityRuleFlipParamsForLevel(level: DifficultyLevel): FlexibilityRuleFlipDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS[level] };
}

/**
 * The numeric-only view of the params, suitable for the SDK's
 * `resolveDifficulty` (its `parameters` contract is `Record<string, number>`,
 * so the `rulesPool` array is intentionally excluded and rebuilt by
 * `flexibilityRuleFlipParamsFromProfile`).
 */
function numericParams(params: FlexibilityRuleFlipDifficultyParams): Record<string, number> {
  const numeric: Record<string, number> = {
    numShapes: params.numShapes,
    numColors: params.numColors,
    numNumbers: params.numNumbers,
    rounds: params.rounds,
    blockMin: params.blockMin,
    blockMax: params.blockMax,
    flipRate: params.flipRate,
    speedTargetMs: params.speedTargetMs,
    switchArmMs: params.switchArmMs,
  };
  if (params.minFlipRate !== undefined) {
    numeric.minFlipRate = params.minFlipRate;
  }
  if (params.maxFlipRate !== undefined) {
    numeric.maxFlipRate = params.maxFlipRate;
  }
  return numeric;
}

/** Resolve a level into a full difficulty profile carrying the Rule Flip tuning. */
export function resolveFlexibilityRuleFlipDifficulty(level: DifficultyLevel): DifficultyProfile {
  // Spread into a fresh record so the params object satisfies the SDK's
  // `Readonly<Record<string, number>>` contract.
  return resolveDifficulty(level, numericParams(flexibilityRuleFlipParamsForLevel(level)));
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken round. `rulesPool` is reconstructed
 * from the game constant (it is never stored in the numeric profile).
 */
export function flexibilityRuleFlipParamsFromProfile(
  profile: DifficultyProfile,
): FlexibilityRuleFlipDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`flexibility-rule-flip: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const minFlipRate =
    p.minFlipRate === undefined ? undefined : requireNumber('minFlipRate');
  const maxFlipRate =
    p.maxFlipRate === undefined ? undefined : requireNumber('maxFlipRate');
  return {
    numShapes: requireNumber('numShapes'),
    numColors: requireNumber('numColors'),
    numNumbers: requireNumber('numNumbers'),
    rounds: requireNumber('rounds'),
    blockMin: requireNumber('blockMin'),
    blockMax: requireNumber('blockMax'),
    flipRate: requireNumber('flipRate'),
    rulesPool: ALL_RULES,
    speedTargetMs: requireNumber('speedTargetMs'),
    switchArmMs: requireNumber('switchArmMs'),
    ...(minFlipRate !== undefined ? { minFlipRate } : {}),
    ...(maxFlipRate !== undefined ? { maxFlipRate } : {}),
  };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's constant flip rate mapped linearly into
 * [0, 1] (higher flip rate = more re-anchoring = harder = higher rating).
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalSwitchRate: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = flexibilityRuleFlipParamsFromProfile(profile);
  const min = params.minFlipRate ?? 0;
  const max = params.maxFlipRate ?? finalSwitchRate;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalSwitchRate - min) / span))
    : profile.challengeRating;
}

/**
 * Choose the next block's rule. With probability `flipRate` the rule flips to
 * one of the OTHER rules (chosen uniformly); otherwise it stays the same
 * (a "stay" block — the rule is constant but no re-anchoring is required).
 * Deterministic given the seeded `rng`.
 */
export function nextBlockRule(
  rng: { next(): number; pick<T>(items: readonly T[]): T },
  prevRule: RuleId,
  flipRate: number,
  rulesPool: readonly RuleId[],
): RuleId {
  const others: readonly RuleId[] = rulesPool.filter((r) => r !== prevRule);
  if (rng.next() < flipRate && others.length > 0) {
    return rng.pick(others);
  }
  return prevRule;
}
