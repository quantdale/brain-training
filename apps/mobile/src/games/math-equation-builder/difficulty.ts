/**
 * Named difficulty → concrete Equation Builder parameters.
 *
 * `resolveMathEquationBuilderDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the player
 * escalated (see `sessionChallengeRating`).
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { MathEquationBuilderDifficultyParams, Operator } from './types';

/** Fixed-level tuning: numbers count, target range, operators, rounds, time budget. */
export const MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, MathEquationBuilderDifficultyParams>
> = {
  easy: {
    numbersCount: 3,
    targetMin: 10,
    targetMax: 30,
    operators: ['+', '-'],
    rounds: 4,
    timeBudgetMs: 60_000,
  },
  normal: {
    numbersCount: 4,
    targetMin: 10,
    targetMax: 50,
    operators: ['+', '-', '×'],
    rounds: 5,
    timeBudgetMs: 50_000,
  },
  hard: {
    numbersCount: 4,
    targetMin: 20,
    targetMax: 100,
    operators: ['+', '-', '×', '÷'],
    rounds: 6,
    timeBudgetMs: 45_000,
  },
  expert: {
    numbersCount: 5,
    targetMin: 50,
    targetMax: 200,
    operators: ['+', '-', '×', '÷'],
    rounds: 7,
    timeBudgetMs: 40_000,
  },
};

/** Adaptive tuning: starts easy, escalates within bounds. */
export const ADAPTIVE_PARAMS: Readonly<MathEquationBuilderDifficultyParams> = Object.freeze({
  numbersCount: 3,
  targetMin: 10,
  targetMax: 30,
  operators: ['+', '-'] as readonly Operator[],
  rounds: 5,
  timeBudgetMs: 50_000,
  minNumbersCount: 3,
  maxNumbersCount: 5,
  minTarget: 10,
  maxTarget: 200,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function mathEquationBuilderParamsForLevel(
  level: DifficultyLevel,
): MathEquationBuilderDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS[level] };
}

/**
 * Convert difficulty params to a flat numeric record for the SDK profile.
 * Operators are encoded as flags: hasPlus, hasMinus, hasTimes, hasDivide.
 */
function paramsToProfileRecord(
  params: MathEquationBuilderDifficultyParams,
): Record<string, number> {
  const record: Record<string, number> = {
    numbersCount: params.numbersCount,
    targetMin: params.targetMin,
    targetMax: params.targetMax,
    rounds: params.rounds,
    timeBudgetMs: params.timeBudgetMs,
    hasPlus: params.operators.includes('+') ? 1 : 0,
    hasMinus: params.operators.includes('-') ? 1 : 0,
    hasTimes: params.operators.includes('×') ? 1 : 0,
    hasDivide: params.operators.includes('÷') ? 1 : 0,
  };
  if (params.minNumbersCount !== undefined) record.minNumbersCount = params.minNumbersCount;
  if (params.maxNumbersCount !== undefined) record.maxNumbersCount = params.maxNumbersCount;
  if (params.minTarget !== undefined) record.minTarget = params.minTarget;
  if (params.maxTarget !== undefined) record.maxTarget = params.maxTarget;
  return record;
}

/** Resolve a level into a full difficulty profile carrying the Equation Builder tuning. */
export function resolveMathEquationBuilderDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, paramsToProfileRecord(mathEquationBuilderParamsForLevel(level)));
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken puzzle.
 */
export function mathEquationBuilderParamsFromProfile(
  profile: DifficultyProfile,
): MathEquationBuilderDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(
        `math-equation-builder: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const operators: Operator[] = [];
  // Operators are stored as individual flags in the profile parameters.
  if (p.hasPlus) operators.push('+');
  if (p.hasMinus) operators.push('-');
  if (p.hasTimes) operators.push('×');
  if (p.hasDivide) operators.push('÷');
  // At least one operator must be present.
  if (operators.length === 0) {
    operators.push('+');
  }

  const minNumbersCount =
    p.minNumbersCount === undefined ? undefined : requireNumber('minNumbersCount');
  const maxNumbersCount =
    p.maxNumbersCount === undefined ? undefined : requireNumber('maxNumbersCount');
  const minTarget = p.minTarget === undefined ? undefined : requireNumber('minTarget');
  const maxTarget = p.maxTarget === undefined ? undefined : requireNumber('maxTarget');

  return {
    numbersCount: requireNumber('numbersCount'),
    targetMin: requireNumber('targetMin'),
    targetMax: requireNumber('targetMax'),
    operators,
    rounds: Math.round(requireNumber('rounds')),
    timeBudgetMs: requireNumber('timeBudgetMs'),
    ...(minNumbersCount !== undefined ? { minNumbersCount } : {}),
    ...(maxNumbersCount !== undefined ? { maxNumbersCount } : {}),
    ...(minTarget !== undefined ? { minTarget } : {}),
    ...(maxTarget !== undefined ? { maxTarget } : {}),
  };
}

/**
 * All operator sets for adaptive escalation. Ordered from easiest to hardest.
 */
const ADAPTIVE_OPERATOR_LEVELS: readonly (readonly Operator[])[] = [
  ['+', '-'],
  ['+', '-', '×'],
  ['+', '-', '×', '÷'],
];

/**
 * Difficulty params for the next adaptive round. Escalates on a pass,
 * de-escalates on a failure, clamped within bounds.
 */
export function nextAdaptiveParams(
  prevParams: MathEquationBuilderDifficultyParams,
  passed: boolean,
): MathEquationBuilderDifficultyParams {
  const minN = prevParams.minNumbersCount ?? 3;
  const maxN = prevParams.maxNumbersCount ?? 5;
  const minT = prevParams.minTarget ?? 10;
  const maxT = prevParams.maxTarget ?? 200;

  // Escalate: increase numbers count and target range
  const step = passed ? 1 : -1;

  // Numbers count: move in steps of 1
  const newNumbersCount = Math.min(maxN, Math.max(minN, prevParams.numbersCount + step));

  // Target range: expand/contract proportionally
  const targetSpan = maxT - minT;
  const ratio = (newNumbersCount - minN) / Math.max(1, maxN - minN);
  const halfSpan = Math.round(targetSpan * (0.2 + 0.6 * ratio));
  const newTargetMin = Math.max(minT, Math.round(minT + (targetSpan / 2 - halfSpan)));
  const newTargetMax = Math.min(maxT, newTargetMin + 2 * halfSpan);

  // Operators: escalate/de-escalate with numbers count
  const opLevel = Math.min(
    ADAPTIVE_OPERATOR_LEVELS.length - 1,
    Math.max(0, newNumbersCount - minN),
  );
  const operators = ADAPTIVE_OPERATOR_LEVELS[opLevel];

  // Time budget: tighten as difficulty increases
  const timeBudgetMs = Math.round(60_000 - 5000 * (newNumbersCount - minN));

  return {
    numbersCount: newNumbersCount,
    targetMin: newTargetMin,
    targetMax: newTargetMax,
    operators,
    rounds: prevParams.rounds,
    timeBudgetMs,
    minNumbersCount: minN,
    maxNumbersCount: maxN,
    minTarget: minT,
    maxTarget: maxT,
  };
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's final numbers count mapped linearly
 * into [0, 1] over [minNumbersCount, maxNumbersCount].
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalNumbersCount: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = mathEquationBuilderParamsFromProfile(profile);
  const min = params.minNumbersCount ?? params.numbersCount;
  const max = params.maxNumbersCount ?? params.numbersCount;
  const span = max - min;
  return span > 0
    ? Math.min(1, Math.max(0, (finalNumbersCount - min) / span))
    : profile.challengeRating;
}
