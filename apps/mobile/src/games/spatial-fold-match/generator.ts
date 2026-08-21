/**
 * Deterministic generation for the Spatial Fold Match game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round produces:
 *   1. A source grid (randomly filled cells on a rows×cols matrix).
 *   2. A fold applied to the source (the "correct" answer).
 *   3. An option set: the correct folded grid + distractors.
 *
 * The fold is a PAPER FOLD that MERGES the two halves by OR: the kept half is
 * the base, and the folded-over half is OR'd onto the mirrored positions. A
 * cell is filled in the result when EITHER half has it filled.
 *
 * Invariants (enforced + verified by `validateRound`):
 *   - Same seed → same output (deterministic).
 *   - The chosen fold actually alters the source (else the answer is
 *     ambiguous — reject/regenerate, bounded attempts).
 *   - The correct option equals the folded source EXACTLY.
 *   - Distractors differ from the correct option.
 *   - Consecutive source grids avoid near-duplicates.
 */
import type { Rng } from '@/sdk';

import { ALL_FOLDS, FOLD_LABELS } from './types';
import type { FoldType } from './types';

// ---------------------------------------------------------------------------
// Grid model
// ---------------------------------------------------------------------------

/** A grid is a boolean matrix indexed [row][col]. */
export type Grid = boolean[][];

/** Build an all-empty grid. */
export function makeEmptyGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
}

/** Deep clone a grid (so callers can mutate freely). */
export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice());
}

/** Dimensions of a grid. */
export function gridDims(grid: Grid): { rows: number; cols: number } {
  return { rows: grid.length, cols: grid[0]?.length ?? 0 };
}

/** True when two grids are identical cell-for-cell. */
export function gridsEqual(a: Grid, b: Grid): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let r = 0; r < a.length; r += 1) {
    if (a[r].length !== b[r].length) {
      return false;
    }
    for (let c = 0; c < a[r].length; c += 1) {
      if (a[r][c] !== b[r][c]) {
        return false;
      }
    }
  }
  return true;
}

/** Number of cells that differ between two equally-sized grids. */
export function gridDistance(a: Grid, b: Grid): number {
  if (a.length !== b.length || (a[0]?.length ?? 0) !== (b[0]?.length ?? 0)) {
    return a.length * (a[0]?.length ?? 0) + 100; // large: never a near-duplicate
  }
  let distance = 0;
  for (let r = 0; r < a.length; r += 1) {
    for (let c = 0; c < a[r].length; c += 1) {
      if (a[r][c] !== b[r][c]) {
        distance += 1;
      }
    }
  }
  return distance;
}

// ---------------------------------------------------------------------------
// Fold math (the heart of the game)
// ---------------------------------------------------------------------------

/** Merge function: OR (the canonical fold rule — a cell is filled if EITHER half has it). */
function mergeOr(a: boolean, b: boolean): boolean {
  return a || b;
}

/**
 * Fold a grid along the vertical midline: the LEFT half folds over onto the
 * RIGHT half. The right half is the base; each left column `c` is OR'd onto
 * the mirrored right column `cols-1-c`. A column exactly on an odd fold line
 * stays as-is (it is part of the base and never targeted by the mirror).
 *
 * Result width = ceil(cols/2). Height is unchanged.
 */
function foldGridV(grid: Grid, merge: (a: boolean, b: boolean) => boolean = mergeOr): Grid {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const rightStart = Math.floor(cols / 2);
  const newCols = Math.ceil(cols / 2);
  const result: Grid = [];
  for (let r = 0; r < rows; r += 1) {
    const newRow: boolean[] = [];
    for (let j = 0; j < newCols; j += 1) {
      newRow.push(grid[r][rightStart + j] ?? false);
    }
    result.push(newRow);
  }
  for (let c = 0; c < rightStart; c += 1) {
    const targetCol = (cols - 1 - c) - rightStart;
    if (targetCol >= 0 && targetCol < newCols) {
      for (let r = 0; r < rows; r += 1) {
        result[r][targetCol] = merge(result[r][targetCol], grid[r][c]);
      }
    }
  }
  return result;
}

