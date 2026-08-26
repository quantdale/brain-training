/**
 * Deterministic round generation for the Reaction Time game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round's content comes
 * from per-round RNG forks, so changing one round's salt never reshuffles the
 * others:
 *
 * - `round:${i}:delay` → wait before the GO signal, integer ms in
 *   [minDelayMs, maxDelayMs].
 * - `round:${i}:nogo` → whether the round carries a NO-GO stimulus (drawn
 *   against `noGoProbability`; a separate fork keeps delays stable across
 *   generator versions).
 *
 * Everything else (round count, thresholds, withhold window) is fixed
 * difficulty tuning. Bounds are validated up front so a corrupt difficulty
 * profile fails loudly instead of producing broken waits.
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

export interface IsNoGoRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  /** Probability [0..1] that the round is a NO-GO trial (0 = never). */
  readonly noGoProbability: number;
}

/**
 * Decide whether the round carries a NO-GO stimulus (distinct visual cue; the
 * player must withhold). Deterministic per `(seed, roundIndex, probability)`;
 * probability 0 short-circuits to false without consuming RNG output, so
 * easy-mode sessions are byte-for-byte the pure simple-RT sessions they were
 * before Go/No-Go existed.
 */
export function isNoGoRound(input: IsNoGoRoundInput): boolean {
  const { rng, roundIndex, noGoProbability } = input;
  if (!Number.isFinite(noGoProbability) || noGoProbability < 0 || noGoProbability > 1) {
    throw new RangeError(
      `isNoGoRound: noGoProbability must be within [0, 1], got ${noGoProbability}`,
    );
  }
  if (noGoProbability === 0) {
    return false;
  }
  return rng.fork(`round:${roundIndex}:nogo`).next() < noGoProbability;
}
