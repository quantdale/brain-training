/**
 * Deterministic wait-delay generation for the Reaction Time game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round's wait delay comes
 * from a per-round RNG fork, so changing one round's salt never reshuffles the
 * others. Delays are integer milliseconds in [minDelayMs, maxDelayMs].
 *
 * The delay is the ONLY generated content in this game — everything else
 * (round count, thresholds, timeout) is fixed difficulty tuning. There are no
 * layout constraints to validate beyond the range, which the RNG contract
 * guarantees; `generateRoundDelay` still validates its bounds up front so a
 * corrupt difficulty profile fails loudly instead of producing broken waits.
 */
import type { Rng } from '@/sdk';

export interface GenerateRoundDelayInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  /** Inclusive lower bound of the wait, in ms. */
  readonly minDelayMs: number;
  /** Inclusive upper bound of the wait, in ms. */
  readonly maxDelayMs: number;
}

/**
 * Draw the current round's wait delay (integer ms, inclusive range). The same
 * (seed, roundIndex, min, max) always yields the same delay.
 */
export function generateRoundDelay(input: GenerateRoundDelayInput): number {
  const { rng, roundIndex, minDelayMs, maxDelayMs } = input;
  if (!Number.isFinite(minDelayMs) || !Number.isFinite(maxDelayMs)) {
    throw new RangeError(
      `generateRoundDelay: delay bounds must be finite, got [${minDelayMs}, ${maxDelayMs}]`,
    );
  }
  if (minDelayMs < 0 || maxDelayMs < minDelayMs) {
    throw new RangeError(
      `generateRoundDelay: expected 0 <= minDelayMs <= maxDelayMs, got [${minDelayMs}, ${maxDelayMs}]`,
    );
  }
  // Inclusive upper bound: nextIntRange(min, max + 1) draws [min, max].
  return rng.fork(`round:${roundIndex}:delay`).nextIntRange(minDelayMs, maxDelayMs + 1);
}
