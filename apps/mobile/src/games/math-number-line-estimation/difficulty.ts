/**
 * Named difficulty → concrete Number Line Estimation parameters.
 *
 * `resolveNumberLineDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the hit tolerance
 * tightened during play (see `sessionChallengeRating`).
 *
 * Parameter encoding: the SDK difficulty profile only carries numbers, so all
 * tuning fields are numbers already (`tolerancePct` etc. are percents).
 * `numberLineParamsFromProfile` decodes and validates strictly.
 *
 * Difficulty direction: a SMALLER tolerance and a LARGER range are harder.
 * Adaptive tightens the tolerance after a hit and relaxes it after a
 * miss/timeout, within [minTolerancePct, maxTolerancePct].
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { NumberLineDifficultyParams } from './types';

/** Fixed-level tuning: rounds, budget, line range, hit tolerance. */
export const NUMBER_LINE_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, NumberLineDifficultyParams>
> = {
  easy: { rounds: 8, budgetMs: 12_000, lineMin: 0, lineMax: 10, tolerancePct: 8 },
  normal: { rounds: 10, budgetMs: 10_000, lineMin: 0, lineMax: 20, tolerancePct: 6 },
  hard: { rounds: 12, budgetMs: 8_000, lineMin: 0, lineMax: 100, tolerancePct: 4 },
  // Expert shifts to a non-zero origin: with endpoints [250, 750] no
  // anchor-relative heuristic ("it's near 0 / near 1000") can locate the
  // flag, so the round demands true magnitude interpolation. Tap difficulty
  // is unchanged in screen terms — the tolerance is a fixed percent of the
  // span and the span maps onto the same widget width as before.
  expert: { rounds: 14, budgetMs: 6_000, lineMin: 250, lineMax: 750, tolerancePct: 2.5 },
};

/**
 * Adaptive tuning: 10 rounds over [0, 50] with a 5%-of-span tolerance that
 * moves ±1 percentage point per round within [2, 8]. The neutral start maps
 * onto the 0.5 challenge baseline (see `sessionChallengeRating`).
 */
export const ADAPTIVE_PARAMS: Readonly<NumberLineDifficultyParams> = Object.freeze({
  rounds: 10,
  budgetMs: 10_000,
  lineMin: 0,
  lineMax: 50,
  tolerancePct: 5,
  minTolerancePct: 2,
  maxTolerancePct: 8,
  stepTolerancePct: 1,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function numberLineParamsForLevel(level: DifficultyLevel): NumberLineDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...NUMBER_LINE_DIFFICULTY_PARAMS[level] };
}

/** Encode the params into the SDK profile's number-only record. */
export function numberLineParamsToRecord(
  params: NumberLineDifficultyParams,
): Readonly<Record<string, number>> {
  return {
    rounds: params.rounds,
    budgetMs: params.budgetMs,
    lineMin: params.lineMin,
    lineMax: params.lineMax,
    tolerancePct: params.tolerancePct,
    ...(params.minTolerancePct !== undefined ? { minTolerancePct: params.minTolerancePct } : {}),
    ...(params.maxTolerancePct !== undefined ? { maxTolerancePct: params.maxTolerancePct } : {}),
    ...(params.stepTolerancePct !== undefined ? { stepTolerancePct: params.stepTolerancePct } : {}),
  };
}

/** Resolve a level into a full difficulty profile carrying the tuning. */
export function resolveNumberLineDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, numberLineParamsToRecord(numberLineParamsForLevel(level)));
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * or the range/tolerance are degenerate, instead of silently producing a
 * broken session.
 */
export function numberLineParamsFromProfile(
  profile: DifficultyProfile,
): NumberLineDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(
        `math-number-line-estimation: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const minTolerancePct = p.minTolerancePct === undefined ? undefined : requireNumber('minTolerancePct');
  const maxTolerancePct = p.maxTolerancePct === undefined ? undefined : requireNumber('maxTolerancePct');
  const stepTolerancePct =
    p.stepTolerancePct === undefined ? undefined : requireNumber('stepTolerancePct');
  const lineMin = requireNumber('lineMin');
  const lineMax = requireNumber('lineMax');
  if (!(lineMax > lineMin)) {
    throw new Error(
      `math-number-line-estimation: degenerate line range [${lineMin}, ${lineMax}]`,
    );
  }
  const tolerancePct = requireNumber('tolerancePct');
  if (tolerancePct <= 0 || tolerancePct > 100) {
    throw new Error(`math-number-line-estimation: tolerancePct must be in (0, 100], got ${tolerancePct}`);
  }
  return {
    rounds: requireNumber('rounds'),
    budgetMs: requireNumber('budgetMs'),
    lineMin,
    lineMax,
    tolerancePct,
    ...(minTolerancePct !== undefined ? { minTolerancePct } : {}),
    ...(maxTolerancePct !== undefined ? { maxTolerancePct } : {}),
    ...(stepTolerancePct !== undefined ? { stepTolerancePct } : {}),
  };
}

/** Adaptive-only: the current tolerance bounds (percent of span). */
function adaptiveBounds(params: NumberLineDifficultyParams): { minPct: number; maxPct: number } {
  return {
    minPct: params.minTolerancePct ?? params.tolerancePct,
    maxPct: params.maxTolerancePct ?? params.tolerancePct,
  };
}

/**
 * Hit tolerance of the next round (percent of span). Fixed levels keep the
 * constant tolerance; adaptive moves ±stepTolerancePct within bounds — a hit
 * tightens it (harder precision), a miss/timeout relaxes it.
 */
export function nextTolerancePct(
  prevTolerancePct: number,
  roundHit: boolean,
  level: DifficultyLevel,
  params: NumberLineDifficultyParams,
): number {
  if (level !== 'adaptive') {
    return prevTolerancePct;
  }
  const { minPct, maxPct } = adaptiveBounds(params);
  const step = params.stepTolerancePct ?? 0;
  const delta = roundHit ? -step : step;
  return Math.min(maxPct, Math.max(minPct, prevTolerancePct + delta));
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports how far the player tightened the tolerance, mapped
 * linearly into [0, 1] over [minPct, maxPct] with the direction inverted
 * (smaller tolerance = higher challenge). The neutral initial tolerance
 * (5% over [2, 8]) lands exactly on the 0.5 baseline.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalTolerancePct: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = numberLineParamsFromProfile(profile);
  const { minPct, maxPct } = adaptiveBounds(params);
  const span = maxPct - minPct;
  if (span <= 0) {
    return profile.challengeRating;
  }
  const clamped = Math.min(maxPct, Math.max(minPct, finalTolerancePct));
  return Math.min(1, Math.max(0, 1 - (clamped - minPct) / span));
}