/**
 * Fold a grid along the horizontal midline: the TOP half folds over onto the
 * BOTTOM half. The bottom half is the base; each top row `r` is OR'd onto the
 * mirrored bottom row `rows-1-r`. A row exactly on an odd fold line stays
 * as-is.
 *
 * Result height = ceil(rows/2). Width is unchanged.
 */
function foldGridH(grid: Grid, merge: (a: boolean, b: boolean) => boolean = mergeOr): Grid {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const bottomStart = Math.floor(rows / 2);
  const newRows = Math.ceil(rows / 2);
  const result: Grid = [];
  for (let j = 0; j < newRows; j += 1) {
    const newRow: boolean[] = [];
    for (let c = 0; c < cols; c += 1) {
      newRow.push(grid[bottomStart + j]?.[c] ?? false);
    }
    result.push(newRow);
  }
  for (let r = 0; r < bottomStart; r += 1) {
    const targetRow = (rows - 1 - r) - bottomStart;
    if (targetRow >= 0 && targetRow < newRows) {
      for (let c = 0; c < cols; c += 1) {
        result[targetRow][c] = merge(result[targetRow][c], grid[r][c]);
      }
    }
  }
  return result;
}

/**
 * Apply a fold to a source grid.
 *   - foldV  → fold left over right (horizontal result, same height)
 *   - foldH  → fold top over bottom (vertical result, same width)
 *   - foldVH → foldV then foldH (smallest result)
 *
 * Each fold merges the two halves by OR.
 */
export function applyFold(source: Grid, fold: FoldType): Grid {
  let result = cloneGrid(source);
  if (fold === 'foldV' || fold === 'foldVH') {
    result = foldGridV(result);
  }
  if (fold === 'foldH' || fold === 'foldVH') {
    result = foldGridH(result);
  }
  return result;
}

/**
 * Wrong-merge variant: fold with XOR instead of OR. A cell is filled only
 * when exactly ONE of the two halves has it. Produces a visually distinct
 * distractor that shares the same result dimensions.
 */
export function applyFoldXor(source: Grid, fold: FoldType): Grid {
  const mergeXor = (a: boolean, b: boolean): boolean => a !== b;
  let result = cloneGrid(source);
  if (fold === 'foldV' || fold === 'foldVH') {
    result = foldGridV(result, mergeXor);
  }
  if (fold === 'foldH' || fold === 'foldVH') {
    result = foldGridH(result, mergeXor);
  }
  return result;
}

/**
 * Reflect-only variant: keep the base half but DO NOT merge the folded half.
 * A distinct distractor at the result dimensions.
 */
