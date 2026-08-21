/**
 * Deterministic board generation for the Order Sweep game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round comes from a
 * per-round RNG fork; each placement attempt draws from its own attempt-fork
 * so the draw sequence never depends on how many re-draws a previous round
 * needed.
 *
 * Generation invariants (enforced by construction and checked by
 * `validateRound` for tests/diagnostics):
 *
 *   1. Values are unique integers sampled from 1..maxValue — uniqueness makes
 *      the required sweep order unambiguous, so every board is solvable.
 *   2. `order` is exactly the token values sorted ascending — the sweep
 *      sequence.
 *   3. The row-major reading of the board is never exactly ascending: a
 *      trivially sorted board would let players sweep left-to-right without
 *      scanning. A violating candidate is re-drawn with an incremented
 *      attempt salt until it passes or the attempt budget is exhausted; the
 *      budget fallback deterministically accepts the last candidate, so
 *      generation always terminates (mirroring the tap-rush re-draw policy).
 */
import type { Rng } from '@/sdk';

import type { OrderSweepRound, Token } from './types';

/** Upper bound on board re-draws before the last candidate is accepted. */
export const MAX_PLACEMENT_ATTEMPTS = 32;

/** Float tolerance for validation assertions. */
export const VALIDATION_EPSILON = 1e-9;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  /** Tokens on the board. */
  readonly count: number;
  /** Grid columns; rows are derived as ceil(count / columns). */
  readonly columns: number;
  /** Tokens are sampled uniquely from 1..maxValue. */
  readonly maxValue: number;
}

/** Grid rows for a board of `count` tokens laid out in `columns` columns. */
export function rowsFor(count: number, columns: number): number {
  if (!Number.isInteger(count) || count <= 0 || !Number.isInteger(columns) || columns <= 0) {
    throw new RangeError(`rowsFor: count and columns must be positive integers, got ${count}/${columns}`);
  }
  return Math.ceil(count / columns);
}

/**
 * Sample `count` unique values from 1..maxValue via a partial Fisher–Yates
 * over the identity pool, returned ascending (the sweep sequence).
 */
function sampleOrderedValues(rng: Rng, count: number, maxValue: number): number[] {
  const pool = Array.from({ length: maxValue }, (_, i) => i + 1);
  const drawn: number[] = [];
  for (let i = 0; i < count; i += 1) {
    // Swap a random remaining element to position i, then shrink the pool.
    const j = i + rng.nextInt(pool.length - i);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
    drawn.push(pool[i]);
  }
  return drawn.sort((a, b) => a - b);
}

/** True when the row-major board reading is exactly the ascending sequence. */
function isTriviallySorted(tokens: readonly Token[], order: readonly number[]): boolean {
  // Token at cell k must hold order[k] for the board to read as sorted.
  return tokens.every((token) => token.value === order[token.id]);
}

/** Deterministic candidate board for one placement attempt. */
function drawBoard(
  rng: Rng,
  roundIndex: number,
  attempt: number,
  count: number,
  columns: number,
  maxValue: number,
): OrderSweepRound {
  const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
  const order = sampleOrderedValues(fork, count, maxValue);
  const rows = rowsFor(count, columns);
  const cells = rows * columns;
  // Shuffle cell indices and deal the ordered values onto them: each value
  // lands on a uniformly random distinct cell (holes stay empty).
  const cellOrder = fork.shuffle(Array.from({ length: cells }, (_, i) => i));
  const tokens: Token[] = order.map((value, index) => ({
    id: cellOrder[index],
    value,
  }));
  tokens.sort((a, b) => a.id - b.id); // row-major order for rendering
  return { tokens, order, columns, rows };
}

/**
 * Generate one round's board. Deterministic: the same
 * seed/round/count/columns/maxValue always yields the same board.
 */
export function generateRound(input: GenerateRoundInput): OrderSweepRound {
  const { rng, roundIndex, count, columns, maxValue } = input;
  if (count > maxValue) {
    throw new RangeError(
      `generateRound: cannot draw ${count} unique values from 1..${maxValue}`,
    );
  }
  let board = drawBoard(rng, roundIndex, 0, count, columns, maxValue);
  let attempt = 1;
  while (attempt < MAX_PLACEMENT_ATTEMPTS && isTriviallySorted(board.tokens, board.order)) {
    board = drawBoard(rng, roundIndex, attempt, count, columns, maxValue);
    attempt += 1;
  }
  return board;
}

/**
 * Validate a generated round against the generator invariants (unique ids in
 * range, unique in-range values, ascending order matching the values). Used by
 * tests and diagnostics; the generator itself is constructed to satisfy these,
 * so a non-ok result means a real regression.
 */
export function validateRound(
  round: OrderSweepRound,
  count: number,
  maxValue: number,
): { ok: boolean; reason: string | null } {
  const { tokens, order, columns, rows } = round;
  if (tokens.length !== count) {
    return { ok: false, reason: `board holds ${tokens.length} tokens, expected ${count}` };
  }
  if (columns <= 0 || rows !== rowsFor(count, columns)) {
    return { ok: false, reason: `grid ${rows}x${columns} does not match count ${count}` };
  }
  const ids = new Set<number>();
  const values = new Set<number>();
  for (const token of tokens) {
    if (token.id < 0 || token.id >= rows * columns || !Number.isInteger(token.id)) {
      return { ok: false, reason: `token id ${token.id} outside the grid` };
    }
    if (ids.has(token.id)) {
      return { ok: false, reason: `duplicate cell id ${token.id}` };
    }
    ids.add(token.id);
    if (
      !Number.isInteger(token.value) ||
      token.value < 1 ||
      token.value > maxValue + VALIDATION_EPSILON
    ) {
      return { ok: false, reason: `token value ${token.value} outside 1..${maxValue}` };
    }
    if (values.has(token.value)) {
      return { ok: false, reason: `duplicate value ${token.value}` };
    }
    values.add(token.value);
  }
  if (order.length !== count) {
    return { ok: false, reason: `order holds ${order.length} entries, expected ${count}` };
  }
  for (let i = 1; i < order.length; i += 1) {
    if (order[i] <= order[i - 1]) {
      return { ok: false, reason: `order is not strictly ascending at index ${i}` };
    }
  }
  const sortedValues = [...values].sort((a, b) => a - b);
  if (sortedValues.some((value, i) => value !== order[i])) {
    return { ok: false, reason: 'order does not match the board values' };
  }
  return { ok: true, reason: null };
}
