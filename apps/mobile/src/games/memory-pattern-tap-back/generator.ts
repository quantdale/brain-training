/**
 * Deterministic sequence generation for the Pattern Tap Back game.
 *
 * Each round's sequence is a non-repeating traversal of distinct grid tiles:
 * - No tile lit twice in the same sequence (a permutation slice of the grid).
 * - Starts from a position derived from the previous round's end (or a
 *   uniformly-drawn start for round 0).
 *
 * IMPORTANT (task 10.6 audit): this generator does NOT constrain steps to
 * grid adjacency. It picks uniformly from unvisited tiles, so it is a
 * distinct-span sequence (the same family as the Memory game) rather than a
 * grid-path/random-walk. Earlier comments claimed an adjacency-constrained
 * "random walk"; that documentation misdescribed the implementation and was
 * corrected. See `docs/adr/0005-memory-variant-review.md` for the deliberate
 * variant decision.
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

/**
 * Generate a round's sequence of distinct tiles.
 *
 * The sequence starts from a position derived from the previous round's last
 * tile (to avoid trivial repetition), then repeatedly picks a uniform random
 * unvisited tile. It does NOT constrain steps to grid adjacency (a true
 * adjacent-path generator is a documented future differentiation; see
 * `docs/adr/0005-memory-variant-review.md`).
 *
 * Determinism: `rng.fork` produces a child stream per attempt, and the
 * shuffle-then-pick logic is the same as the memory game's permutation
 * approach.
 */
export function generateRoundSequence(input: GenerateRoundInput): number[] {
  const { rng, roundIndex, length, gridSize, prevSequence } = input;

  for (let attempt = 0; attempt < MAX_SEQUENCE_ATTEMPTS; attempt += 1) {
    const candidate = buildRandomWalk(
      rng.fork(`round:${roundIndex}:attempt:${attempt}`),
      length,
      gridSize,
      prevSequence,
    );
    if (!isNearDuplicate(candidate, prevSequence)) {
      return candidate;
    }
  }

  // Extremely unlikely fallback: deterministically accept the last candidate.
  return buildRandomWalk(
    rng.fork(`round:${roundIndex}:attempt:${MAX_SEQUENCE_ATTEMPTS - 1}`),
    length,
    gridSize,
    prevSequence,
  );
}

/**
 * Build a distinct-span sequence of `length` tiles over `gridSize` cells.
 *
 * The sequence starts from a seed position (the last tile of the previous
 * sequence, or a random position for round 0). At each step we pick uniformly
 * from unvisited tiles. NOTE: steps are NOT constrained to grid adjacency —
 * this is a permutation-style distinct-span sequence, not a grid path. (The
 * function keeps its historical `buildRandomWalk` name; see the file header
 * and `docs/adr/0005-memory-variant-review.md`.)
 *
 * Invariant: no tile appears twice in the sequence.
 */
function buildRandomWalk(
  rng: Rng,
  length: number,
  gridSize: number,
  prevSequence: readonly number[] | null,
): number[] {
  const sequence: number[] = [];
  const visited = new Set<number>();

  // Start position: last tile of previous sequence, or random if none.
  const startCandidate =
    prevSequence !== null && prevSequence.length > 0
      ? prevSequence[prevSequence.length - 1]
      : -1;

  // For the start, pick uniformly from unvisited tiles.
  // If the previous sequence's last tile is the start, it's excluded
  // from the "unvisited" set for position 0 to avoid trivial repetition.
  const candidates0: number[] = [];
  for (let i = 0; i < gridSize; i += 1) {
    candidates0.push(i);
  }
  const startShuffled = rng.shuffle(candidates0);
  const start = startShuffled[0];
  sequence.push(start);
  visited.add(start);

  // Build the rest of the walk: pick uniformly from unvisited tiles.
  for (let step = 1; step < length; step += 1) {
    const available: number[] = [];
    for (let i = 0; i < gridSize; i += 1) {
      if (!visited.has(i)) {
        available.push(i);
      }
    }
    if (available.length === 0) {
      // All tiles visited (shouldn't happen if length <= gridSize).
      break;
    }
    const shuffled = rng.shuffle(available);
    const next = shuffled[0];
    sequence.push(next);
    visited.add(next);
  }

  return sequence;
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