export function applyFoldBaseOnly(source: Grid, fold: FoldType): Grid {
  const mergeKeepBase = (_base: boolean, _folded: boolean): boolean => false;
  let result = cloneGrid(source);
  if (fold === 'foldV' || fold === 'foldVH') {
    result = foldGridV(result, mergeKeepBase);
  }
  if (fold === 'foldH' || fold === 'foldVH') {
    result = foldGridH(result, mergeKeepBase);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Source generation
// ---------------------------------------------------------------------------

/** Minimum number of differing cells between consecutive source grids. */
export const MIN_PATTERN_DISTANCE = 2;

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_GENERATION_ATTEMPTS = 12;

/**
 * Generate a random source grid: `filledCells` distinct filled cells on a
 * rows×cols matrix, placed deterministically from the (already forked) RNG.
 */
export function generateSourceGrid(
  rng: Rng,
  roundIndex: number,
  rows: number,
  cols: number,
  filledCells: number,
): Grid {
  const coords: [number, number][] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      coords.push([r, c]);
    }
  }
  const shuffled = rng.fork(`source:round:${roundIndex}`).shuffle(coords);
  const grid = makeEmptyGrid(rows, cols);
  for (let i = 0; i < filledCells; i += 1) {
    const [r, c] = shuffled[i];
    grid[r][c] = true;
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Round data generation
// ---------------------------------------------------------------------------

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly gridRows: number;
  readonly gridCols: number;
  readonly filledCells: number;
  readonly foldsAllowed: readonly FoldType[];
  readonly optionCount: number;
  /** Previous round's source grid, or null for round 0. */
  readonly prevSource: Grid | null;
  /** Previous round's fold type, or null for round 0. */
  readonly prevFold: FoldType | null;
}

export interface RoundData {
  /** The source grid. */
  readonly source: Grid;
  /** The fold applied to produce the correct answer. */
  readonly foldType: FoldType;
  /** Human-readable label for the fold. */
  readonly foldLabel: string;
  /** The correct folded grid. */
  readonly correctPattern: Grid;
  /** Result grid dimensions (post-fold). */
  readonly resultRows: number;
  readonly resultCols: number;
  /** All option grids (1 correct + distractors), in display order. */
  readonly options: readonly Grid[];
  /** Index of the correct option in the options array. */
  readonly correctOptionIndex: number;
}

const gridKey = (grid: Grid): string => JSON.stringify(grid);

/**
 * Build the distractor pool for a round. Every candidate is forced to the
 * correct result dimensions and is guaranteed to differ from the correct
 * pattern. Strategies:
 *   1. XOR merge (wrong merge rule) of the correct fold.
 *   2. Reflect-only (base half, no merge).
 *   3. A different source grid folded with the correct fold.
 *   4. A wrong-axis fold (only when its result dims match the correct dims).
 *   5. Additional random different-source folds (fallback to reach optionCount).
 */
function buildDistractors(
  input: GenerateRoundInput,
  source: Grid,
  fold: FoldType,
  correct: Grid,
  resultRows: number,
  resultCols: number,
): Grid[] {
  const { rng, roundIndex, gridRows, gridCols, filledCells, optionCount, foldsAllowed } = input;
  const dRng = rng.fork(`distractors:round:${roundIndex}`);
  const candidates: Grid[] = [];

  const accept = (grid: Grid): boolean => {
    if (grid.length !== resultRows || (grid[0]?.length ?? 0) !== resultCols) {
      return false;
    }
    if (gridsEqual(grid, correct)) {
      return false;
    }
    const k = gridKey(grid);
    if (candidates.some((c) => gridKey(c) === k)) {
      return false;
    }
    candidates.push(grid);
    return true;
  };

  // 1 + 2: XOR merge and reflect-only (always valid dims).
  accept(applyFoldXor(source, fold));
  accept(applyFoldBaseOnly(source, fold));

  // 3: a different source folded with the correct fold.
  const altSource = generateSourceGrid(
    dRng.fork('alt-source'),
    roundIndex,
    gridRows,
    gridCols,
    filledCells,
  );
  if (!gridsEqual(altSource, source)) {
    accept(applyFold(altSource, fold));
  }

  // 4: a wrong-axis fold whose result dims happen to match.
  for (const f of foldsAllowed) {
    if (f === fold) {
      continue;
    }
    const w = applyFold(source, f);
    if (w.length === resultRows && (w[0]?.length ?? 0) === resultCols) {
      accept(w);
      break;
    }
  }

  // 5: fallback random different-source folds until we have enough.
  let idx = 0;
  while (candidates.length < optionCount - 1 && idx < MAX_GENERATION_ATTEMPTS) {
    const alt = generateSourceGrid(
      dRng.fork(`alt-source:${idx}`),
      roundIndex,
      gridRows,
      gridCols,
      filledCells,
    );
    idx += 1;
    if (gridsEqual(alt, source)) {
      continue;
    }
    accept(applyFold(alt, fold));
  }

  return candidates.slice(0, optionCount - 1);
}

/**
 * Generate all data for one round: source grid, fold, correct answer, and
 * option set (correct + distractors).
 *
 * Invariants enforced:
 *   - The chosen fold actually changes the source (no ambiguous answer).
 *   - Correct option === folded source.
 *   - Distractors differ from the correct option.
 *   - Consecutive sources differ by at least MIN_PATTERN_DISTANCE cells.
 */
export function generateRoundData(input: GenerateRoundInput): RoundData {
  const { rng, roundIndex, gridRows, gridCols, foldsAllowed, prevSource, prevFold } =
    input;

  // ---- Step 1+2: pick a source + fold, rejecting folds that change nothing.
  let source: Grid | null = null;
  let chosenFold: FoldType | null = null;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateSourceGrid(
      rng.fork(`source-attempt:${roundIndex}:${attempt}`),
      roundIndex,
      gridRows,
      gridCols,
      input.filledCells,
    );
    const tooClose =
      prevSource !== null && gridDistance(candidate, prevSource) < MIN_PATTERN_DISTANCE;
    if (tooClose) {
      continue;
    }
    // Pick a fold; prefer one that changes the source, and differ from prevFold.
    let fold: FoldType | null = null;
    if (foldsAllowed.length === 1) {
      fold = foldsAllowed[0];
    } else {
      const fRng = rng.fork(`fold:round:${roundIndex}:attempt:${attempt}`);
      const idx = fRng.nextInt(foldsAllowed.length);
      fold = foldsAllowed[idx];
      if (prevFold !== null && fold === prevFold && attempt < MAX_GENERATION_ATTEMPTS - 1) {
        continue;
      }
    }
    const folded = applyFold(candidate, fold);
    // Reject folds that change nothing (ambiguous answer).
    if (gridsEqual(folded, candidate)) {
      continue;
    }
    source = candidate;
    chosenFold = fold;
    break;
  }

  // Bounded fallback: accept the last deterministic candidate.
  if (source === null || chosenFold === null) {
    source = generateSourceGrid(rng, roundIndex, gridRows, gridCols, input.filledCells);
    chosenFold = foldsAllowed[0];
  }

  const correctPattern = applyFold(source, chosenFold);
  const { rows: resultRows, cols: resultCols } = gridDims(correctPattern);

  // ---- Step 3: build distractors + combine into options.
  const distractors = buildDistractors(
    input,
    source,
    chosenFold,
    correctPattern,
    resultRows,
    resultCols,
  );
  const allOptions: Grid[] = [correctPattern, ...distractors];
  const shuffledOptions = rng.fork(`options:round:${roundIndex}`).shuffle(allOptions);
  const correctIndex = shuffledOptions.findIndex((o) => gridsEqual(o, correctPattern));

  return {
    source,
    foldType: chosenFold,
    foldLabel: FOLD_LABELS[chosenFold],
    correctPattern,
    resultRows,
    resultCols,
    options: shuffledOptions,
    correctOptionIndex: correctIndex,
  };
}

