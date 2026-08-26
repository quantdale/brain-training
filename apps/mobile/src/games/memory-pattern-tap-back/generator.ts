/**
 * Deterministic sequence generation for the Pattern Tap Back game.
 *
 * Each round's sequence is an ADJACENCY-CONSTRAINED path — a random walk on
 * the grid's king graph, where every successive tile shares a side or corner
 * with the previous one (the ADR-0005 tracked differentiation from the Memory
 * game):
 * - No tile is lit twice in the same sequence, which also means the start tile
 *   can never be revisited (immediately or later).
 * - Each attempt draws a fresh uniform start; a walk that dead-ends (every
 *   neighbor of the current tile is already visited) restarts on the same
 *   fork stream, so retries stay cheap and fully deterministic.
 *
 * Near-duplicate avoidance: consecutive rounds that differ by only one tile
 * are confusable, so a candidate is re-drawn with an incremented attempt salt
 * until its distance from the previous round's sequence is at least
 * `MIN_SEQUENCE_HAMMING_DISTANCE` (or the budget is exhausted; the fallback
 * relaxes adjacency rather than the length/no-repeat contract). Every step is
 * deterministic — the same seed always yields the same session.
 */

import type { Rng } from '@/sdk';

/** Minimum distance between a round's sequence and the previous round's. */
export const MIN_SEQUENCE_HAMMING_DISTANCE = 2;

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_SEQUENCE_ATTEMPTS = 12;

/** Fresh-start retries available to a single attempt's walk before it gives up. */
const MAX_WALK_RESTARTS = 32;

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
 * True when `a` and `b` are distinct in-range tiles sharing a side or corner
 * (king-move adjacency on the square grid).
 */
export function tilesAreAdjacent(a: number, b: number, gridSize: number): boolean {
  if (a === b || a < 0 || b < 0 || a >= gridSize || b >= gridSize) {
    return false;
  }
  const side = gridSide(gridSize);
  const rowDelta = Math.abs(Math.floor(a / side) - Math.floor(b / side));
  const colDelta = Math.abs((a % side) - (b % side));
  return Math.max(rowDelta, colDelta) === 1;
}

/** Side length of the square grid (9 → 3×3, 16 → 4×4). */
function gridSide(gridSize: number): number {
  return Math.max(1, Math.round(Math.sqrt(gridSize)));
}

/** Tiles adjacent to `tile` in the king graph over the grid. */
function neighborTiles(tile: number, gridSize: number): number[] {
  const side = gridSide(gridSize);
  const row = Math.floor(tile / side);
  const col = tile % side;
  const neighbors: number[] = [];
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      if (rowDelta === 0 && colDelta === 0) {
        continue;
      }
      const nextRow = row + rowDelta;
      const nextCol = col + colDelta;
      if (nextRow < 0 || nextCol < 0 || nextRow >= side || nextCol >= side) {
        continue;
      }
      const index = nextRow * side + nextCol;
      if (index < gridSize) {
        neighbors.push(index);
      }
    }
  }
  return neighbors;
}

/**
 * Generate a round's sequence of distinct tiles forming a connected path.
 *
 * Each candidate is a random walk on the grid king graph (every step moves to
 * an adjacent tile). Determinism: `rng.fork` produces a child stream per
 * attempt (`round:${roundIndex}:attempt:${attempt}`); trapped walks retry
 * within their attempt's stream, and rejected candidates move to the next
 * attempt salt — the same seed always yields the same session.
 */
export function generateRoundSequence(input: GenerateRoundInput): number[] {
  const { rng, roundIndex, length, gridSize, prevSequence } = input;

  for (let attempt = 0; attempt < MAX_SEQUENCE_ATTEMPTS; attempt += 1) {
    const candidate = buildRandomWalk(
      rng.fork(`round:${roundIndex}:attempt:${attempt}`),
      length,
      gridSize,
    );
    if (candidate !== null && !isNearDuplicate(candidate, prevSequence)) {
      return candidate;
    }
  }

  // Extremely unlikely fallback: deterministically accept a distinct-span
  // sequence from the last attempt's fork — adjacency is relaxed rather than
  // violating the exact-length / no-repeat contract.
  return buildDistinctSpan(
    rng.fork(`round:${roundIndex}:attempt:${MAX_SEQUENCE_ATTEMPTS - 1}`),
    length,
    gridSize,
  );
}

/**
 * Build an adjacency-constrained path of `length` distinct tiles (a random
 * walk on the grid king graph). Returns `null` when every fresh-start retry
 * trapped before covering `length`; the caller treats that exactly like a
 * near-duplicate rejection and moves on to the next attempt salt.
 *
 * Invariants: consecutive tiles are adjacent (side or corner), and no tile
 * appears twice — so the start tile is never revisited.
 */
function buildRandomWalk(
  rng: Rng,
  length: number,
  gridSize: number,
): number[] | null {
  if (length < 1 || length > gridSize) {
    return null;
  }
  for (let restart = 0; restart < MAX_WALK_RESTARTS; restart += 1) {
    const walk = walkFromFreshStart(rng, length, gridSize);
    if (walk !== null) {
      return walk;
    }
  }
  return null;
}

/** One greedy walk; `null` when it dead-ends before covering `length`. */
function walkFromFreshStart(
  rng: Rng,
  length: number,
  gridSize: number,
): number[] | null {
  // Position 0 is a uniform draw over the whole grid; the near-duplicate
  // guard in `generateRoundSequence` prevents trivially confusable rounds.
  const startShuffled = rng.shuffle(
    Array.from({ length: gridSize }, (_, i) => i),
  );
  const sequence: number[] = [startShuffled[0]];
  const visited = new Set<number>(sequence);

  // Extend the walk: only UNVISITED neighbors qualify, which keeps the path
  // connected and non-repeating (excluding stepping back onto any earlier
  // tile, including the start).
  while (sequence.length < length) {
    const current = sequence[sequence.length - 1];
    const candidates = neighborTiles(current, gridSize).filter(
      (tile) => !visited.has(tile),
    );
    if (candidates.length === 0) {
      return null; // Trapped: every neighbor is already on the path.
    }
    const next = rng.shuffle(candidates)[0];
    sequence.push(next);
    visited.add(next);
  }

  return sequence;
}

/**
 * Legacy distinct-span builder: picks uniformly among unvisited tiles with no
 * adjacency constraint. Only used by the last-resort fallback so degenerate
 * rounds keep the exact-length / no-repeat contract.
 */
function buildDistinctSpan(
  rng: Rng,
  length: number,
  gridSize: number,
): number[] {
  const sequence: number[] = [];
  const visited = new Set<number>();

  // Position 0 is a uniform draw over the whole grid (the previous round's
  // last tile is NOT specially excluded; the near-duplicate guard below is
  // what prevents trivially confusable consecutive rounds).
  const startShuffled = rng.shuffle(
    Array.from({ length: gridSize }, (_, i) => i),
  );
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
