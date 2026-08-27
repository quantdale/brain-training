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
 * Invariants (enforced by `validateGeneratedRound` at the final boundary):
 *   - Same seed → same output (deterministic).
 *   - Source patterns are NOT symmetric under the chosen transform
 *     (else the answer is ambiguous — reject/regenerate, bounded attempts).
 *   - The correct option equals the transformed source EXACTLY.
 *   - Distractors differ from the correct option (compare cell sets).
 *   - Options are pairwise distinct and exactly `optionCount` in length.
 *   - Hidden-source semantics are unambiguous: exactly one option equals
 *     some allowed-transform result of the source (the correct one).
 *   - Consecutive source patterns avoid near-duplicates.
 *
 * Production inventory (see § 8.1 — every production difficulty/profile):
 *   - easy:     grid 9 (3×3), filled 3, allowed [rotate90],            optionCount 2, rounds 4
 *   - normal:   grid 9 (3×3), filled 4, allowed [rotate90,rotate180],   optionCount 3, rounds 5
 *   - hard:     grid 16 (4×4), filled 4, allowed [rotate90,180,270],   optionCount 3, rounds 6
 *   - expert:   grid 16 (4×4), filled 5, allowed [rotate90,180,270,mirrorH,mirrorV], optionCount 4, rounds 7
 *   - adaptive: grid 9 (3×3), filled 3 (range 3–6), allowed [rotate90,180,270], optionCount 2 (range 2–4), rounds 6
 *   Adaptive extremes (optionCount 4 / filled 6 on 3×3) are part of the
 *   same inventory and are exercised by property sweeps.
 */
import type { Rng } from "@/sdk";

import { ALL_TRANSFORMS } from "./types";
import type { TransformType } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum number of differing cells between consecutive source patterns. */
export const MIN_PATTERN_DISTANCE = 2;

/** Upper bound on re-draw attempts for a single inner step before outer retry. */
export const MAX_GENERATION_ATTEMPTS = 12;

/** Outer budget: full candidate retries through the final validator. */
export const OUTER_GENERATION_ATTEMPTS = 50;

