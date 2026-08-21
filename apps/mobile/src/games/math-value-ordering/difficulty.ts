/**
 * Named difficulty → concrete Value Order parameters.
 *
 * `resolveValueOrderingDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the tile count
 * grew during play (see `sessionChallengeRating`).
 *
 * Parameter encoding: the SDK difficulty profile only carries numbers, so all
 * tuning fields are numbers already (`expressionTiles` is a count, ranges are
 * inclusive integer bounds). `valueOrderingParamsFromProfile` decodes and
 * validates strictly.
 *
 * Difficulty direction: MORE tiles, a WIDER value range, more expression
 * tiles and a TIGHTER budget are harder. Adaptive grows the tile count after
 * a perfect round and shrinks it after a mistake/timeout, within
 * [minTiles, maxTiles].
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import type { ValueOrderingDifficultyParams } from './types';

/** Fixed-level tuning: rounds, budget, tile count/value range/expression mix. */
export const VALUE_ORDERING_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, ValueOrderingDifficultyParams>
> = {
  easy: {
    rounds: 8,
    budgetMs: 12_000,
    tiles: 3,
    minValue: 0,
    maxValue: 20,
    expressionTiles: 0,
    exprOperandMin: 2,
    exprOperandMax: 9,
  },
  normal: {
    rounds: 10,
    budgetMs: 10_000,
    tiles: 4,
    minValue: 0,
    maxValue: 100,
    expressionTiles: 1,
    exprOperandMin: 2,
    exprOperandMax: 9,
  },
  hard: {
    rounds: 12,
    budgetMs: 9_000,
    tiles: 5,
    minValue: 0,
    maxValue: 500,
    expressionTiles: 2,
    exprOperandMin: 2,
    exprOperandMax: 12,
  },
  expert: {
    rounds: 14,
    budgetMs: 8_000,
    tiles: 6,
    minValue: 0,
    maxValue: 1000,
    expressionTiles: 4,
    exprOperandMin: 3,
    exprOperandMax: 15,
  },
};

/**
 * Adaptive tuning: 10 rounds of 4 tiles over [0, 200] with one disguised
 * expression, moving ±1 tile per round within [3, 6]. The neutral start (4
 * tiles) maps onto the 0.5 challenge baseline (see `sessionChallengeRating`).
 */
export const ADAPTIVE_PARAMS: Readonly<ValueOrderingDifficultyParams> = Object.freeze({
  rounds: 10,
  budgetMs: 10_000,
  tiles: 4,
  minValue: 0,
  maxValue: 200,
  expressionTiles: 1,
  exprOperandMin: 2,
  exprOperandMax: 10,
  minTiles: 3,
  maxTiles: 6,
  stepTiles: 1,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function valueOrderingParamsForLevel(
  level: DifficultyLevel,
): ValueOrderingDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...VALUE_ORDERING_DIFFICULTY_PARAMS[level] };
}

/** Encode the params into the SDK profile's number-only record. */
export function valueOrderingParamsToRecord(
  params: ValueOrderingDifficultyParams,
): Readonly<Record<string, number>> {
  return {
    rounds: params.rounds,
    budgetMs: params.budgetMs,
    tiles: params.tiles,
    minValue: params.minValue,
    maxValue: params.maxValue,
    expressionTiles: params.expressionTiles,
    exprOperandMin: params.exprOperandMin,
    exprOperandMax: params.exprOperandMax,
    ...(params.minTiles !== undefined ? { minTiles: params.minTiles } : {}),
    ...(params.maxTiles !== undefined ? { maxTiles: params.maxTiles } : {}),
    ...(params.stepTiles !== undefined ? { stepTiles: params.stepTiles } : {}),
  };
}

/** Resolve a level into a full difficulty profile carrying the tuning. */
export function resolveValueOrderingDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(
    level,
    valueOrderingParamsToRecord(valueOrderingParamsForLevel(level)),
  );
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * or the configuration is degenerate (empty range, fewer distinct values than
 * tiles), instead of silently producing an ambiguous session.
 */
export function valueOrderingParamsFromProfile(
  profile: DifficultyProfile,
): ValueOrderingDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(
        `math-value-ordering: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const minTiles = p.minTiles === undefined ? undefined : requireNumber('minTiles');
  const maxTiles = p.maxTiles === undefined ? undefined : requireNumber('maxTiles');
  const stepTiles = p.stepTiles === undefined ? undefined : requireNumber('stepTiles');
  const tiles = requireNumber('tiles');
  const minValue = requireNumber('minValue');
  const maxValue = requireNumber('maxValue');
  if (!Number.isInteger(tiles) || tiles < 2) {
    throw new Error(`math-value-ordering: tiles must be an integer ≥ 2, got ${tiles}`);
  }
  if (!(maxValue > minValue)) {
    throw new Error(`math-value-ordering: degenerate value range [${minValue}, ${maxValue}]`);
  }
  // Distinctness needs at least one integer per tile.
  if (maxValue - minValue + 1 < tiles) {
    throw new Error(
      `math-value-ordering: range [${minValue}, ${maxValue}] cannot host ${tiles} distinct values`,
    );
  }
  const expressionTiles = requireNumber('expressionTiles');
  if (!Number.isInteger(expressionTiles) || expressionTiles < 0 || expressionTiles > tiles) {
    throw new Error(
      `math-value-ordering: expressionTiles must be an integer in [0, tiles], got ${expressionTiles}`,
    );
  }
  return {
    rounds: requireNumber('rounds'),
    budgetMs: requireNumber('budgetMs'),
    tiles,
    minValue,
    maxValue,
    expressionTiles,
    exprOperandMin: requireNumber('exprOperandMin'),
    exprOperandMax: requireNumber('exprOperandMax'),
    ...(minTiles !== undefined ? { minTiles } : {}),
    ...(maxTiles !== undefined ? { maxTiles } : {}),
    ...(stepTiles !== undefined ? { stepTiles } : {}),
  };
}

/** Adaptive-only: the current tile-count bounds. */
function adaptiveTileBounds(params: ValueOrderingDifficultyParams): {
  minCount: number;
  maxCount: number;
} {
  return {
    minCount: params.minTiles ?? params.tiles,
    maxCount: params.maxTiles ?? params.tiles,
  };
}

/**
 * Tile count of the next round. Fixed levels keep the constant count;
 * adaptive moves ±stepTiles within bounds — a perfect round grows it (more to
 * rank under the same clock), a mistake/timeout shrinks it.
 */
export function nextTileCount(
  prevTiles: number,
  roundPerfect: boolean,
  level: DifficultyLevel,
  params: ValueOrderingDifficultyParams,
): number {
  if (level !== 'adaptive') {
    return prevTiles;
  }
  const { minCount, maxCount } = adaptiveTileBounds(params);
  const step = params.stepTiles ?? 0;
  const delta = roundPerfect ? step : -step;
  return Math.min(maxCount, Math.max(minCount, prevTiles + delta));
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports how far the player grew the tile count, mapped
 * linearly into [0, 1] over [minTiles, maxTiles]. The neutral initial count
 * (4 over [3, 6]) lands exactly on the 0.5 baseline.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalTiles: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = valueOrderingParamsFromProfile(profile);
  const { minCount, maxCount } = adaptiveTileBounds(params);
  const span = maxCount - minCount;
  if (span <= 0) {
    return profile.challengeRating;
  }
  const clamped = Math.min(maxCount, Math.max(minCount, finalTiles));
  return Math.min(1, Math.max(0, (clamped - minCount) / span));
}
