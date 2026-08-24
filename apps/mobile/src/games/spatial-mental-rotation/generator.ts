/**
 * Deterministic shape generation + solver/validation for the Mental Rotation
 * game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Every step below is a pure
 * function of the seeded RNG.
 *
 * Shape model: a shape is a normalized set of integer block coordinates
 * (min x = 0, min y = 0) plus a palette index per block. Colors rotate and
 * mirror with the shape, so the puzzle is about the colored arrangement.
 *
 * Unambiguity invariants (the generator's contract):
 *
 *  1. A target must have NO rotation symmetry — a rotated copy would look
 *     identical, making the round ambiguous. Shapes failing this check are
 *     re-drawn (bounded, deterministic attempts; a verified deterministic
 *     fallback shape keeps the generator total).
 *
 *  2. SAME candidates are produced by literally rotating the target's blocks
 *     (coordinate rotation of integer positions, colors preserved). For a
 *     nonzero rotation the rotated set is guaranteed visually distinct from
 *     the original by invariant 1.
 *
 *  3. DIFFERENT candidates come from mirroring or mutating (one block's color
 *     swapped) the target, then rotating. A MIRRORED candidate is only valid
 *     for reflection-asymmetric (chiral) targets: for a reflection-symmetric
 *     shape the mirror image is a rotation of the original, which would make
 *     the round indistinguishable from SAME. A MUTATED candidate keeps the
 *     target's position set, so by invariant 1 it is never a rotation of the
 *     target (a rotation could only coincide if the position set mapped onto
 *     itself); mutation is therefore valid for every rotation-asymmetric
 *     target — including 3-block triominoes, which are always
 *     reflection-symmetric. `validateRound` asserts all of this per round.
 *
 * Note on 2D chirality: a shape's mirror is a rotation of the shape exactly
 * when the shape is symmetric under one of the four grid reflections
 * (vertical, horizontal, or a diagonal), so `hasReflectionSymmetry` gates
 * mirror candidates precisely.
 */
import type { Rng } from '@/sdk';

import { anglesFromMask } from './difficulty';
import { BLOCK_COLOR_COUNT } from './types';
import type { Block, Cell, RotationDegrees, RoundKind, SpatialDifficultyParams } from './types';

/** Random-walk region: shapes are grown inside [0, GRID_BOUND)². */
export const GRID_BOUND = 6;

/** Upper bound on shape re-draw attempts before the deterministic fallback. */
export const MAX_SHAPE_ATTEMPTS = 40;

/** Upper bound on inner walk steps per attempt (guards pathological draws). */
export const MAX_WALK_STEPS = 64;

/** Upper bound on whole-round re-draw attempts (never reached in practice). */
export const MAX_ROUND_ATTEMPTS = 8;

export interface GenerateRoundInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly params: SpatialDifficultyParams;
  /** Previous round's target cells, or null for round 0 (near-duplicate avoidance). */
  readonly prevTarget?: readonly Cell[] | null;
}

export interface RotationRound {
  readonly roundIndex: number;
  /** Target shape (canonical orientation, normalized coordinates). */
  readonly target: readonly Block[];
  /** Candidate shape (already rotated/mirrored/altered, normalized coordinates). */
  readonly candidate: readonly Block[];
  /** The correct answer a player must give. */
  readonly kind: RoundKind;
  /** How the candidate was produced ('rotate' implies SAME). */
  readonly transform: 'rotate' | 'mirror' | 'alter';
  /** Display rotation applied to the candidate (from the round's angle set). */
  readonly candidateDegrees: RotationDegrees;
}

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

const DIRS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Position-only view of a shape. */
export function cellsOf(blocks: readonly Block[]): Cell[] {
  return blocks.map((b) => ({ x: b.x, y: b.y }));
}

/**
 * Shift a cell set so min x = 0 and min y = 0, then sort deterministically.
 * The canonical form makes equality checks independent of placement.
 */
