/**
 * Deterministic round generation for the Value Order game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round comes from a
 * per-round RNG fork (`round:<index>:attempt:<n>`), so the same seed always
 * yields the same session.
 *
 * Invariants (enforced by construction, checked by `validateRound`):
 * - Comparison values are integers and PAIRWISE DISTINCT within a round — a
 *   tie would make the ascending order ambiguous, so collisions are resolved
 *   by bounded re-draws followed by a deterministic sequential probe that
 *   always terminates.
 * - Exactly `min(expressionTiles, tileCount)` tiles disguise their value
 *   behind an expression (`a + b`, `a − b`, `a × b`); subtraction is drawn so
 *   the result is non-negative (`a > b`, enforced by a deterministic swap).
 * - Tiles are emitted in a seeded shuffled display order — never sorted — so
 *   tile position carries no information about rank.
 * - Consecutive rounds have different value sets when possible (variety); a
 *   candidate that repeats the previous set is re-drawn with an incremented
 *   attempt salt until it differs or `MAX_ROUND_ATTEMPTS` is exhausted — the
 *   deterministic fallback then accepts the last candidate (still fully
 *   valid; only variety is affected).
 */
import type { Rng } from '@/sdk';

import type { ValueOrderingDifficultyParams, ValueOrderingRound } from './types';

/** Upper bound on whole-round re-draws before the last candidate is accepted. */
export const MAX_ROUND_ATTEMPTS = 20;

/** Upper bound on per-tile value re-draws before the sequential probe kicks in. */
export const MAX_TILE_ATTEMPTS = 30;

/** Expression operators; display glyphs match the catalog convention ('−' '×'). */
export const EXPRESSION_OPERATORS = ['+', '−', '×'] as const;

export type ExpressionOperator = (typeof EXPRESSION_OPERATORS)[number];

/** Evaluate one expression operator (operands already ordered by the caller). */
export function evaluateExpression(operator: ExpressionOperator, a: number, b: number): number {
  switch (operator) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
  }
}

/** Format an expression the way it is displayed on a tile. */
export function formatExpression(operator: ExpressionOperator, a: number, b: number): string {
  return `${a} ${operator} ${b}`;
}

/** Positive modulo: wraps any integer into `[0, span)` even for negatives. */
function positiveMod(value: number, span: number): number {
  return ((value % span) + span) % span;
}

/**
 * Draw one distinct comparison value for a tile. Plain tiles draw uniformly
 * from `[minValue, maxValue]`; expression tiles draw two operands and an
 * operator (subtraction is swapped so `a > b`, keeping results non-negative).
 * Collisions with already-taken values are re-drawn up to `MAX_TILE_ATTEMPTS`
 * times, then resolved by a deterministic sequential probe over the value
 * range (expressions degrade to plain values) — always terminating, always
 * distinct.
 */
function drawDistinctValue(
  rng: Rng,
  kind: 'plain' | 'expression',
  params: ValueOrderingDifficultyParams,
  taken: ReadonlySet<number>,
): { kind: 'plain' | 'expression'; display: string; value: number } {
  const span = params.maxValue - params.minValue + 1;
  let lastValue = params.minValue;
  let lastDisplay = String(lastValue);
  let lastKind: 'plain' | 'expression' = 'plain';
  for (let attempt = 0; attempt < MAX_TILE_ATTEMPTS; attempt += 1) {
    if (kind === 'expression') {
      const operator = rng.pick(EXPRESSION_OPERATORS);
      let a = rng.nextIntRange(params.exprOperandMin, params.exprOperandMax + 1);
      let b = rng.nextIntRange(params.exprOperandMin, params.exprOperandMax + 1);
      // Deterministic swap keeps subtraction non-negative while both operands
      // stay inside the declared operand range.
      if (operator === '−' && b > a) {
        const tmp = a;
        a = b;
        b = tmp;
      }
      lastKind = 'expression';
      lastValue = evaluateExpression(operator, a, b);
      lastDisplay = formatExpression(operator, a, b);
    } else {
      lastKind = 'plain';
      lastValue = rng.nextIntRange(params.minValue, params.maxValue + 1);
      lastDisplay = String(lastValue);
    }
    if (!taken.has(lastValue)) {
      return { kind: lastKind, display: lastDisplay, value: lastValue };
    }
  }

  // Deterministic fallback: probe upward from the last candidate until a free
  // integer in range is found. The range hosts ≥ tileCount values (validated
  // in difficulty.ts), so the probe always terminates.
  let candidate = params.minValue + positiveMod(lastValue + 1 - params.minValue, span);
  while (taken.has(candidate)) {
    candidate = params.minValue + positiveMod(candidate + 1 - params.minValue, span);
  }
  return { kind: 'plain', display: String(candidate), value: candidate };
}

