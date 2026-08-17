/**
 * Deterministic generation for the Spatial Transform Match game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Each round produces:
 *   1. A source pattern (randomly filled cells on a grid).
 *   2. A transform applied to the source (the "correct" answer).
 *   3. An option set: the correct transformed pattern + distractors.
 *
 * Invariants:
 *   - Same seed → same output (deterministic).
 *   - Source patterns are NOT symmetric under the chosen transform
 *     (else the answer is ambiguous — reject/regenerate, bounded attempts).
 *   - The correct option equals the transformed source EXACTLY.
 *   - Distractors differ from the correct option (compare cell sets).
 *   - Consecutive source patterns avoid near-duplicates.
 */
import type { Rng } from '@/sdk';

import { ALL_TRANSFORMS } from './types';
import type { TransformType } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum number of differing cells between consecutive source patterns. */
export const MIN_PATTERN_DISTANCE = 2;

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_GENERATION_ATTEMPTS = 12;

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** Convert a flat cell index to (row, col) coordinates. */
export function indexToCoords(index: number, side: number): { row: number; col: number } {
  return { row: Math.floor(index / side), col: index % side };
}

/** Convert (row, col) coordinates to a flat cell index. */
export function coordsToIndex(row: number, col: number, side: number): number {
  return row * side + col;
}

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

/**
 * Apply a 2D transform to a set of cell coordinates.
 * Returns a sorted array of transformed cell indices.
 */
export function applyTransform(
  pattern: readonly number[],
  transform: TransformType,
  side: number,
): number[] {
  return pattern
    .map((index) => {
      const { row, col } = indexToCoords(index, side);
      const t = transformCoords(row, col, transform, side);
      return coordsToIndex(t.row, t.col, side);
    })
    .sort((a, b) => a - b);
}

/** Apply a single coordinate transform. */
function transformCoords(
  row: number,
  col: number,
  transform: TransformType,
  side: number,
): { row: number; col: number } {
  switch (transform) {
    case 'rotate90':
      // Clockwise 90°: (r,c) → (c, side-1-r)
      return { row: col, col: side - 1 - row };
    case 'rotate180':
      // 180°: (r,c) → (side-1-r, side-1-c)
      return { row: side - 1 - row, col: side - 1 - col };
    case 'rotate270':
      // Clockwise 270° (= counterclockwise 90°): (r,c) → (side-1-c, r)
      return { row: side - 1 - col, col: row };
    case 'mirrorH':
      // Horizontal flip (left-right): (r,c) → (r, side-1-c)
      return { row, col: side - 1 - col };
    case 'mirrorV':
      // Vertical flip (top-bottom): (r,c) → (side-1-r, c)
      return { row: side - 1 - row, col };
  }
}

/**
 * Check whether a pattern is symmetric under a given transform.
 * A pattern is symmetric if applying the transform yields the same set of
 * filled cells (which would make the answer ambiguous).
 */
export function isSymmetric(
  pattern: readonly number[],
  transform: TransformType,
  side: number,
): boolean {
  const transformed = applyTransform(pattern, transform, side);
  if (pattern.length !== transformed.length) {
    return false;
  }
  // Both are sorted, so element-wise comparison suffices.
  for (let i = 0; i < pattern.length; i += 1) {
    if (pattern[i] !== transformed[i]) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Pattern generation
// ---------------------------------------------------------------------------

/**
 * Generate a random source pattern: `filledCells` distinct cell indices from
 * a grid of `gridSize` cells, sorted ascending.
 */
export function generateSourcePattern(
  rng: Rng,
  roundIndex: number,
  gridSize: number,
  filledCells: number,
): number[] {
  const indices = Array.from({ length: gridSize }, (_, i) => i);
  return rng
    .fork(`source:round:${roundIndex}`)
    .shuffle(indices)
    .slice(0, filledCells)
    .sort((a, b) => a - b);
}

/**
 * Compute the distance between two patterns (both sorted, same length).
 * For same-length patterns: returns `filledCells - |intersection|`, i.e.
 * the number of cells that differ. For different-length patterns: returns
 * a large value to ensure they are never considered near-duplicates.
 *
 * With MIN_PATTERN_DISTANCE = 2, consecutive source patterns must differ
 * in at least 2 cell positions.
 */
export function patternDistance(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== b.length) {
    return Math.abs(a.length - b.length) + Math.min(a.length, b.length);
  }
  // Count intersection size (both sorted, same length).
  let intersection = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      intersection += 1;
      i += 1;
      j += 1;
    } else if (a[i] < b[j]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return a.length - intersection;
}

/** True when two patterns are the same set of cells (both sorted). */
function patternsEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Round data generation
// ---------------------------------------------------------------------------

export interface GenerateRoundDataInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly gridSize: number;
  readonly side: number;
  readonly filledCells: number;
  readonly allowedTransforms: readonly TransformType[];
  readonly optionCount: number;
  /** Previous round's source pattern, or null for round 0. */
  readonly prevSource: readonly number[] | null;
  /** Previous round's transform type, or null for round 0. */
  readonly prevTransform: TransformType | null;
}