export function normalizeCells(cells: readonly Cell[]): Cell[] {
  if (cells.length === 0) {
    return [];
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
  }
  return cells
    .map((c) => ({ x: c.x - minX, y: c.y - minY }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
}

/** Same-shape check on normalized cell sets (position only). */
export function sameCellSet(a: readonly Cell[], b: readonly Cell[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const na = normalizeCells(a);
  const nb = normalizeCells(b);
  for (let i = 0; i < na.length; i += 1) {
    if (na[i].x !== nb[i].x || na[i].y !== nb[i].y) {
      return false;
    }
  }
  return true;
}

/**
 * Rotate integer block positions by `degrees` clockwise around the origin and
 * re-normalize. Only multiples of 90° are valid (block grids).
 */
export function rotateCells(cells: readonly Cell[], degrees: RotationDegrees): Cell[] {
  const rotated = cells.map((c) => {
    switch (degrees) {
      case 0:
        return { x: c.x, y: c.y };
      case 90:
        return { x: c.y, y: -c.x };
      case 180:
        return { x: -c.x, y: -c.y };
      case 270:
        return { x: -c.y, y: c.x };
    }
  });
  return normalizeCells(rotated);
}

/** Mirror a cell set across the vertical axis and re-normalize. */
export function mirrorCells(cells: readonly Cell[]): Cell[] {
  return normalizeCells(cells.map((c) => ({ x: -c.x, y: c.y })));
}

/**
 * True when `a` (normalized) has any nontrivial rotation symmetry — a rotated
 * copy that is identical to the original. Such shapes make SAME rounds
 * ambiguous, so they are rejected.
 */
export function hasRotationSymmetry(cells: readonly Cell[]): boolean {
  return (
    sameCellSet(cells, rotateCells(cells, 90)) ||
    sameCellSet(cells, rotateCells(cells, 180)) ||
    sameCellSet(cells, rotateCells(cells, 270))
  );
}

/**
 * True when `a` is symmetric under any of the four grid reflections
 * (vertical, horizontal, and both diagonals). For such shapes the mirror
 * image is a rotation of the original, so mirrored DIFFERENT candidates are
 * only valid for shapes where this returns false. It does NOT reject shapes
 * by itself — 3-block triominoes are always reflection-symmetric yet make
 * valid targets with mutate-only DIFFERENT rounds.
 */
export function hasReflectionSymmetry(cells: readonly Cell[]): boolean {
  const transforms: readonly ((c: Cell) => Cell)[] = [
    (c) => ({ x: -c.x, y: c.y }), // vertical
    (c) => ({ x: c.x, y: -c.y }), // horizontal
    (c) => ({ x: c.y, y: c.x }), // diagonal y = x
    (c) => ({ x: -c.y, y: -c.x }), // anti-diagonal y = -x
  ];
  for (const t of transforms) {
    if (sameCellSet(cells, normalizeCells(cells.map(t)))) {
      return true;
    }
  }
  return false;
}

/** True when the shape would make a rotation-ambiguous puzzle (see module docs). */
export function isAmbiguous(cells: readonly Cell[]): boolean {
  return hasRotationSymmetry(cells) || hasReflectionSymmetry(cells);
}

/** Structural validity of a block set: positive count, distinct cells, valid colors. */
export function isWellFormed(blocks: readonly Block[]): boolean {
  if (blocks.length === 0) {
    return false;
  }
  const seen = new Set<string>();
  for (const b of blocks) {
    if (!Number.isInteger(b.x) || !Number.isInteger(b.y)) {
      return false;
    }
    if (!Number.isInteger(b.colorIndex) || b.colorIndex < 0 || b.colorIndex >= BLOCK_COLOR_COUNT) {
      return false;
    }
    const key = `${b.x},${b.y}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Block transforms (colors rotate/mirror with the shape)
// ---------------------------------------------------------------------------

/** Shift a block set to the origin and sort deterministically. */
export function normalizeBlocks(blocks: readonly Block[]): Block[] {
  if (blocks.length === 0) {
    return [];
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const b of blocks) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
  }
  return blocks
    .map((b) => ({ x: b.x - minX, y: b.y - minY, colorIndex: b.colorIndex }))
    .sort((a, b) => a.x - b.x || a.y - b.y || a.colorIndex - b.colorIndex);
}

/** Same-shape check on normalized block sets (position AND color). */
export function sameBlockSet(a: readonly Block[], b: readonly Block[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const na = normalizeBlocks(a);
  const nb = normalizeBlocks(b);
  for (let i = 0; i < na.length; i += 1) {
    if (na[i].x !== nb[i].x || na[i].y !== nb[i].y || na[i].colorIndex !== nb[i].colorIndex) {
      return false;
    }
  }
  return true;
}

/** Rotate a block set by `degrees` (positions rotate, colors stay attached). */
export function rotateBlocks(blocks: readonly Block[], degrees: RotationDegrees): Block[] {
  const rotated = blocks.map((b) => {
    switch (degrees) {
      case 0:
        return { x: b.x, y: b.y, colorIndex: b.colorIndex };
      case 90:
        return { x: b.y, y: -b.x, colorIndex: b.colorIndex };
      case 180:
        return { x: -b.x, y: -b.y, colorIndex: b.colorIndex };
      case 270:
        return { x: -b.y, y: b.x, colorIndex: b.colorIndex };
    }
  });
  return normalizeBlocks(rotated);
}

/** Mirror a block set (positions mirror, colors stay attached). */
export function mirrorBlocks(blocks: readonly Block[]): Block[] {
  return normalizeBlocks(blocks.map((b) => ({ x: -b.x, y: b.y, colorIndex: b.colorIndex })));
}

/**
 * Mutate a block set: exactly one block's color changes to a different
 * palette color. Positions are unchanged, so by the rotation-asymmetry
 * invariant the result is never a rotation of the original.
 */
export function alterBlocks(blocks: readonly Block[], rng: Rng): Block[] {
  const index = rng.nextInt(blocks.length);
  const current = blocks[index].colorIndex;
  // A nonzero offset mod BLOCK_COLOR_COUNT guarantees a different color.
  const next = (current + 1 + rng.nextInt(BLOCK_COLOR_COUNT - 1)) % BLOCK_COLOR_COUNT;
  return blocks.map((b, i) => (i === index ? { ...b, colorIndex: next } : b));
}

// ---------------------------------------------------------------------------
// Shape generation
// ---------------------------------------------------------------------------

/**
 * Deterministic fallback shapes, verified asymmetric for every supported
 * block count (asserted by the generator tests): a 3-block corner and
 * L-shapes with unequal arms for 4–6 blocks.
 */
export function fallbackShape(blockCount: number): Cell[] {
  if (blockCount < 3 || blockCount > 6) {
    throw new RangeError(`blockCount must be in [3, 6], got ${blockCount}`);
  }
  if (blockCount === 3) {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
  }
  const arm = blockCount - 2; // horizontal arm length (≥ 2)
  const cells: Cell[] = [{ x: 0, y: 0 }];
  for (let i = 1; i <= arm; i += 1) {
    cells.push({ x: i, y: 0 });
  }
  cells.push({ x: arm, y: 1 });
  return cells;
}

/**
 * Grow a connected, rotation-asymmetric shape by random walk with bounded
 * rejection sampling: each attempt draws from its own RNG fork, so the same
 * seed always yields the same shape. Reflection symmetry is allowed (mutated
 * DIFFERENT rounds stay valid); `prevTarget` (optional) is avoided exactly.
 */
export function generateShape(
  rng: Rng,
  blockCount: number,
  prevTarget?: readonly Cell[] | null,
): Cell[] {
  for (let attempt = 0; attempt < MAX_SHAPE_ATTEMPTS; attempt += 1) {
    const attemptRng = rng.fork(`shape:attempt:${attempt}`);
    const cells: Cell[] = [
      {
        x: attemptRng.nextIntRange(0, GRID_BOUND),
        y: attemptRng.nextIntRange(0, GRID_BOUND),
      },
    ];
    let steps = 0;
    while (cells.length < blockCount && steps < MAX_WALK_STEPS) {
      steps += 1;
      const anchor = attemptRng.pick(cells);
      const dir = attemptRng.pick(DIRS);
      const neighbor = { x: anchor.x + dir.x, y: anchor.y + dir.y };
      if (
        neighbor.x < 0 ||
        neighbor.x >= GRID_BOUND ||
        neighbor.y < 0 ||
        neighbor.y >= GRID_BOUND ||
        cells.some((c) => c.x === neighbor.x && c.y === neighbor.y)
      ) {
        continue;
      }
      cells.push(neighbor);
    }
    if (cells.length !== blockCount || hasRotationSymmetry(cells)) {
      continue;
    }
    if (prevTarget !== null && prevTarget !== undefined && sameCellSet(cells, prevTarget)) {
      continue;
    }
    return cells;
  }
  // Extremely unlikely fallback: a verified asymmetric template. If it
  // collides with the previous target, rotate it by 90° — the asymmetry
  // invariant guarantees the rotated template differs from the original.
  const fallback = fallbackShape(blockCount);
  if (prevTarget !== null && prevTarget !== undefined && sameCellSet(fallback, prevTarget)) {
    return rotateCells(fallback, 90);
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

/**
 * The solver: does the candidate equal the target rotated by any angle in the
 * round's angle set? Colors are part of the identity, so a color-mutated
 * candidate correctly answers 'different' even though its outline matches.
 */
export function isBlockRotationOf(
  candidate: readonly Block[],
  target: readonly Block[],
  angleMask: number,
): boolean {
  const angles = anglesFromMask(angleMask);
  return angles.some((degrees) => sameBlockSet(candidate, rotateBlocks(target, degrees)));
}

/** Solved answer for a round: 'same' iff the candidate is a rotation of the target. */
export function solveRound(
  candidate: readonly Block[],
  target: readonly Block[],
  angleMask: number,
): RoundKind {
  return isBlockRotationOf(candidate, target, angleMask) ? 'same' : 'different';
}

// ---------------------------------------------------------------------------
// Round generation + validation
// ---------------------------------------------------------------------------

export interface RoundValidation {
  readonly ok: boolean;
  readonly reason: string | null;
}

/**
 * Assert every invariant a fair round needs (see module docs). Used as the
 * generation safety net and as the oracle for the generator tests:
 *
 *  - both shapes well-formed with exactly `params.blocks` blocks;
 *  - the target has no rotation symmetry (rotation-ambiguity check);
 *  - the candidate rotation is in the round's angle set;
 *  - SAME: the candidate is exactly the target rotated by the round's
 *    degrees, and visually distinct from the original when rotated non-zero;
 *  - DIFFERENT: mirrored candidates only on chiral targets, the candidate is
 *    not equal to the target, and the solver (rotation search over the round's
 *    angle set, colors included) disagrees with SAME.
 */
export function validateRound(
  round: RotationRound,
  params: SpatialDifficultyParams,
): RoundValidation {
  const { target, candidate, kind, candidateDegrees, transform } = round;
  if (!isWellFormed(target)) {
    return { ok: false, reason: 'target is not well-formed' };
  }
  if (!isWellFormed(candidate)) {
    return { ok: false, reason: 'candidate is not well-formed' };
  }
  if (target.length !== params.blocks || candidate.length !== params.blocks) {
    return {
      ok: false,
      reason: `block count mismatch (expected ${params.blocks})`,
    };
  }
  if (hasRotationSymmetry(cellsOf(target))) {
    return { ok: false, reason: 'target has rotation symmetry (rotation-ambiguous)' };
  }
  const allowed = anglesFromMask(params.angleMask);
  if (!allowed.includes(candidateDegrees)) {
    return { ok: false, reason: `degrees ${candidateDegrees} not in the allowed angle set` };
  }
  if (kind === 'same') {
    if (!sameBlockSet(candidate, rotateBlocks(target, candidateDegrees))) {
      return { ok: false, reason: 'same round: candidate is not the target rotated by the round degrees' };
    }
    if (candidateDegrees !== 0 && sameBlockSet(candidate, target)) {
      return { ok: false, reason: 'same round: rotated candidate is not visually distinct' };
    }
    if (transform !== 'rotate') {
      return { ok: false, reason: 'same round: transform must be rotate' };
    }
  } else {
    if (transform === 'rotate') {
      return { ok: false, reason: 'different round: transform must be mirror or alter' };
    }
    if (transform === 'mirror' && hasReflectionSymmetry(cellsOf(target))) {
      return { ok: false, reason: 'different round: mirror candidate on a reflection-symmetric target' };
    }
    if (sameBlockSet(candidate, target)) {
      return { ok: false, reason: 'different round: candidate equals the target' };
    }
    if (isBlockRotationOf(candidate, target, params.angleMask)) {
      return { ok: false, reason: 'different round: candidate is a rotation of the target (ambiguous)' };
    }
  }
  const solved = solveRound(candidate, target, params.angleMask);
  if (solved !== kind) {
    return { ok: false, reason: `solver disagrees with round kind (${solved} vs ${kind})` };
  }
  return { ok: true, reason: null };
}

/**
 * Deterministic round generation: kind, shape, rotation angle, colors, and
 * the DIFFERENT transform all come from seeded forks of the round's RNG.
 * Near-duplicate avoidance rejects a target identical to the previous
 * round's target. Rounds are validated before acceptance (see
 * `validateRound`); by the invariants above this always passes on the first
 * attempt, and the bounded loop keeps the generator total regardless.
 */
export function generateRound(input: GenerateRoundInput): RotationRound {
  const { rng, roundIndex, params, prevTarget } = input;
  let last: RotationRound | null = null;
  for (let attempt = 0; attempt < MAX_ROUND_ATTEMPTS; attempt += 1) {
    const attemptRng = rng.fork(`round:${roundIndex}:attempt:${attempt}`);
    const kind: RoundKind = attemptRng.next() < 0.5 ? 'same' : 'different';
    const cells = generateShape(attemptRng.fork('shape'), params.blocks, prevTarget);
    const candidateDegrees = attemptRng
      .fork('angle')
      .pick(anglesFromMask(params.angleMask));
    const target: Block[] = cells.map((c, i) => ({
      x: c.x,
      y: c.y,
      colorIndex: attemptRng.fork(`color:${i}`).nextInt(BLOCK_COLOR_COUNT),
    }));
    let candidate: Block[];
    let transform: RotationRound['transform'];
    if (kind === 'same') {
      candidate = rotateBlocks(target, candidateDegrees);
      transform = 'rotate';
    } else {
      // Mirrors are only valid for chiral (reflection-asymmetric) targets;
      // for symmetric targets (e.g. all 3-block triominoes) mutation only.
      const chiral = !hasReflectionSymmetry(cells);
      const useMirror = chiral && attemptRng.fork('distort').next() < 0.5;
      const base = useMirror
        ? mirrorBlocks(target)
        : alterBlocks(target, attemptRng.fork('alter'));
      transform = useMirror ? 'mirror' : 'alter';
      candidate = rotateBlocks(base, candidateDegrees);
    }
    const round: RotationRound = {
      roundIndex,
      target,
      candidate,
      kind,
      transform,
      candidateDegrees,
    };
    last = round;
    if (validateRound(round, params).ok) {
      return round;
    }
  }
  // Unreachable in practice (invariants guarantee validity); kept for totality.
  /* istanbul ignore next */
  return last as RotationRound;
}