/** Sorted comparison values of a round (variety signature). */
export function sortedValuesOf(round: ValueOrderingRound): number[] {
  return round.tiles.map((tile) => tile.value).sort((a, b) => a - b);
}

/**
 * Generate one round's tile set in seeded display order. Deterministic: the
 * same seed/round/params/tileCount always yield the same round.
 */
export function generateRound(
  rng: Rng,
  roundIndex: number,
  params: ValueOrderingDifficultyParams,
  tileCount: number,
  prevValues: readonly number[] | null,
): ValueOrderingRound {
  const expressionCount = Math.min(params.expressionTiles, tileCount);

  let last: ValueOrderingRound | null = null;
  for (let attempt = 0; attempt < MAX_ROUND_ATTEMPTS; attempt += 1) {
    const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
    // Seeded assignment of which positions are expression-disguised.
    const positions = fork.shuffle(Array.from({ length: tileCount }, (_, i) => i));
    const expressionPositions = new Set(positions.slice(0, expressionCount));

    const taken = new Set<number>();
    const values: { kind: 'plain' | 'expression'; display: string; value: number }[] = [];
    for (let i = 0; i < tileCount; i += 1) {
      // Per-tile child stream: changing one draw never reshuffles the others.
      const tileRng = fork.fork(`tile:${i}`);
      const drawn = drawDistinctValue(
        tileRng,
        expressionPositions.has(i) ? 'expression' : 'plain',
        params,
        taken,
      );
      taken.add(drawn.value);
      values.push(drawn);
    }

    const round: ValueOrderingRound = {
      tiles: values.map((value, index) => ({
        id: `t${index}`,
        kind: value.kind,
        display: value.display,
        value: value.value,
      })),
    };
    last = round;
    if (
      prevValues === null ||
      sortedValuesOf(round).some((value, i) => value !== prevValues[i])
    ) {
      return round;
    }
  }

  // Deterministic fallback: accept the last candidate (always valid; only
  // variety is affected). Unreachable in practice for the shipped params.
  return last as ValueOrderingRound;
}

/** Convenience: a full deterministic round list for one session. */
export function generateSessionRounds(
  rng: Rng,
  params: ValueOrderingDifficultyParams,
  rounds: number = params.rounds,
): ValueOrderingRound[] {
  const list: ValueOrderingRound[] = [];
  let prevValues: number[] | null = null;
  for (let i = 0; i < rounds; i += 1) {
    const round = generateRound(rng, i, params, params.tiles, prevValues);
    list.push(round);
    prevValues = sortedValuesOf(round);
  }
  return list;
}

export interface RoundValidation {
  readonly ok: boolean;
  readonly reason: string | null;
}

/**
 * Verify a round's invariants: at least two tiles, unique ids, non-empty
 * displays, and pairwise-distinct finite integer values (no ambiguous order).
 * Used by tests and diagnostics; generation satisfies these, so a non-ok
 * result means a real regression.
 */
export function validateRound(
  round: ValueOrderingRound,
  expectedTiles?: number,
): RoundValidation {
  const { tiles } = round;
  if (tiles.length < 2) {
    return { ok: false, reason: `a round needs at least 2 tiles, got ${tiles.length}` };
  }
  if (expectedTiles !== undefined && tiles.length !== expectedTiles) {
    return { ok: false, reason: `expected ${expectedTiles} tiles, got ${tiles.length}` };
  }
  const ids = new Set<string>();
  const values = new Set<number>();
  for (const tile of tiles) {
    if (!Number.isInteger(tile.value) || !Number.isFinite(tile.value)) {
      return { ok: false, reason: `tile ${tile.id} value must be a finite integer` };
    }
    if (tile.display.length === 0) {
      return { ok: false, reason: `tile ${tile.id} has an empty display` };
    }
    if (ids.has(tile.id)) {
      return { ok: false, reason: `duplicate tile id ${tile.id}` };
    }
    ids.add(tile.id);
    if (values.has(tile.value)) {
      return { ok: false, reason: `ambiguous round: duplicate value ${tile.value}` };
    }
    values.add(tile.value);
  }
  return { ok: true, reason: null };
}
