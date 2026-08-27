/**
 * Deterministic round generation for the Rule Grid game — chained deduction.
 *
 * Session seed provenance: `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per SDK generator rule.
 *
 * Puzzle model: an n×n Latin square (each row/col a permutation of 0..n-1) with
 * `B` hidden cells. The player answers one primary blank, but the puzzle
 * requires deducing interacting unknowns. Hard/Expert puzzles MUST have a
 * dependent chain (depth ≥2) — not merely multiple independent one-step blanks.
 *
 * Solver provenance: every returned puzzle is proved to have exactly one Latin
 * completion (exhaustive enumeration, limit 2) and its dependency depth is
 * measured via iterative singleton propagation. Final validation proves both;
 * there is no weakened fallback that returns a puzzle skipping that proof.
 *
 * Determinism: all randomness draws from a per-round RNG fork
 * `rng.fork(round:attempt)`, so seeds reproduce exactly.
 */

import type { Rng } from '@/sdk';

import type { RuleGridDifficultyParams, RuleGridRound } from './types';
import {
  buildVisibleBoard,
  computePropagationDepth,
  countSolutions,
} from './solver';

/** Attempts before giving up — there is no weakened fallback after this. */
export const MAX_ATTEMPTS = 100;

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
 * Both preserve the Latin property, giving a distributed board from the seed.
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
 * Legacy single-blank uniqueness oracle (kept for compatibility).
 * Counts how many symbols, placed in the blank cell, leave the blank's row and
 * column with all-distinct values.
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

/** Desired blank count for a given board size (mirrors difficulty.ts scaling). */
export function blanksForSize(n: number): number {
  switch (n) {
    case 3:
      return 2;
    case 4:
      return 3;
    case 5:
      return 4;
    case 6:
      return 6;
    default:
      return Math.min(4, Math.floor((n * n) / 3));
  }
}

/** Minimum propagation depth for a given board size. Hard (5) and Expert (6) require ≥2. */
export function minDepthForSize(n: number): number {
  if (n >= 5) return 2;
  return 1;
}

/**
 * Generate one round: a Latin square with multiple interacting blanks and a
 * provably unique solution plus minimum deduction depth.
 *
 * Deterministic: same `(rng.seed, roundIndex, params)` always yields the same
 * puzzle. Final validation proves uniqueness (exhaustive count ==1) and
 * depth (singleton propagation layers). If no depth-satisfying puzzle is found
 * within `MAX_ATTEMPTS`, the function throws — it NEVER returns a weakened
 * puzzle that skipped validation.
 */
export function generateRound(input: GenerateRoundInput): RuleGridRound {
  const { rng, roundIndex, params, prevRound } = input;
  const n = params.size;
  const cellCount = n * n;
  const desiredBlanks = blanksForSize(n);
  const minDepth = minDepthForSize(n);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const fork = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
    const square = generateSquare(n, fork);

    // Choose distinct blank positions.
    const shuffled = fork.shuffle(range(cellCount));
    const blanks = shuffled.slice(0, desiredBlanks).sort((a, b) => a - b);

    // Primary asked cell: random among blanks (so answer varies).
    const blankIndex = fork.pick(blanks);
    const blankRow = Math.floor(blankIndex / n);
    const blankCol = blankIndex % n;
    const answer = square[blankRow][blankCol];

    // Near-duplicate avoidance: don't repeat the same primary cell consecutively,
    // and avoid identical blank sets back-to-back.
    if (prevRound !== null) {
      if (prevRound.blankIndex === blankIndex) continue;
      if (
        prevRound.blanks.length === blanks.length &&
        prevRound.blanks.every((v, i) => v === blanks[i])
      ) {
        continue;
      }
    }

    const visible = buildVisibleBoard(square, blanks, n);

    // Prove uniqueness: exactly one Latin completion.
    if (countSolutions(visible, n, 2) !== 1) continue;

    // Prove depth: singleton propagation must solve all blanks and meet min depth.
    const prop = computePropagationDepth(visible, blanks, n);
    if (!prop.fullyPropagated) continue;
    if (prop.depth < minDepth) continue;

    // Explicitly reject Hard/Expert puzzles where every blank is independent.
    // For n>=5, minDepth>=2 already rejects depth==1, but add defensive check:
    // if all blanks were singleton on first layer, depth would be 1, so rejected.
    // No extra condition needed beyond depth check.

    const options = buildSymbolOptions(fork, answer, n);
    return {
      size: n,
      square: square.map((row) => [...row]),
      blankIndex,
      blankRow,
      blankCol,
      answer,
      options,
      blanks: [...blanks],
      depth: prop.depth,
      fullyPropagated: prop.fullyPropagated,
    };
  }

  throw new Error(
    `generateRound: failed to generate a valid chained-deduction puzzle after ${MAX_ATTEMPTS} attempts (size=${n}, minDepth=${minDepth}, blanks=${desiredBlanks}, round:${roundIndex})`,
  );
}

/** Validate a generated round: options include answer, uniqueness holds, and depth meets contract. */
export function validateGeneratedRound(round: RuleGridRound): boolean {
  if (!round.options.includes(round.answer)) return false;
  if (!round.blanks.includes(round.blankIndex)) return false;
  const visible = buildVisibleBoard(round.square, round.blanks, round.size);
  if (countSolutions(visible, round.size, 2) !== 1) return false;
  const prop = computePropagationDepth(visible, round.blanks, round.size);
  if (!prop.fullyPropagated) return false;
  if (prop.depth !== round.depth) return false;
  if (prop.depth < minDepthForSize(round.size)) return false;
  if (round.depth < minDepthForSize(round.size)) return false;
  return true;
}

/** Helper: [0, 1, ..., n-1]. */
function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}
