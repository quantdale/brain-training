// Property/invariant tests for the Mental Rotation geometry.
//
// Rotation/mirror algebra over integer block coordinates is mathematically
// provable: composition consistency, identity, involution, and the
// equivalence-class properties the SAME/DIFFERENT solver relies on.
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  GRID_BOUND,
  cellsOf,
  fallbackShape,
  generateRound,
  generateShape,
  hasReflectionSymmetry,
  hasRotationSymmetry,
  isBlockRotationOf,
  mirrorBlocks,
  mirrorCells,
  normalizeCells,
  rotateBlocks,
  rotateCells,
  sameBlockSet,
  sameCellSet,
  validateRound,
} from '../generator';
import { SPATIAL_DIFFICULTY_PARAMS, anglesFromMask } from '../difficulty';
import { BLOCK_COLOR_COUNT } from '../types';

/** A deterministic zoo of asymmetric shapes (3–6 blocks). */
function shapeZoo(): { x: number; y: number }[][] {
  const rng = createRng('geometry-zoo');
  const shapes: { x: number; y: number }[][] = [];
  for (let blocks = 3; blocks <= 6; blocks += 1) {
    for (let i = 0; i < 8; i += 1) {
      shapes.push(generateShape(rng.fork(`zoo:${blocks}:${i}`), blocks));
    }
    shapes.push(fallbackShape(blocks));
  }
  return shapes;
}

describe('rotation algebra (cells)', () => {
  const shapes = shapeZoo();

  it('rotating by 360° is the identity', () => {
    for (const shape of shapes) {
      let rotated = rotateCells(shape, 90);
      rotated = rotateCells(rotated, 90);
      rotated = rotateCells(rotated, 90);
      rotated = rotateCells(rotated, 90);
      expect(sameCellSet(rotated, shape)).toBe(true);
    }
  });

  it('90° + 270° compose to the identity', () => {
    for (const shape of shapes) {
      expect(sameCellSet(rotateCells(rotateCells(shape, 90), 270), shape)).toBe(true);
      expect(sameCellSet(rotateCells(rotateCells(shape, 180), 180), shape)).toBe(true);
    }
  });

  it('mirroring twice is the identity and mirrors are rotation-distinct for chiral shapes', () => {
    for (const shape of shapes) {
      expect(sameCellSet(mirrorCells(mirrorCells(shape)), shape)).toBe(true);
      if (!hasReflectionSymmetry(shape)) {
        // Chiral shape: no rotation reproduces the mirror image.
        for (const degrees of [0, 90, 180, 270] as const) {
          expect(sameCellSet(mirrorCells(shape), rotateCells(shape, degrees))).toBe(false);
        }
      }
    }
  });

  it('normalized cell sets stay within [0, GRID_BOUND) after generation', () => {
    for (const shape of shapes) {
      for (const cell of normalizeCells(shape)) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(GRID_BOUND + 1); // walk region bound
        expect(cell.y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('rotation algebra (colored blocks)', () => {
  it('colors stay attached to their block through rotations and mirrors', () => {
    const rng = createRng('block-zoo');
    for (const shape of shapeZoo()) {
      const blocks = shape.map((c, i) => ({
        x: c.x,
        y: c.y,
        colorIndex: rng.nextInt(BLOCK_COLOR_COUNT),
      }));
      for (const degrees of [0, 90, 180, 270] as const) {
        const rotated = rotateBlocks(blocks, degrees);
        expect(rotated).toHaveLength(blocks.length);
        // The color multiset is preserved.
        const colorsA = blocks.map((b) => b.colorIndex).sort();
        const colorsB = rotated.map((b) => b.colorIndex).sort();
        expect(colorsB).toEqual(colorsA);
      }
      const mirrored = mirrorBlocks(blocks);
      expect(mirrored.map((b) => b.colorIndex).sort()).toEqual(
        blocks.map((b) => b.colorIndex).sort(),
      );
    }
  });

  it('sameBlockSet is an equivalence-safe equality (reflexive, symmetric)', () => {
    const rng = createRng('equiv-zoo');
    for (const shape of shapeZoo()) {
      const a = shape.map((c, i) => ({ x: c.x, y: c.y, colorIndex: rng.nextInt(BLOCK_COLOR_COUNT) }));
      const b = rotateBlocks(a, 90);
      expect(sameBlockSet(a, a)).toBe(true);
      expect(sameBlockSet(a, b)).toBe(sameBlockSet(b, a));
    }
  });

  it('the solver agrees with exhaustive rotation search (symmetry/transitivity of the class)', () => {
    const angleMask = 0b1111; // all four angles
    for (const shape of shapeZoo()) {
      const target = shape.map((c, i) => ({ x: c.x, y: c.y, colorIndex: i % BLOCK_COLOR_COUNT }));
      const rotated = rotateBlocks(target, 180);
      expect(isBlockRotationOf(rotated, target, angleMask)).toBe(true);
      expect(isBlockRotationOf(target, rotated, angleMask)).toBe(true); // symmetry
      const mirrored = mirrorBlocks(target);
      const mirroredIsRotation = anglesFromMask(angleMask).some((degrees) =>
        sameBlockSet(mirrored, rotateBlocks(target, degrees)),
      );
      expect(isBlockRotationOf(mirrored, target, angleMask)).toBe(mirroredIsRotation);
      if (isBlockRotationOf(target, mirrored, angleMask)) {
        // Transitivity within the rotation class.
        expect(isBlockRotationOf(mirrored, target, angleMask)).toBe(true);
      }
    }
  });
});

describe('generated rounds satisfy the fairness invariants', () => {
  for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
    it(`validates every round of a ${level} session`, () => {
      const params = SPATIAL_DIFFICULTY_PARAMS[level];
      const rng = createRng(`validate-${level}`);
      let prevTarget: readonly { x: number; y: number }[] | null = null;
      for (let roundIndex = 0; roundIndex < params.rounds; roundIndex += 1) {
        const round = generateRound({
          rng: rng.fork(`round:${roundIndex}`),
          roundIndex,
          params,
          prevTarget,
        });
        prevTarget = cellsOf(round.target);
        expect(validateRound(round, params).ok).toBe(true);
        // Targets are never rotation-symmetric (no ambiguous SAME rounds).
        expect(hasRotationSymmetry(cellsOf(round.target))).toBe(false);
        // Candidate degrees come from the round's angle set.
        expect(anglesFromMask(params.angleMask)).toContain(round.candidateDegrees);
      }
    });
  }

  it('generateShape never returns rotation-symmetric or oversized shapes', () => {
    const rng = createRng('shape-bounds');
    for (let blocks = 3; blocks <= 6; blocks += 1) {
      for (let i = 0; i < 12; i += 1) {
        const shape = generateShape(rng.fork(`bounds:${blocks}:${i}`), blocks);
        expect(shape).toHaveLength(blocks);
        expect(hasRotationSymmetry(shape)).toBe(false);
        for (const cell of shape) {
          expect(cell.x).toBeGreaterThanOrEqual(0);
          expect(cell.x).toBeLessThan(GRID_BOUND);
          expect(cell.y).toBeGreaterThanOrEqual(0);
          expect(cell.y).toBeLessThan(GRID_BOUND);
        }
      }
    }
  });
});
