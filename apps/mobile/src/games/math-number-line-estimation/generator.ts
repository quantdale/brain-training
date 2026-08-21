/**
 * Deterministic round generation for the Number Line Estimation game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round comes from a
 * per-round RNG fork (`round:<index>:attempt:<n>`), so the same seed always
 * yields the same session.
 *
 * Invariants (enforced by construction, checked by `validateRound`):
 * - The target is an integer strictly inside `[lineMin, lineMax]` with a
 *   margin of at least 5% of the span on each side, so the flag never sits on
 *   an endpoint label and the round is always well-posed (no ambiguity: the
 *   flag marks exactly one position).
 * - Consecutive targets differ by more than 15% of the span when possible
 *   (variety); a candidate that violates this is re-drawn with an incremented
 *   attempt salt until it passes or `MAX_TARGET_ATTEMPTS` is exhausted — the
 *   deterministic fallback then accepts the last candidate (still fully
 *   valid; only variety is affected).
 */
import type { Rng } from '@/sdk';

import type { NumberLineDifficultyParams, NumberLineRound } from './types';

/** Upper bound on target re-draws before the last candidate is accepted. */
export const MAX_TARGET_ATTEMPTS = 20;

/** Target margin from each endpoint, as a fraction of the span. */
export const TARGET_MARGIN_FRACTION = 0.05;

/** Minimum relative distance between consecutive targets (variety). */
export const MIN_TARGET_DISTANCE_FRACTION = 0.15;

/** Margin (in value units) kept clear at each end of the line. */
export function targetMargin(lineMin: number, lineMax: number): number {
  return Math.max(1, Math.round((lineMax - lineMin) * TARGET_MARGIN_FRACTION));
}

/** Inclusive target range that keeps the flag strictly interior. */
export function targetRange(lineMin: number, lineMax: number): {
  lo: number;
  hi: number;
} {
  const margin = targetMargin(lineMin, lineMax);
  return { lo: lineMin + margin, hi: lineMax - margin };
}

/**
 * Generate one round's `(lineMin, lineMax, target)` triple. Deterministic:
 * the same seed/round/params always yield the same round.
 */
export function generateRound(
  rng: Rng,
  roundIndex: number,
  params: NumberLineDifficultyParams,
  prevTarget: number | null,
): NumberLineRound {
  const { lineMin, lineMax } = params;
  const { lo, hi } = targetRange(lineMin, lineMax);
  const minDistance = (lineMax - lineMin) * MIN_TARGET_DISTANCE_FRACTION;

  let last: number | null = null;
  for (let attempt = 0; attempt < MAX_TARGET_ATTEMPTS; attempt += 1) {
    const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
    const candidate = fork.nextIntRange(lo, hi + 1);
    last = candidate;
    if (prevTarget === null || Math.abs(candidate - prevTarget) > minDistance) {
      return { lineMin, lineMax, target: candidate };
    }
  }

  // Deterministic fallback: accept the last candidate (always valid; only
  // variety is affected). Unreachable in practice for the shipped params.
  return { lineMin, lineMax, target: last as number };
}

/** Convenience: a full deterministic round list for one session. */
export function generateSessionRounds(
  rng: Rng,
  params: NumberLineDifficultyParams,
  rounds: number = params.rounds,
): NumberLineRound[] {
  const list: NumberLineRound[] = [];
  let prevTarget: number | null = null;
  for (let i = 0; i < rounds; i += 1) {
    const round = generateRound(rng, i, params, prevTarget);
    list.push(round);
    prevTarget = round.target;
  }
  return list;
}

export interface RoundValidation {
  readonly ok: boolean;
  readonly reason: string | null;
}

/**
 * Verify a round's invariants: integer endpoints/target, `lineMin < lineMax`,
 * and a strictly interior target (endpoint margin respected). Used by tests
 * and diagnostics; generation satisfies these, so a non-ok result means a
 * real regression.
 */
export function validateRound(round: NumberLineRound): RoundValidation {
  const { lineMin, lineMax, target } = round;
  if (!Number.isInteger(lineMin) || !Number.isInteger(lineMax) || !Number.isInteger(target)) {
    return { ok: false, reason: 'line endpoints and target must be integers' };
  }
  if (!(lineMax > lineMin)) {
    return { ok: false, reason: `degenerate range [${lineMin}, ${lineMax}]` };
  }
  const { lo, hi } = targetRange(lineMin, lineMax);
  if (target < lo || target > hi) {
    return {
      ok: false,
      reason: `target ${target} outside the interior range [${lo}, ${hi}]`,
    };
  }
  return { ok: true, reason: null };
}