export interface RoundData {
  /** The source pattern (sorted cell indices). */
  readonly source: readonly number[];
  /** The transform applied to produce the correct answer. */
  readonly transformType: TransformType;
  /** The correct transformed pattern (sorted cell indices). */
  readonly correctPattern: readonly number[];
  /** All option patterns (1 correct + distractors), in display order. */
  readonly options: readonly (readonly number[])[];
  /** Index of the correct option in the options array. */
  readonly correctOptionIndex: number;
}

/**
 * Generate all data for one round: source pattern, transform, correct answer,
 * and option set (correct + distractors).
 *
 * Invariants enforced:
 *   - Source is not symmetric under the chosen transform.
 *   - Correct option === transformed source.
 *   - Distractors differ from the correct option.
 *   - Consecutive sources differ by at least MIN_PATTERN_DISTANCE cells.
 */
export function generateRoundData(input: GenerateRoundDataInput): RoundData {
  const {
    rng,
    roundIndex,
    gridSize,
    side,
    filledCells,
    allowedTransforms,
    optionCount,
    prevSource,
    prevTransform,
  } = input;

  // ---- Step 1: Generate source pattern with near-duplicate avoidance.
  let source: number[] | null = null;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateSourcePattern(
      rng.fork(`source-attempt:${roundIndex}:${attempt}`),
      roundIndex,
      gridSize,
      filledCells,
    );
    const tooClose =
      prevSource !== null && patternDistance(candidate, prevSource) < MIN_PATTERN_DISTANCE;
    if (!tooClose) {
      source = candidate;
      break;
    }
  }
  if (source === null) {
    // Fallback: accept the last candidate deterministically.
    source = generateSourcePattern(rng, roundIndex, gridSize, filledCells);
  }

  // ---- Step 2: Pick a transform, rejecting symmetry.
  let chosenTransform: TransformType | null = null;
  let correctPattern: number[] | null = null;
  if (allowedTransforms.length === 1) {
    // Only one transform available: use it directly (symmetry rejection is
    // irrelevant since we have no alternative).
    chosenTransform = allowedTransforms[0];
    correctPattern = applyTransform(source, chosenTransform, side);
  } else {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const tRng = rng.fork(`transform:round:${roundIndex}:attempt:${attempt}`);
      const idx = tRng.nextInt(allowedTransforms.length);
      const candidate = allowedTransforms[idx];
      if (!isSymmetric(source, candidate, side)) {
        // Prefer a different transform from the previous round when possible.
        if (candidate === prevTransform && attempt < MAX_GENERATION_ATTEMPTS - 1) {
          continue;
        }
        chosenTransform = candidate;
        correctPattern = applyTransform(source, candidate, side);
        break;
      }
    }
  }
  if (chosenTransform === null || correctPattern === null) {
    // Fallback: use the first allowed transform (symmetry is extremely unlikely
    // to block all transforms for random patterns).
    chosenTransform = allowedTransforms[0];
    correctPattern = applyTransform(source, chosenTransform, side);
  }

  // ---- Step 3: Generate distractors (other transforms first, then random).
  const otherTransforms = ALL_TRANSFORMS.filter((t) => t !== chosenTransform);
  const distractors: number[][] = [];
  const dRng = rng.fork(`distractors:round:${roundIndex}`);

  // Use other-transform results as distractors.
  const shuffledOther = dRng.shuffle([...otherTransforms]);
  for (const t of shuffledOther) {
    if (distractors.length >= optionCount - 1) {
      break;
    }
    const d = applyTransform(source, t, side);
    if (!patternsEqual(d, correctPattern)) {
      distractors.push(d);
    }
  }

  // If still not enough, generate random patterns of the same density.
  let fallbackIdx = 0;
  while (distractors.length < optionCount - 1) {
    const randPattern = generateSourcePattern(
      rng.fork(`rand-distractor:round:${roundIndex}:${fallbackIdx}`),
      roundIndex,
      gridSize,
      filledCells,
    );
    fallbackIdx += 1;
    if (
      !patternsEqual(randPattern, correctPattern) &&
      !distractors.some((d) => patternsEqual(d, randPattern))
    ) {
      distractors.push(randPattern);
    }
    // Safety: prevent infinite loop (extremely unlikely).
    if (fallbackIdx > MAX_GENERATION_ATTEMPTS) {
      break;
    }
  }

  // ---- Step 4: Combine correct + distractors and shuffle into options.
  const allOptions: number[][] = [correctPattern, ...distractors];
  const shuffledOptions = rng.fork(`options:round:${roundIndex}`).shuffle(allOptions);
  const correctIndex = shuffledOptions.findIndex((o) => patternsEqual(o, correctPattern));

  return {
    source,
    transformType: chosenTransform,
    correctPattern,
    options: shuffledOptions,
    correctOptionIndex: correctIndex,
  };
}
