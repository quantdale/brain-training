/**
 * Named difficulty → concrete Math Missing Operator parameters.
 *
 * `resolveMathMissingOperatorDifficulty` plugs the game's tuning into the
 * SDK's `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from the per-round outcome
 * movement (see `adaptiveRatingAfter` / `sessionChallengeRating`).
 *
 * Parameter invariants (enforced by the generator and covered by tests):
 * - `minA > minB` and `minA ≥ 4`: subtraction is always feasible (a ≥ minB+1)
 *   and the only ambiguous pairs — (2,2) for `+`/`×` and (4,2) for `−`/`÷` —
 *   are impossible or explicitly excluded, so every equation has exactly one
 *   correct operator among all four displayed buttons.
 * - `minB ≥ 2`: no trivial `×1`/`÷1` equations.
 * - For division-including levels, `ceil(minA/2) ≤ maxB`: round-0 division
 *   (quotient 2 × divisor ≈ minA/2) is always feasible.
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import { clamp01 } from './scoring';
import type { MathMissingOperatorDifficultyParams } from './types';
import { OPERATORS } from './types';

/** Fixed-level tuning: operand ranges, candidate operators, time budget, rounds. */
export const MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, MathMissingOperatorDifficultyParams>
> = {
  easy: {
    minA: 4,
    maxA: 12,
    minB: 2,
    maxB: 3,
    operators: ['+', '-'],
    baseTimeMs: 12000,
    minTimeMs: 7000,
    shrinkPerRound: 0.94,
    rounds: 6,
  },
  normal: {
    minA: 6,
    maxA: 24,
    minB: 2,
    maxB: 5,
    operators: ['+', '-', '*'],
    baseTimeMs: 10000,
    minTimeMs: 6000,
    shrinkPerRound: 0.93,
    rounds: 7,
  },
  hard: {
    minA: 8,
    maxA: 40,
    minB: 2,
    maxB: 7,
    operators: OPERATORS,
    baseTimeMs: 9000,
    minTimeMs: 5000,
    shrinkPerRound: 0.92,
    rounds: 8,
  },
  expert: {
    minA: 12,
    maxA: 99,
    minB: 2,
    maxB: 11,
    operators: OPERATORS,
    baseTimeMs: 8000,
    minTimeMs: 4000,
    shrinkPerRound: 0.91,
    rounds: 9,
  },
};

/**
 * Adaptive tuning: neutral mid-range operand window over the full operator
 * set; the per-round first-operand ceiling follows both the round index and
 * the live adaptive rating (see `aMaxForRound`).
 */
export const ADAPTIVE_PARAMS: Readonly<MathMissingOperatorDifficultyParams> = Object.freeze({
  minA: 6,
  maxA: 60,
  minB: 2,
  maxB: 9,
  operators: OPERATORS,
  baseTimeMs: 10000,
  minTimeMs: 4000,
  shrinkPerRound: 0.92,
  rounds: 8,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function mathMissingOperatorParamsForLevel(
  level: DifficultyLevel,
): MathMissingOperatorDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS[level] };
}

/**
 * Resolve a level into a full difficulty profile carrying this game's tuning.
 *
 * The SDK's profile `parameters` only carry numbers, so the candidate operator
 * set is deliberately not serialized — it is recovered from the persisted
 * `level` in `mathMissingOperatorParamsFromProfile`.
 */
export function resolveMathMissingOperatorDifficulty(
  level: DifficultyLevel,
): DifficultyProfile {
  const params = mathMissingOperatorParamsForLevel(level);
  const numericParams: Readonly<Record<string, number>> = {
    minA: params.minA,
    maxA: params.maxA,
    minB: params.minB,
    maxB: params.maxB,
    baseTimeMs: params.baseTimeMs,
    minTimeMs: params.minTimeMs,
    shrinkPerRound: params.shrinkPerRound,
    rounds: params.rounds,
  };
  return resolveDifficulty(level, numericParams);
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * instead of silently producing a broken equation.
 *
 * The candidate operator set is a property of the named level (the SDK's
 * profile `parameters` only carries numbers), so it is recovered from the
 * persisted `profile.level` rather than serialized.
 */
export function mathMissingOperatorParamsFromProfile(
  profile: DifficultyProfile,
): MathMissingOperatorDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`math-missing-operator: difficulty profile is missing numeric parameter "${key}"`);
    }
    return value;
  };
  return {
    ...mathMissingOperatorParamsForLevel(profile.level),
    minA: requireNumber('minA'),
    maxA: requireNumber('maxA'),
    minB: requireNumber('minB'),
    maxB: requireNumber('maxB'),
    baseTimeMs: requireNumber('baseTimeMs'),
    minTimeMs: requireNumber('minTimeMs'),
    shrinkPerRound: requireNumber('shrinkPerRound'),
    rounds: requireNumber('rounds'),
  };
}

/**
 * First-operand ceiling of a round. Fixed levels escalate linearly from
 * `minA` (round 0) to `maxA` (last round). Adaptive levels blend the round
 * index with the live rating: progress = 0.5·(round/(rounds−1)) +
 * 0.5·(rating−0.5), so a stronger player meets larger operands earlier.
 * Always integer and within [minA, maxA].
 */
export function aMaxForRound(
  params: MathMissingOperatorDifficultyParams,
  roundIndex: number,
  level: DifficultyLevel,
  rating = 0.5,
): number {
  const span = params.maxA - params.minA;
  if (level === 'adaptive') {
    const indexProgress = params.rounds <= 1 ? 1 : roundIndex / (params.rounds - 1);
    const progress = clamp01(indexProgress * 0.5 + (rating - 0.5) * 0.5);
    return Math.round(params.minA + span * progress);
  }
  const progress = params.rounds <= 1 ? 1 : roundIndex / (params.rounds - 1);
  return Math.round(params.minA + span * progress);
}

/**
 * Time budget (ms) of a round: `baseTimeMs` shrinks by `shrinkPerRound` per
 * round and is floored at `minTimeMs`. Round 0 is exactly `baseTimeMs`.
 */
export function budgetForRound(
  params: MathMissingOperatorDifficultyParams,
  roundIndex: number,
): number {
  return Math.max(
    params.minTimeMs,
    Math.round(params.baseTimeMs * Math.pow(params.shrinkPerRound, roundIndex)),
  );
}

/**
 * Next adaptive rating after a round outcome. Correct answers raise the
 * rating (+0.10 when answered within half the budget, +0.08 otherwise),
 * wrong answers lower it (−0.08), timeouts lower it further (−0.12). The
 * rating is clamped to [0, 1] after every update.
 */
export function adaptiveRatingAfter(
  rating: number,
  outcome: 'correct' | 'wrong' | 'timeout',
  fast = false,
): number {
  const delta =
    outcome === 'correct' ? (fast ? 0.1 : 0.08) : outcome === 'wrong' ? -0.08 : -0.12;
  return clamp01(rating + delta);
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports the player's live rating at the end of the
 * session (clamped).
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalRating: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  return clamp01(finalRating);
}
