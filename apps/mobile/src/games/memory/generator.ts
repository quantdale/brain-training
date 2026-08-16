/**
 * Deterministic sequence generation for the Memory game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Round sequences come from a
 * per-round RNG fork and are permutation slices (a tile never repeats within
 * a sequence, which keeps sequences unambiguous to tap).
 *
 * Near-duplicate avoidance: consecutive rounds that differ by only one tile
 * are confusable, so a candidate is re-drawn with an incremented attempt salt
 * until its distance from the previous round's sequence is at least
 * `MIN_SEQUENCE_HAMMING_DISTANCE` (or the budget is exhausted). Every step is
 * deterministic — the same seed always yields the same session.
 */
import type { Rng } from '@/sdk';

/** Minimum distance between a round's sequence and the previous round's. */
export const MIN_SEQUENCE_HAMMING_DISTANCE = 2;

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_SEQUENCE_ATTEMPTS = 12;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly length: number;
  readonly gridSize: number;
  /** Previous round's sequence, or null for round 0. */
  readonly prevSequence: readonly number[] | null;
}

export function generateRoundSequence(input: GenerateRoundInput): number[] {
  const { rng, roundIndex, length, gridSize, prevSequence } = input;
  const indices: number[] = Array.from({ length: gridSize }, (_, i) => i);

  for (let attempt = 0; attempt < MAX_SEQUENCE_ATTEMPTS; attempt += 1) {
    const candidate = rng
      .fork(`round:${roundIndex}:attempt:${attempt}`)
      .shuffle(indices)
      .slice(0, length);
    if (!isNearDuplicate(candidate, prevSequence)) {
      return candidate;
    }
  }

  // Extremely unlikely fallback: deterministically accept the last candidate.
  return rng
    .fork(`round:${roundIndex}:attempt:${MAX_SEQUENCE_ATTEMPTS - 1}`)
    .shuffle(indices)
    .slice(0, length);
}

/**
 * Hamming-style distance between two sequences: absolute length difference
 * plus the number of positions where the tiles differ. `null` previous
 * sequence (round 0) counts as infinitely far.
 */
export function sequenceDistance(
  a: readonly number[],
  b: readonly number[] | null,
): number {
  if (b === null) {
    return Number.POSITIVE_INFINITY;
  }
  let distance = Math.abs(a.length - b.length);
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    if (a[i] !== b[i]) {
      distance += 1;
    }
  }
  return distance;
}

/** True when `a` is confusable with `b` (too similar to the previous round). */
export function isNearDuplicate(
  a: readonly number[],
  b: readonly number[] | null,
): boolean {
  if (b === null || b.length < 2) {
    return false;
  }
  return sequenceDistance(a, b) < MIN_SEQUENCE_HAMMING_DISTANCE;
}