/** Inner budget for distractor collection (must be large enough to guarantee exact count for production profiles). */
export const DISTRACTOR_ATTEMPTS = 200;

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** Convert a flat cell index to (row, col) coordinates. */
export function indexToCoords(
  index: number,
  side: number,
): { row: number; col: number } {
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
    case "rotate90":
      // Clockwise 90°: (r,c) → (c, side-1-r)
      return { row: col, col: side - 1 - row };
    case "rotate180":
      // 180°: (r,c) → (side-1-r, side-1-c)
      return { row: side - 1 - row, col: side - 1 - col };
    case "rotate270":
      // Clockwise 270° (= counterclockwise 90°): (r,c) → (side-1-c, r)
      return { row: side - 1 - col, col: row };
    case "mirrorH":
      // Horizontal flip (left-right): (r,c) → (r, side-1-c)
      return { row, col: side - 1 - col };
    case "mirrorV":
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

// ---------------------------------------------------------------------------
// Final validator — single contract for every return path (main + fallback)
// ---------------------------------------------------------------------------

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

/**
 * Single final-boundary validator for every generated round and every
 * fallback path. Covers source validity, transform semantics, exact correct
 * transform, distinct options, required option count, hidden-source
 * semantic unambiguity, and near-duplicate rules.
 *
 * No caller may return a round that has not passed this validator.
 */
export function validateGeneratedRound(
  input: GenerateRoundDataInput,
  round: RoundData,
): ValidationResult {
  const { gridSize, side, filledCells, allowedTransforms, optionCount, prevSource } = input;
  const { source, transformType, correctPattern, options, correctOptionIndex } = round;

  // -- Side/grid sanity
  const expectedSide = Math.round(Math.sqrt(gridSize));
  if (side !== expectedSide || side * side !== gridSize) {
    return { valid: false, reason: `side ${side} does not match gridSize ${gridSize}` };
  }
  if (!Number.isInteger(gridSize) || gridSize <= 0) {
    return { valid: false, reason: `invalid gridSize ${gridSize}` };
  }
  if (!Number.isInteger(filledCells) || filledCells <= 0 || filledCells >= gridSize) {
    return { valid: false, reason: `invalid filledCells ${filledCells} for gridSize ${gridSize}` };
  }
  if (allowedTransforms.length === 0) {
    return { valid: false, reason: "allowedTransforms is empty" };
  }
  for (const t of allowedTransforms) {
    if (!ALL_TRANSFORMS.includes(t as TransformType)) {
      return { valid: false, reason: `unknown transform ${t}` };
    }
  }
  if (!Number.isInteger(optionCount) || optionCount < 2) {
    return { valid: false, reason: `invalid optionCount ${optionCount}` };
  }

  // -- Source validity
  if (!Array.isArray(source) || source.length !== filledCells) {
    return { valid: false, reason: `source length ${source?.length} != filledCells ${filledCells}` };
  }
  const seenCells = new Set<number>();
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (!Number.isInteger(c) || c < 0 || c >= gridSize) {
      return { valid: false, reason: `source cell ${c} out of bounds` };
    }
    if (seenCells.has(c)) {
      return { valid: false, reason: `source has duplicate cell ${c}` };
    }
    seenCells.add(c);
    if (i > 0 && source[i] <= source[i - 1]) {
      return { valid: false, reason: "source not sorted strictly ascending" };
    }
  }

  // -- Transform validity
  if (!allowedTransforms.includes(transformType)) {
    return { valid: false, reason: `transform ${transformType} not in allowedTransforms [${allowedTransforms.join(",")}]` };
  }
  if (isSymmetric(source, transformType, side)) {
    return { valid: false, reason: `source is symmetric under chosen transform ${transformType} (degenerate)` };
  }
  const expectedCorrect = applyTransform(source, transformType, side);
  if (!patternsEqual(correctPattern as readonly number[], expectedCorrect)) {
    return { valid: false, reason: `correctPattern does not equal transform of source under ${transformType}` };
  }
  if (patternsEqual(source, correctPattern as readonly number[])) {
    return { valid: false, reason: "correctPattern equals source (non-meaningful transform)" };
  }
  if (correctPattern.length !== filledCells) {
    return { valid: false, reason: `correctPattern length ${correctPattern.length} != filledCells ${filledCells}` };
  }

  // -- Options: count, validity, distinctness
  if (!Array.isArray(options) || options.length !== optionCount) {
    return { valid: false, reason: `options length ${options?.length} != optionCount ${optionCount}` };
  }
  if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
    return { valid: false, reason: `correctOptionIndex ${correctOptionIndex} out of bounds` };
  }
  // Each option must be valid, sorted, distinct cells, correct length
  for (let oi = 0; oi < options.length; oi += 1) {
    const opt = options[oi] as readonly number[];
    if (!Array.isArray(opt) || opt.length !== filledCells) {
      return { valid: false, reason: `option ${oi} length ${opt?.length} != filledCells ${filledCells}` };
    }
    const seen = new Set<number>();
    for (let i = 0; i < opt.length; i += 1) {
      const c = opt[i] as number;
      if (!Number.isInteger(c) || c < 0 || c >= gridSize) {
        return { valid: false, reason: `option ${oi} cell ${c} out of bounds` };
      }
      if (seen.has(c)) {
        return { valid: false, reason: `option ${oi} has duplicate cell ${c}` };
      }
      seen.add(c);
      if (i > 0 && opt[i] <= opt[i - 1]) {
        return { valid: false, reason: `option ${oi} not sorted strictly ascending` };
      }
    }
  }
  // Pairwise distinct
  for (let i = 0; i < options.length; i += 1) {
    for (let j = i + 1; j < options.length; j += 1) {
      if (patternsEqual(options[i] as readonly number[], options[j] as readonly number[])) {
        return { valid: false, reason: `options ${i} and ${j} are not distinct` };
      }
    }
  }
  // Correct option must appear exactly once and at correctOptionIndex
  let correctMatches = 0;
  for (let i = 0; i < options.length; i += 1) {
    if (patternsEqual(options[i] as readonly number[], correctPattern as readonly number[])) {
      correctMatches += 1;
    }
  }
  if (correctMatches !== 1) {
    return { valid: false, reason: `correctPattern appears ${correctMatches} times in options (expected exactly 1)` };
  }
  if (!patternsEqual(options[correctOptionIndex] as readonly number[], correctPattern as readonly number[])) {
    return { valid: false, reason: "correctOptionIndex does not point to correctPattern" };
  }

  // -- Hidden-source semantic unambiguity:
  // Exactly one option must be an exact allowed-transform outcome of source.
  // If two or more options each equal some allowed-transform result, the
  // hidden-source instruction is ambiguous (more than one defensible answer).
  const allowedResults = allowedTransforms.map((t) => applyTransform(source, t, side));
  let defensibleCount = 0;
  for (let oi = 0; oi < options.length; oi += 1) {
    const opt = options[oi] as readonly number[];
    for (const res of allowedResults) {
      if (patternsEqual(opt, res)) {
        defensibleCount += 1;
        break;
      }
    }
  }
  if (defensibleCount !== 1) {
    return {
      valid: false,
      reason: `hidden-source ambiguity: ${defensibleCount} options are exact allowed-transform outcomes (expected exactly 1)`,
    };
  }

  // -- Near-duplicate rules
  if (prevSource !== null) {
    const dist = patternDistance(source, prevSource);
    if (dist < MIN_PATTERN_DISTANCE) {
      return { valid: false, reason: `source near-duplicate: distance ${dist} < MIN_PATTERN_DISTANCE ${MIN_PATTERN_DISTANCE}` };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Internal: attempt to build one candidate (may return null to signal outer retry)
// ---------------------------------------------------------------------------

function tryBuildCandidate(
  input: GenerateRoundDataInput,
  outer: number,
): RoundData | null {
  const { rng, roundIndex, gridSize, side, filledCells, allowedTransforms, optionCount, prevSource, prevTransform } = input;

  // Derive a per-outer base rng so each outer attempt explores a different deterministic branch
  const outerRng = rng.fork(`outer:${outer}:round:${roundIndex}`);

  // ---- Step 1: source with near-duplicate + degenerate avoidance (no unverified fallback)
  let source: number[] | null = null;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateSourcePattern(
      outerRng.fork(`source-attempt:${outer}:${attempt}`),
      roundIndex,
      gridSize,
      filledCells,
    );
    const tooClose =
      prevSource !== null && patternDistance(candidate, prevSource) < MIN_PATTERN_DISTANCE;
    const degenerate = allowedTransforms.every((t) => isSymmetric(candidate, t, side));
    if (!tooClose && !degenerate) {
      source = candidate;
      break;
    }
  }
  if (source === null) {
    return null;
  }

  // ---- Step 2: pick a transform — unified path for any allowed count, no single-transform bypass
  let chosenTransform: TransformType | null = null;
  let correctPattern: number[] | null = null;

  // Try random non-symmetric picks; prefer not repeating prevTransform when possible
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const tRng = outerRng.fork(`transform:${outer}:attempt:${attempt}`);
    const idx = tRng.nextInt(allowedTransforms.length);
    const candidate = allowedTransforms[idx];
    if (isSymmetric(source, candidate, side)) {
      continue;
    }
    if (candidate === prevTransform && attempt < MAX_GENERATION_ATTEMPTS - 1) {
      // Prefer a different transform from previous round when alternative exists,
      // but do not force indefinite spinning.
      // Check if there exists at least one other non-symmetric alternative
      const hasAlternative = allowedTransforms.some(
        (t) => t !== candidate && !isSymmetric(source, t, side),
      );
      if (hasAlternative) {
        continue;
      }
    }
    chosenTransform = candidate;
    correctPattern = applyTransform(source, candidate, side);
    break;
  }
  if (chosenTransform === null || correctPattern === null) {
    // Deterministic scan for any non-symmetric transform (no degenerate fallback)
    const found = allowedTransforms.find((t) => !isSymmetric(source, t, side));
    if (found === undefined) {
      return null;
    }
    chosenTransform = found;
    correctPattern = applyTransform(source, found, side);
  }

  // ---- Step 3: distractors — must be exactly optionCount-1, distinct, non-ambiguous
  const distractors: number[][] = [];
  const seenDistractors = new Set<string>();
  // Precompute allowed results for hidden-source ambiguity filtering
  const allowedResults = allowedTransforms.map((t) => applyTransform(source, t, side));

  const tryAddDistractor = (d: number[]): boolean => {
    const key = d.join(",");
    if (seenDistractors.has(key)) return false;
    if (patternsEqual(d, correctPattern!)) return false;
    // Hidden-source filter: must NOT be any allowed-transform outcome
    if (allowedResults.some((r) => patternsEqual(d, r))) return false;
    // Also ensure not symmetric nonsense: distractor patterns are already valid by construction
    seenDistractors.add(key);
    distractors.push(d);
    return true;
  };

  let fallbackIdx = 0;
  // Use a dedicated rng for distractors; outer salt ensures determinism across outer attempts
  while (distractors.length < optionCount - 1 && fallbackIdx < DISTRACTOR_ATTEMPTS) {
    const randPattern = generateSourcePattern(
      outerRng.fork(`rand-distractor:${outer}:${fallbackIdx}`),
      roundIndex,
      gridSize,
      filledCells,
    );
    fallbackIdx += 1;
    // Skip if random pattern collides with allowed results (ambiguous) or duplicates
    tryAddDistractor(randPattern);
  }

  if (distractors.length !== optionCount - 1) {
    return null;
  }

  // ---- Step 4: combine and shuffle
  const allOptions: number[][] = [correctPattern, ...distractors];
  const shuffledOptions = outerRng.fork(`options:${outer}:round:${roundIndex}`).shuffle(allOptions);
  const correctIndex = shuffledOptions.findIndex((o) => patternsEqual(o, correctPattern!));

  if (correctIndex === -1) {
    return null;
  }

  const candidate: RoundData = {
    source,
    transformType: chosenTransform,
    correctPattern,
    options: shuffledOptions,
    correctOptionIndex: correctIndex,
  };

  // This inner candidate will be validated by the outer final validator; if
  // we already know it fails hidden-source or distance, we could fast-fail,
  // but we let the outer validator be the single source of truth.
  return candidate;
}