// ---------------------------------------------------------------------------
// Self-check / validation
// ---------------------------------------------------------------------------

/**
 * Validate a generated round. THROWS on any invariant violation:
 *   - correctPattern must equal applyFold(source, foldType).
 *   - all options must have the correct result dimensions.
 *   - options must be pairwise distinct.
 *   - exactly one option equals the correct pattern (correctOptionIndex).
 */
export function validateRound(round: RoundData): void {
  const { source, foldType, correctPattern, options, correctOptionIndex } = round;

  // 1. Correct answer matches the fold of the source exactly.
  const recomputed = applyFold(source, foldType);
  if (!gridsEqual(recomputed, correctPattern)) {
    throw new Error('validateRound: correctPattern does not equal applyFold(source, foldType)');
  }

  const { rows, cols } = gridDims(correctPattern);

  // 2. All options share the result dimensions.
  for (const opt of options) {
    const d = gridDims(opt);
    if (d.rows !== rows || d.cols !== cols) {
      throw new Error('validateRound: option has wrong dimensions');
    }
  }

  // 3. Options are pairwise distinct.
  for (let i = 0; i < options.length; i += 1) {
    for (let j = i + 1; j < options.length; j += 1) {
      if (gridsEqual(options[i], options[j])) {
        throw new Error('validateRound: duplicate option detected');
      }
    }
  }

  // 4. Exactly one correct option, and correctOptionIndex points at it.
  const correctCount = options.filter((o) => gridsEqual(o, correctPattern)).length;
  if (correctCount !== 1) {
    throw new Error(`validateRound: expected exactly one correct option, found ${correctCount}`);
  }
  if (correctOptionIndex < 0 || correctOptionIndex >= options.length) {
    throw new Error('validateRound: correctOptionIndex out of range');
  }
  if (!gridsEqual(options[correctOptionIndex], correctPattern)) {
    throw new Error('validateRound: correctOptionIndex does not point at the correct option');
  }
}

/** Re-export so callers can validate against the full fold pool if desired. */
export { ALL_FOLDS };
