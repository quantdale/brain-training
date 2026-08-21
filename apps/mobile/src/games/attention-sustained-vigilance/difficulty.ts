/**
 * Named difficulty → concrete Sustained Vigilance parameters.
 *
 * `resolveVigilanceDifficulty` plugs the game's tuning into the SDK's
 * `resolveDifficulty`, so the resolved profile (level, challengeRating,
 * parameters) is exactly what gets persisted with each session. Fixed levels
 * carry the SDK default challenge ratings; `adaptive` starts at the neutral
 * 0.5 baseline and the final rating is derived from how far the response
 * window tightened during play (see `sessionChallengeRating`).
 *
 * Parameter encoding: the SDK difficulty profile only carries numbers, so all
 * tuning fields are numbers already (`targetRarityPct` is a percent).
 * `vigilanceParamsFromProfile` decodes and validates strictly.
 *
 * Difficulty direction: a SHORTER response window / stimulus duration, a
 * FASTER stream (shorter ISI), a RARER stop digit, and tighter RT anchors are
 * harder. Adaptive tightens the response window after every clean trial and
 * relaxes it after an error, within [minResponseWindowMs, maxResponseWindowMs].
 */
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel, DifficultyProfile } from '@/sdk';

import { DIGIT_MAX, DIGIT_MIN } from './types';
import type { VigilanceDifficultyParams } from './types';

/** Fixed-level tuning: stream shape, rarity, and RT anchors. */
export const VIGILANCE_DIFFICULTY_PARAMS: Readonly<
  Record<Exclude<DifficultyLevel, 'adaptive'>, VigilanceDifficultyParams>
> = {
  easy: {
    trials: 24,
    stimulusOnMs: 900,
    isiMs: 600,
    responseWindowMs: 1400,
    targetRarityPct: 17,
    minTargetGap: 4,
    rtTargetMs: 450,
    rtFailMs: 1100,
  },
  normal: {
    trials: 30,
    stimulusOnMs: 750,
    isiMs: 500,
    responseWindowMs: 1200,
    targetRarityPct: 12,
    minTargetGap: 5,
    rtTargetMs: 400,
    rtFailMs: 1000,
  },
  hard: {
    trials: 36,
    stimulusOnMs: 600,
    isiMs: 420,
    responseWindowMs: 1000,
    targetRarityPct: 10,
    minTargetGap: 6,
    rtTargetMs: 350,
    rtFailMs: 900,
  },
  expert: {
    trials: 42,
    stimulusOnMs: 500,
    isiMs: 350,
    responseWindowMs: 850,
    targetRarityPct: 8,
    minTargetGap: 7,
    rtTargetMs: 300,
    rtFailMs: 800,
  },
};

/**
 * Adaptive tuning: 32 trials over a normal-speed stream with a 1000 ms
 * response window that moves ±100 ms per trial within [600, 1400]. The neutral
 * start maps onto the 0.5 challenge baseline exactly:
 * (1400 − 1000) / (1400 − 600) = 0.5 (see `sessionChallengeRating`).
 */
export const ADAPTIVE_PARAMS: Readonly<VigilanceDifficultyParams> = Object.freeze({
  trials: 32,
  stimulusOnMs: 700,
  isiMs: 450,
  responseWindowMs: 1000,
  targetRarityPct: 12,
  minTargetGap: 5,
  rtTargetMs: 400,
  rtFailMs: 1000,
  minResponseWindowMs: 600,
  maxResponseWindowMs: 1400,
  stepResponseWindowMs: 100,
});

/** Canonical parameters for a level (fresh object; never the frozen defaults). */
export function vigilanceParamsForLevel(level: DifficultyLevel): VigilanceDifficultyParams {
  if (level === 'adaptive') {
    return { ...ADAPTIVE_PARAMS };
  }
  return { ...VIGILANCE_DIFFICULTY_PARAMS[level] };
}

/** Encode the params into the SDK profile's number-only record. */
export function vigilanceParamsToRecord(
  params: VigilanceDifficultyParams,
): Readonly<Record<string, number>> {
  return {
    trials: params.trials,
    stimulusOnMs: params.stimulusOnMs,
    isiMs: params.isiMs,
    responseWindowMs: params.responseWindowMs,
    targetRarityPct: params.targetRarityPct,
    minTargetGap: params.minTargetGap,
    rtTargetMs: params.rtTargetMs,
    rtFailMs: params.rtFailMs,
    ...(params.minResponseWindowMs !== undefined
      ? { minResponseWindowMs: params.minResponseWindowMs }
      : {}),
    ...(params.maxResponseWindowMs !== undefined
      ? { maxResponseWindowMs: params.maxResponseWindowMs }
      : {}),
    ...(params.stepResponseWindowMs !== undefined
      ? { stepResponseWindowMs: params.stepResponseWindowMs }
      : {}),
  };
}

/** Resolve a level into a full difficulty profile carrying the tuning. */
export function resolveVigilanceDifficulty(level: DifficultyLevel): DifficultyProfile {
  return resolveDifficulty(level, vigilanceParamsToRecord(vigilanceParamsForLevel(level)));
}

/**
 * Recover validated parameters from a resolved profile (e.g. a persisted
 * `difficulty` record). Throws when a required parameter is missing/non-finite
 * or the values are degenerate, instead of silently producing a broken session.
 */