/**
 * Generate all data for one round: source pattern, transform, correct answer,
 * and option set (correct + distractors).
 *
 * Every returned round has passed `validateGeneratedRound`. Bounded fallbacks
 * never bypass that validator — they are outer retries that regenerate a fresh
 * deterministic candidate. If the production profile is feasible (all are),
 * this always returns within the outer budget; if not, it fails loudly
 * instead of returning a short/degenerate/ambiguous round.
 */
export function generateRoundData(input: GenerateRoundDataInput): RoundData {
  for (let outer = 0; outer < OUTER_GENERATION_ATTEMPTS; outer += 1) {
    const candidate = tryBuildCandidate(input, outer);
    if (candidate === null) {
      continue;
    }
    const result = validateGeneratedRound(input, candidate);
    if (result.valid) {
      return candidate;
    }
    // Otherwise outer retry will fork a different deterministic branch
  }
  throw new Error(
    `generateRoundData: failed to produce valid round after ${OUTER_GENERATION_ATTEMPTS} outer attempts ` +
      `(gridSize=${input.gridSize}, side=${input.side}, filledCells=${input.filledCells}, ` +
      `allowedTransforms=[${input.allowedTransforms.join(",")}], optionCount=${input.optionCount}, ` +
      `roundIndex=${input.roundIndex}) — ` +
      `profile may be infeasible; redesign profile/generation rather than returning short list`,
  );
}
