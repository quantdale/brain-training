/**
 * Deterministic stimulus-stream generation for the Sustained Vigilance game.
 *
 * A session's seed is recorded with its result, so the full stream is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule.
 *
 * Generation is a two-phase layout over per-concern RNG forks so changing one
 * phase never reshuffles the other:
 *
 * 1. Target placement — exactly `expectedTargetCount(params)` trials become
 *    stop-digit targets. Candidate layouts come from seeded shuffles of all
 *    trial indices (`targets:attempt:<n>` forks); the first layout whose
 *    consecutive targets are ≥ `minTargetGap` apart wins. If the attempt
 *    budget is exhausted, a deterministic even-spread fallback
 *    (`fallbackTargetIndices`) is used — always gap-valid for feasible params,
 *    so generation never fails.
 * 2. Digits — the session's stop digit is drawn once (`stop-digit` fork);
 *    every non-target trial then draws a digit from the remaining pool
 *    (`digit:<index>:attempt:<n>` forks), re-drawing on collision with the
 *    stop digit so `isTarget ⇔ digit === stopDigit` holds by construction and
 *    no go trial can ever be ambiguous.
 *
 * Invariants (enforced by construction, checked by `validateStream`):
 * - Every digit lies in `[DIGIT_MIN, DIGIT_MAX]`.
 * - Target trials show exactly the stop digit; go trials never do.
 * - Exactly `expectedTargetCount` targets, spaced ≥ `minTargetGap` apart.
 */
import type { Rng } from '@/sdk';

import { expectedTargetCount } from './difficulty';
import { DIGIT_MAX, DIGIT_MIN } from './types';
import type { VigilanceDifficultyParams, VigilanceTrial } from './types';

/** Upper bound on layout re-draws before the even-spread fallback is used. */
export const MAX_LAYOUT_ATTEMPTS = 24;

/** Upper bound on digit re-draws per trial before the last candidate sticks. */
export const MAX_DIGIT_ATTEMPTS = 20;

/**
 * Deterministic even-spread fallback: `targetCount` indices as evenly spaced
 * across `trials` as integer math allows (largest-remainder style). Always
 * satisfies the gap constraint whenever the layout is feasible at all.
 */
export function fallbackTargetIndices(trials: number, targetCount: number): number[] {
  const indices: number[] = [];
  for (let k = 0; k < targetCount; k += 1) {
    indices.push(Math.floor((k * trials) / targetCount));
  }
  return indices;
}

/** True when consecutive sorted positions are ≥ `minGap` apart. */
export function gapsRespected(sortedPositions: readonly number[], minGap: number): boolean {
  for (let i = 1; i < sortedPositions.length; i += 1) {
    if (sortedPositions[i] - sortedPositions[i - 1] <= minGap) {
      return false;
    }
  }
  return true;
}

/** One generated session: the full trial list plus its stop digit. */
export interface VigilanceStream {
  readonly trials: readonly VigilanceTrial[];
  /** The withheld digit (1–9); exactly the digit shown on target trials. */
  readonly stopDigit: number;
}

/**
 * Generate the full trial list for one session. Deterministic: the same seed
 * and params always yield the same stream.
 */
export function generateStream(rng: Rng, params: VigilanceDifficultyParams): VigilanceStream {
  const targetCount = Math.min(expectedTargetCount(params), params.trials);
  const minGap = Math.max(0, params.minTargetGap);

  // Phase 1: pick target positions (seeded shuffles, gap-checked).
  let targetSet: Set<number> | null = null;
  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt += 1) {
    const fork = rng.fork(`targets:attempt:${attempt}`);
    const shuffled = fork.shuffle(Array.from({ length: params.trials }, (_, i) => i));
    const chosen = shuffled.slice(0, targetCount).sort((a, b) => a - b);
    if (gapsRespected(chosen, minGap)) {
      targetSet = new Set(chosen);
      break;
    }
  }
  if (targetSet === null) {
    // Deterministic fallback: even spread (gap-valid for feasible params).
    targetSet = new Set(fallbackTargetIndices(params.trials, targetCount));
  }

  // Phase 2: draw the session's stop digit, then per-trial digits that avoid
  // it on go trials (so only true targets show the stop digit).
  const stopDigit = rng.fork('stop-digit').nextIntRange(DIGIT_MIN, DIGIT_MAX + 1);

  const trials: VigilanceTrial[] = [];
  for (let i = 0; i < params.trials; i += 1) {
    const isTarget = targetSet.has(i);
    let digit = stopDigit;
    if (!isTarget) {
      for (let attempt = 0; attempt < MAX_DIGIT_ATTEMPTS; attempt += 1) {
        const fork = rng.fork(`digit:${i}:attempt:${attempt}`);
        const candidate = fork.nextIntRange(DIGIT_MIN, DIGIT_MAX + 1);
        digit = candidate;
        if (candidate !== stopDigit) {
          break;
        }
      }
      // After MAX_DIGIT_ATTEMPTS collisions the last candidate would still be
      // the stop digit; force the lowest legal alternative instead of letting
      // an ambiguous go trial through. Unreachable in practice (8/9 escape
      // chance per draw).
      if (digit === stopDigit) {
        digit = stopDigit === DIGIT_MAX ? DIGIT_MIN : stopDigit + 1;
      }
    }
    trials.push({ index: i, digit, isTarget });
  }
  return { trials, stopDigit };
}

export interface StreamValidation {
  readonly ok: boolean;
  readonly reason: string | null;
}

/**
 * Verify a generated stream's invariants (see module docs). Used by tests and
 * diagnostics; generation satisfies these, so a non-ok result means a real
 * regression.
 */
export function validateStream(
  stream: readonly VigilanceTrial[],
  params: VigilanceDifficultyParams,
  stopDigit: number,
): StreamValidation {
  const targets: number[] = [];
  for (const trial of stream) {
    if (
      !Number.isInteger(trial.digit) ||
      trial.digit < DIGIT_MIN ||
      trial.digit > DIGIT_MAX
    ) {
      return { ok: false, reason: `trial ${trial.index}: digit ${trial.digit} outside [${DIGIT_MIN}, ${DIGIT_MAX}]` };
    }
    if (trial.isTarget !== (trial.digit === stopDigit)) {
      return {
        ok: false,
        reason: `trial ${trial.index}: isTarget=${String(trial.isTarget)} but digit ${trial.digit} vs stop ${stopDigit}`,
      };
    }
    if (trial.isTarget) {
      targets.push(trial.index);
    }
  }
  const expected = Math.min(expectedTargetCount(params), params.trials);
  if (targets.length !== expected) {
    return { ok: false, reason: `expected ${expected} targets, found ${targets.length}` };
  }
  if (!gapsRespected(targets, Math.max(0, params.minTargetGap))) {
    return { ok: false, reason: `targets closer than minTargetGap=${params.minTargetGap}` };
  }
  return { ok: true, reason: null };
}
