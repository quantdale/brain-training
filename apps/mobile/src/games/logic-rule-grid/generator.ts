/**
 * Deterministic round generation for the Rule Grid game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule.
 *
 * The board is a Latin square: every row and every column is a permutation of
 * the symbols 0..n-1. Exactly one cell is blanked; because each row already
 * contains every symbol except the one removed from the blank, the missing
 * symbol is the UNIQUE valid completion (see `isUniquelySolvable`). The player
 * applies the row-column constraint to deduce it.
 *
 * All randomness is drawn from a per-round RNG fork, so changing one round's
 * seed source cannot affect the others. Near-duplicate avoidance (same blank
 * position two rounds in a row) keeps rounds from feeling identical.
 */
import type { Rng } from '@/sdk';

import type { RuleGridDifficultyParams, RuleGridRound } from './types';

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_ATTEMPTS = 12;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly params: RuleGridDifficultyParams;
  /** Previous round, or null for round 0. */
  readonly prevRound: RuleGridRound | null;
}

/**
 * Build a valid Latin square of side `n` deterministically.
 *
 * Construction is a bijection of the canonical cyclic square `base[r][c] =
 * (r + c) % n`, so every row/column is already a permutation. We then:
 *   1. relabel symbols via a random permutation `perm` of 0..n-1, and
 *   2. permute the rows and columns via `rowPerm` / `colPerm`.
 * Both relabeling and row/column permutation preserve the Latin-square
 * property, giving a uniformly-ish distributed valid board from the seed.
 */
export function generateSquare(n: number, rng: Rng): number[][] {
  const base: number[][] = [];
  for (let r = 0; r < n; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < n; c += 1) {
      row.push((r + c) % n);
    }
    base.push(row);
  }

  const perm = rng.shuffle(range(n));
  const relabeled: number[][] = base.map((row) => row.map((v) => perm[v]));

  const rowPerm = rng.shuffle(range(n));
  const colPerm = rng.shuffle(range(n));

  const out: number[][] = [];
  for (let r = 0; r < n; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < n; c += 1) {
      row.push(relabeled[rowPerm[r]][colPerm[c]]);
    }
    out.push(row);
  }
  return out;
}

/**
 * Count how many symbols, placed in the blank cell, leave the blank's row and
 * column with all-distinct values. A well-formed Latin square always yields
 * exactly one (the removed symbol); this is the uniqueness oracle used to
 * validate generated rounds.
 *
 * `expectedAnswer` is the symbol originally removed at `blankIndex`.
 */
export function isUniquelySolvable(
  square: readonly (readonly number[])[],
  blankIndex: number,
  n: number,
  expectedAnswer: number,
): boolean {
  const row = Math.floor(blankIndex / n);
  const col = blankIndex % n;

  const rowValues = new Set<number>();
  for (let c = 0; c < n; c += 1) {
    if (c === col) continue;
    rowValues.add(square[row][c]);
  }
  const colValues = new Set<number>();
  for (let r = 0; r < n; r += 1) {
    if (r === row) continue;
    colValues.add(square[r][col]);
  }

  let validCount = 0;
  let unique = -1;
  for (let s = 0; s < n; s += 1) {
    if (rowValues.has(s)) continue;
    if (colValues.has(s)) continue;
    validCount += 1;
    unique = s;
  }
  return validCount === 1 && unique === expectedAnswer;
}

/**
 * Build the answer candidate list: always includes the correct `answer`, then
 * fills with distinct decoys from 0..n-1 until `target` symbols are present.
 * `target` is `min(n, 5)` (so at least 4 when n allows). The list is shuffled
 * with the round fork so the correct answer is not always first.
 */
export function buildSymbolOptions(fork: Rng, answer: number, n: number): number[] {
  const target = Math.min(n, 5);
  const options = new Set<number>([answer]);
  const decoys = fork.shuffle(range(n).filter((v) => v !== answer));
  for (const d of decoys) {
    if (options.size >= target) break;
    options.add(d);
  }
  return fork.shuffle([...options]);
}

/**
 * Generate one round: a Latin square with a uniquely-solvable blank cell.
 * Re-draws (deterministically, via an incremented attempt salt) until the
 * blank is uniquely solvable and not confusable with the previous round
 * (same blank row & column). Falls back to the last candidate if the budget
 * is exhausted — but every valid Latin square is uniquely solvable, so the
 * fallback is always acceptable.
 */
export function generateRound(input: GenerateRoundInput): RuleGridRound {
  const { rng, roundIndex, params, prevRound } = input;
  const n = params.size;
  const cellCount = n * n;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
    const square = generateSquare(n, fork);
    const blankIndex = fork.nextInt(cellCount);
    const blankRow = Math.floor(blankIndex / n);
    const blankCol = blankIndex % n;
    const answer = square[blankRow][blankCol];

    if (!isUniquelySolvable(square, blankIndex, n, answer)) {
      continue;
    }
    if (
      prevRound !== null &&
      prevRound.blankRow === blankRow &&
      prevRound.blankCol === blankCol
    ) {
      continue;
    }

    const options = buildSymbolOptions(fork, answer, n);
    return {
      size: n,
      square: square.map((row) => [...row]),
      blankIndex,
      blankRow,
      blankCol,
      answer,
      options,
    };
  }

  // Extremely unlikely fallback: accept the last deterministically drawn round.
  const fork = rng.fork(`round:${roundIndex}:attempt:${MAX_ATTEMPTS - 1}`);
  const square = generateSquare(n, fork);
  const blankIndex = fork.nextInt(cellCount);
  const blankRow = Math.floor(blankIndex / n);
  const blankCol = blankIndex % n;
  const answer = square[blankRow][blankCol];
  const options = buildSymbolOptions(fork, answer, n);
  return {
    size: n,
    square: square.map((row) => [...row]),
    blankIndex,
    blankRow,
    blankCol,
    answer,
    options,
  };
}

/** Validate a generated round: options include the answer and it's uniquely solvable. */
export function validateGeneratedRound(round: RuleGridRound): boolean {
  if (!round.options.includes(round.answer)) {
    return false;
  }
  return isUniquelySolvable(round.square, round.blankIndex, round.size, round.answer);
}

/** Helper: [0, 1, ..., n-1]. */
function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}
