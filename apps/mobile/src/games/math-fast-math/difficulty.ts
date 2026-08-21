/**
 * Named difficulty → concrete Fast Math parameters.
 *
 * `resolveMathDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 *
 * Parameter encoding: the SDK difficulty profile only carries numbers, so the
 * rich `MathDifficultyParams` shape is encoded deterministically — operators
 * as a bitmask (`operatorMask`, bits '+':1 '−':2 '×':4 '÷':8), `timeBudgetMs`
 * as 0 when untimed, and one `maxLeft_<op>` / `maxRight_<op>` pair per
 * operator. `mathParamsFromProfile` decodes and validates strictly.
 *
 * Division invariant (enforced by config, asserted in tests): for '÷',
 * `maxLeft >= maxRight²` so `left = answer * right` with answer/right drawn
 * from [2, maxRight] can never exceed the declared dividend range — division
 * problems are always in-range and always exact by construction.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import { OPERATORS } from './types';
import type { MathDifficultyParams, Operator, OperatorRange } from './types';

/** Fixed-level tuning: rounds, per-problem budget, operator mix, ranges. */
export const MATH_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, MathDifficultyParams>
> = {
  easy: {
    rounds: 4,
    timeBudgetMs: 10_000,
    operators: ['+', '−'],
    ranges: {
      '+': { maxLeft: 10, maxRight: 10 },
      '−': { maxLeft: 10, maxRight: 10 },
      '×': { maxLeft: 6, maxRight: 6 },
      '÷': { maxLeft: 25, maxRight: 5 },
    },
  },
  normal: {
    rounds: 5,
    timeBudgetMs: 8_000,
    operators: ['+', '−', '×'],
    ranges: {
      '+': { maxLeft: 12, maxRight: 12 },
      '−': { maxLeft: 12, maxRight: 12 },
      '×': { maxLeft: 9, maxRight: 9 },
      '÷': { maxLeft: 64, maxRight: 8 },
    },
  },
  hard: {
    rounds: 6,
    timeBudgetMs: 6_000,
    operators: ['+', '−', '×', '÷'],
    ranges: {
      '+': { maxLeft: 20, maxRight: 20 },
      '−': { maxLeft: 20, maxRight: 20 },
      '×': { maxLeft: 12, maxRight: 12 },
      '÷': { maxLeft: 100, maxRight: 10 },
    },
  },
  expert: {
    rounds: 7,
    timeBudgetMs: 4_000,
    operators: ['+', '−', '×', '÷'],
    ranges: {
      '+': { maxLeft: 30, maxRight: 30 },
      '−': { maxLeft: 30, maxRight: 30 },
      '×': { maxLeft: 15, maxRight: 15 },
      '÷': { maxLeft: 169, maxRight: 13 },
    },
    // Expert-only two-step tier: ~1 in 3 problems is `a op b ± c`, raising the
    // ceiling above single-step recall while staying exact and non-negative.
    twoStepChance: 0.35,
  },
};

/** Adaptive tuning: the session starts at a neutral tier (step 0) and the
 * difficulty step moves ±1 per answered problem within [minStep, maxStep];
 * ranges and budget interpolate linearly toward the expert tier, and the
 * operator mix grows with the step (see `adaptiveParamsForStep`).
 */
export const ADAPTIVE_PARAMS: Readonly<MathDifficultyParams> = Object.freeze<MathDifficultyParams>({
  rounds: 6,
  timeBudgetMs: 8_000,
  operators: ['+', '−'],
  ranges: {
    '+': { maxLeft: 12, maxRight: 12 },
    '−': { maxLeft: 12, maxRight: 12 },
    '×': { maxLeft: 9, maxRight: 9 },
    '÷': { maxLeft: 100, maxRight: 8 },
  },
  minStep: 0,
  maxStep: 4,
});

/** Adaptive difficulty-step bounds (recorded in the adaptive profile). */
export const ADAPTIVE_MIN_STEP = 0;
export const ADAPTIVE_MAX_STEP = 4;

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function mathParamsForLevel(level: DifficultyLevel): MathDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS, ranges: { ...ADAPTIVE_PARAMS.ranges } };
  }
  const params = MATH_DIFFICULTY_PARAMS[level];
  return { ...params, ranges: { ...params.ranges } };
}

/** Resolve a level into a full difficulty profile carrying the Fast Math tuning. */
export function resolveMathDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, mathParamsToRecord(mathParamsForLevel(level)));
}

/** Operator bitmask (profile encoding; '+':1 '−':2 '×':4 '÷':8). */
export const OPERATOR_MASK: Readonly<Record<Operator, number>> = {
  '+': 1,
  '−': 2,
  '×': 4,
  '÷': 8,
};

/** Bitmask of the params' operator mix (canonical profile encoding). */
export function operatorMaskOf(params: MathDifficultyParams): number {
  let mask = 0;
  for (const operator of params.operators) {
    mask |= OPERATOR_MASK[operator];
  }
  return mask;
}