export function vigilanceParamsFromProfile(
  profile: DifficultyProfile,
): VigilanceDifficultyParams {
  const p = profile.parameters;
  const requireNumber = (key: string): number => {
    const value = p[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(
        `attention-sustained-vigilance: difficulty profile is missing numeric parameter "${key}"`,
      );
    }
    return value;
  };
  const trials = requireNumber('trials');
  if (!Number.isInteger(trials) || trials <= 0) {
    throw new Error(`attention-sustained-vigilance: trials must be a positive integer, got ${trials}`);
  }
  const stimulusOnMs = requireNumber('stimulusOnMs');
  const isiMs = requireNumber('isiMs');
  if (stimulusOnMs <= 0 || isiMs < 0) {
    throw new Error(
      `attention-sustained-vigilance: degenerate timing (stimulusOnMs=${stimulusOnMs}, isiMs=${isiMs})`,
    );
  }
  const responseWindowMs = requireNumber('responseWindowMs');
  if (responseWindowMs <= 0) {
    throw new Error(
      `attention-sustained-vigilance: responseWindowMs must be positive, got ${responseWindowMs}`,
    );
  }
  const targetRarityPct = requireNumber('targetRarityPct');
  if (targetRarityPct <= 0 || targetRarityPct > 100) {
    throw new Error(
      `attention-sustained-vigilance: targetRarityPct must be in (0, 100], got ${targetRarityPct}`,
    );
  }
  const minTargetGap = requireNumber('minTargetGap');
  const rtTargetMs = requireNumber('rtTargetMs');
  const rtFailMs = requireNumber('rtFailMs');
  if (!(rtFailMs > rtTargetMs)) {
    throw new Error(
      `attention-sustained-vigilance: rtFailMs (${rtFailMs}) must exceed rtTargetMs (${rtTargetMs})`,
    );
  }
  const minResponseWindowMs =
    p.minResponseWindowMs === undefined ? undefined : requireNumber('minResponseWindowMs');
  const maxResponseWindowMs =
    p.maxResponseWindowMs === undefined ? undefined : requireNumber('maxResponseWindowMs');
  const stepResponseWindowMs =
    p.stepResponseWindowMs === undefined ? undefined : requireNumber('stepResponseWindowMs');
  return {
    trials,
    stimulusOnMs,
    isiMs,
    responseWindowMs,
    targetRarityPct,
    minTargetGap,
    rtTargetMs,
    rtFailMs,
    ...(minResponseWindowMs !== undefined ? { minResponseWindowMs } : {}),
    ...(maxResponseWindowMs !== undefined ? { maxResponseWindowMs } : {}),
    ...(stepResponseWindowMs !== undefined ? { stepResponseWindowMs } : {}),
  };
}

/** Adaptive-only: the current response-window bounds (ms). */
function adaptiveBounds(params: VigilanceDifficultyParams): { minMs: number; maxMs: number } {
  return {
    minMs: params.minResponseWindowMs ?? params.responseWindowMs,
    maxMs: params.maxResponseWindowMs ?? params.responseWindowMs,
  };
}

/**
 * Response window for the next trial (ms). Fixed levels keep the constant
 * window; adaptive moves ±stepResponseWindowMs within bounds — a clean trial
 * (hit or correct hold) tightens it (harder), an error relaxes it.
 */
export function nextResponseWindowMs(
  prevWindowMs: number,
  trialClean: boolean,
  level: DifficultyLevel,
  params: VigilanceDifficultyParams,
): number {
  if (level !== 'adaptive') {
    return prevWindowMs;
  }
  const { minMs, maxMs } = adaptiveBounds(params);
  const step = params.stepResponseWindowMs ?? 0;
  const delta = trialClean ? -step : step;
  return Math.min(maxMs, Math.max(minMs, prevWindowMs + delta));
}

/**
 * Final challenge rating of a session. Fixed levels report the SDK default
 * rating; adaptive reports how far the player tightened the response window,
 * mapped linearly into [0, 1] over [minMs, maxMs] with the direction inverted
 * (smaller window = higher challenge). The neutral initial window (1000 ms
 * over [600, 1400]) lands exactly on the 0.5 baseline.
 */
export function sessionChallengeRating(
  level: DifficultyLevel,
  profile: DifficultyProfile,
  finalWindowMs: number,
): number {
  if (level !== 'adaptive') {
    return profile.challengeRating;
  }
  const params = vigilanceParamsFromProfile(profile);
  const { minMs, maxMs } = adaptiveBounds(params);
  const span = maxMs - minMs;
  if (span <= 0) {
    return profile.challengeRating;
  }
  const clamped = Math.min(maxMs, Math.max(minMs, finalWindowMs));
  return Math.min(1, Math.max(0, 1 - (clamped - minMs) / span));
}

/**
 * Expected number of stop-digit targets for a session (deterministic rounding
 * of `trials × targetRarityPct / 100`, always ≥ 1 so every session exercises
 * the withhold demand).
 */
export function expectedTargetCount(params: VigilanceDifficultyParams): number {
  return Math.max(1, Math.round((params.trials * params.targetRarityPct) / 100));
}

/**
 * Feasibility guard shared with the generator: `targetCount` targets spaced by
 * at least `minTargetGap` non-target trials need a stream of at least
 * `targetCount + (targetCount − 1) × minTargetGap` trials.
 */
export function targetLayoutFeasible(params: VigilanceDifficultyParams): boolean {
  const targetCount = expectedTargetCount(params);
  return params.trials >= targetCount + (targetCount - 1) * params.minTargetGap;
}

/** Guard that a drawn digit lies in the displayed pool. */
export function isValidDigit(digit: number): boolean {
  return Number.isInteger(digit) && digit >= DIGIT_MIN && digit <= DIGIT_MAX;
}