/** Encode the rich params into the SDK profile's number-only record. */
export function mathParamsToRecord(
  params: MathDifficultyParams,
): Readonly<Record<string, number>> {
  const record: Record<string, number> = {
    rounds: params.rounds,
    timeBudgetMs: params.timeBudgetMs ?? 0,
    operatorMask: operatorMaskOf(params),
  };
  for (const operator of OPERATORS) {
    record[`maxLeft_${operator}`] = params.ranges[operator].maxLeft;
    record[`maxRight_${operator}`] = params.ranges[operator].maxRight;
  }
  if (params.minStep !== undefined) {
    record.minStep = params.minStep;
  }
  if (params.maxStep !== undefined) {
    record.maxStep = params.maxStep;
  }
  if (params.twoStepChance !== undefined) {
    record.twoStepChance = params.twoStepChance;
  }
  return record;
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * or the operator mask is not a subset of the known bits, instead of silently
 * producing a broken session.
 */
export function mathParamsFromProfile(profile: DifficultyProfile): MathDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`math-fast-math: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  const rounds = requireNumber('rounds');
  const timeBudgetMs = requireNumber('timeBudgetMs');
  const mask = requireNumber('operatorMask');
  const ranges: Record<Operator, OperatorRange> = {} as Record<Operator, OperatorRange>;
  for (const operator of OPERATORS) {
    ranges[operator] = {
      maxLeft: requireNumber(`maxLeft_${operator}`),
      maxRight: requireNumber(`maxRight_${operator}`),
    };
  }
  const minStep = p.minStep === undefined ? undefined : requireNumber('minStep');
  const maxStep = p.maxStep === undefined ? undefined : requireNumber('maxStep');
  // Optional (older persisted profiles predate the two-step tier).
  const twoStepChance =
    p.twoStepChance === undefined ? undefined : requireNumber('twoStepChance');
  if (
    twoStepChance !== undefined &&
    (twoStepChance < 0 || twoStepChance > 1)
  ) {
    throw new Error(
      `math-fast-math: difficulty profile has invalid twoStepChance "${String(twoStepChance)}"`,
    );
  }
  return {
    rounds,
    timeBudgetMs: timeBudgetMs === 0 ? null : timeBudgetMs,
    ranges,
    operators: operatorsFromMask(mask),
    ...(minStep !== undefined ? { minStep } : {}),
    ...(maxStep !== undefined ? { maxStep } : {}),
    ...(twoStepChance !== undefined ? { twoStepChance } : {}),
  };
}

/** Decode an operator bitmask into the canonical operator order. */
export function operatorsFromMask(mask: number): Operator[] {
  if (!Number.isInteger(mask) || mask < 1 || mask > 15) {
    throw new Error(
      `math-fast-math: difficulty profile has invalid operatorMask "${String(mask)}"`,
    );
  }
  return OPERATORS.filter((operator) => (mask & OPERATOR_MASK[operator]) !== 0);
}

/**
 * Adaptive-only: operator mix at a given step. Division (the hardest operator)
 * only joins the mix at the top step, when the interpolated ranges are large
 * enough to keep the ÷ config invariant (maxLeft ≥ maxRight²).
 */
export function operatorsForStep(step: number): readonly Operator[] {
  if (step >= ADAPTIVE_MAX_STEP) {
    return OPERATORS;
  }
  if (step >= 2) {
    return ['+', '−', '×'];
  }
  return ['+', '−'];
}

/**
 * Adaptive-only: concrete params for a difficulty step. Ranges and budget
 * interpolate linearly between the adaptive base and the expert tier
 * (rounded); rounds and the operator mix follow the step rules. Steps outside
 * [minStep, maxStep] clamp to the bounds (deterministic).
 */
export function adaptiveParamsForStep(
  base: MathDifficultyParams,
  step: number,
): MathDifficultyParams {
  const min = base.minStep ?? ADAPTIVE_MIN_STEP;
  const max = base.maxStep ?? ADAPTIVE_MAX_STEP;
  const span = max - min;
  const t = span > 0 ? Math.min(1, Math.max(0, (step - min) / span)) : 0;
  const target = MATH_DIFFICULTY_PARAMS.expert;
  const ranges: Record<Operator, OperatorRange> = {} as Record<Operator, OperatorRange>;
  for (const operator of OPERATORS) {
    ranges[operator] = {
      maxLeft: Math.round(
        base.ranges[operator].maxLeft +
          (target.ranges[operator].maxLeft - base.ranges[operator].maxLeft) * t,
      ),
      maxRight: Math.round(
        base.ranges[operator].maxRight +
          (target.ranges[operator].maxRight - base.ranges[operator].maxRight) * t,
      ),
    };
  }
  const timeBudgetMs =
    base.timeBudgetMs !== null && target.timeBudgetMs !== null
      ? Math.round(base.timeBudgetMs + (target.timeBudgetMs - base.timeBudgetMs) * t)
      : base.timeBudgetMs;
  // Two-step tier ramps in with the ranges toward the expert chance; omitted
  // while zero so step 0 reproduces the base params exactly.
  const twoStepChance =
    (base.twoStepChance ?? 0) + ((target.twoStepChance ?? 0) - (base.twoStepChance ?? 0)) * t;
  return {
    rounds: base.rounds,
    timeBudgetMs,
    ranges,
    operators: operatorsForStep(step),
    minStep: min,
    maxStep: max,
    ...(twoStepChance > 0 ? { twoStepChance } : {}),
  };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final difficulty step mapped linearly
 * into [0, 1] over [minStep, maxStep].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalStep: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = mathParamsFromProfile(profile);
  const min = params.minStep ?? ADAPTIVE_MIN_STEP;
  const max = params.maxStep ?? ADAPTIVE_MAX_STEP;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalStep - min) / span))
    : profile.challengeRating;
}
