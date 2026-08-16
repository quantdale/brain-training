// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { SPATIAL_DIFFICULTY_PARAMS } from '../difficulty';
import {
  GRID_BOUND,
  MAX_ROUND_ATTEMPTS,
  MAX_SHAPE_ATTEMPTS,
  alterBlocks,
  cellsOf,
  fallbackShape,
  generateRound,
  generateShape,
  hasReflectionSymmetry,
  hasRotationSymmetry,
  isAmbiguous,
  isBlockRotationOf,
  isWellFormed,
  mirrorBlocks,
  mirrorCells,
  normalizeBlocks,
  normalizeCells,
  rotateBlocks,
  rotateCells,
  sameBlockSet,
  sameCellSet,
  solveRound,
  validateRound,
} from '../generator';
import type { RotationRound } from '../generator';
import { anglesFromMask } from '../difficulty';
import type { Block, Cell } from '../types';

/** Full deterministic session for one seed/level, chaining near-dup avoidance. */
function sessionRounds(seed: string, level: keyof typeof SPATIAL_DIFFICULTY_PARAMS): RotationRound[] {
  const params = SPATIAL_DIFFICULTY_PARAMS[level];
  const rng = createRng(seed);
  const rounds: RotationRound[] = [];
  let prev: readonly Block[] | null = null;
  for (let index = 0; index < params.rounds; index += 1) {
    const round = generateRound({ rng, roundIndex: index, params, prevTarget: prev });
    rounds.push(round);
    prev = round.target;
  }
  return rounds;
}

describe('geometry primitives', () => {
  it('normalizes cell sets to the origin and sorts them', () => {
    expect(normalizeCells([{ x: 3, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 6 }])).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ]);
  });

  it('compares sets irrespective of placement', () => {
    expect(sameCellSet([{ x: 1, y: 0 }, { x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(true);
    expect(sameCellSet([{ x: 1, y: 0 }, { x: 0, y: 0 }], [{ x: 0, y: 0 }])).toBe(false);
    // A single cell is the same shape wherever it sits (translation invariance).
    expect(sameCellSet([{ x: 5, y: 7 }], [{ x: 0, y: 0 }])).toBe(true);
  });

  it('rotates integer coordinates: 4×90° is the identity, 2×90° equals 180°', () => {
    const cells: Cell[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    expect(sameCellSet(rotateCells(rotateCells(rotateCells(rotateCells(cells, 90), 90), 90), 90), cells)).toBe(true);
    expect(sameCellSet(rotateCells(rotateCells(cells, 90), 90), rotateCells(cells, 180))).toBe(true);
    // The asymmetric corner differs from its own 270° rotation.
    expect(sameCellSet(rotateCells(cells, 270), rotateCells(cells, 90))).toBe(false);
    expect(sameCellSet(rotateCells(cells, 0), cells)).toBe(true);
  });

  it('mirrors twice back to the original', () => {
    const cells: Cell[] = [{ x: 2, y: 1 }, { x: 0, y: 0 }];
    expect(sameCellSet(mirrorCells(mirrorCells(cells)), cells)).toBe(true);
    // The mirror of an asymmetric shape is not a rotation of it.
    expect(isBlockRotationOf(mirrorBlocks([{ x: 0, y: 0, colorIndex: 0 }, { x: 1, y: 0, colorIndex: 1 }, { x: 1, y: 1, colorIndex: 2 }]), [{ x: 0, y: 0, colorIndex: 0 }, { x: 1, y: 0, colorIndex: 1 }, { x: 1, y: 1, colorIndex: 2 }], 15)).toBe(false);
  });

  it('detects rotation symmetry', () => {
    const square: Cell[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
    expect(hasRotationSymmetry(square)).toBe(true);
    expect(isAmbiguous(square)).toBe(true);
  });

  it('detects reflection symmetry (including the diagonal case)', () => {
    // L-tromino is symmetric across the diagonal y = x — its mirror is a rotation.
    const lTromino: Cell[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    expect(hasReflectionSymmetry(lTromino)).toBe(true);
    expect(hasRotationSymmetry(lTromino)).toBe(false);
    expect(isAmbiguous(lTromino)).toBe(true);
    // T-tetromino is symmetric across its vertical axis.
    const tTetromino: Cell[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }];
    expect(hasReflectionSymmetry(tTetromino)).toBe(true);
  });

  it('validates block structure', () => {
    const good: Block[] = [{ x: 0, y: 0, colorIndex: 0 }, { x: 1, y: 0, colorIndex: 3 }];
    expect(isWellFormed(good)).toBe(true);
    expect(isWellFormed([])).toBe(false);
    expect(isWellFormed([{ x: 0, y: 0, colorIndex: 0 }, { x: 0, y: 0, colorIndex: 1 }])).toBe(false); // duplicate
    expect(isWellFormed([{ x: 0, y: 0, colorIndex: 4 }])).toBe(false); // color out of range
    expect(isWellFormed([{ x: 0.5, y: 0, colorIndex: 0 }])).toBe(false); // non-integer
  });

  it('normalizes block sets and preserves colors under rotation/mirror', () => {
    const blocks: Block[] = [{ x: 3, y: 2, colorIndex: 1 }, { x: 4, y: 2, colorIndex: 2 }];
    const rotated = rotateBlocks(blocks, 90);
    expect(rotated).toHaveLength(2);
    expect(rotated.map((b) => b.colorIndex).sort()).toEqual([1, 2]);
    expect(sameBlockSet(blocks, normalizeBlocks(blocks))).toBe(true);
    const mirrored = mirrorBlocks(blocks);
    expect(mirrored.map((b) => b.colorIndex).sort()).toEqual([1, 2]);
  });

  it('alter changes exactly one block color', () => {
    const blocks: Block[] = [
      { x: 0, y: 0, colorIndex: 0 },
      { x: 1, y: 0, colorIndex: 1 },
      { x: 1, y: 1, colorIndex: 2 },
      { x: 0, y: 1, colorIndex: 3 },
    ];
    const altered = alterBlocks(blocks, createRng('alter-1'));
    let changed = 0;
    for (let i = 0; i < blocks.length; i += 1) {
      if (altered[i].colorIndex !== blocks[i].colorIndex) {
        changed += 1;
      }
    }
    expect(changed).toBe(1);
    // The altered color is always different from the original.
    expect(sameBlockSet(altered, blocks)).toBe(false);
  });
});

describe('fallbackShape (deterministic asymmetry template)', () => {
  it('produces rotation-asymmetric, correctly-sized shapes for every block count', () => {
    for (let count = 3; count <= 6; count += 1) {
      const shape = fallbackShape(count);
      expect(shape).toHaveLength(count);
      expect(hasRotationSymmetry(shape)).toBe(false);
      expect(new Set(shape.map((c) => `${c.x},${c.y}`)).size).toBe(count);
    }
    // 4–6 block templates are fully asymmetric; the 3-block corner is the
    // (always reflection-symmetric) triomino — still a valid target because
    // its DIFFERENT rounds are mutate-only.
    for (let count = 4; count <= 6; count += 1) {
      expect(hasReflectionSymmetry(fallbackShape(count))).toBe(false);
    }
    expect(hasReflectionSymmetry(fallbackShape(3))).toBe(true);
  });

  it('rejects unsupported block counts', () => {
    expect(() => fallbackShape(2)).toThrow(RangeError);
    expect(() => fallbackShape(7)).toThrow(RangeError);
  });
});

describe('generateShape', () => {
  it('is deterministic: same seed reproduces the same shape', () => {
    expect(generateShape(createRng('shape-det'), 4)).toEqual(generateShape(createRng('shape-det'), 4));
    expect(generateShape(createRng('shape-a'), 5)).not.toEqual(generateShape(createRng('shape-b'), 5));
  });

  it('yields connected, rotation-asymmetric shapes of the right size within bounds', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      for (const count of [3, 4, 5, 6]) {
        const shape = generateShape(createRng(String(seed)), count);
        expect(shape).toHaveLength(count);
        expect(hasRotationSymmetry(shape)).toBe(false);
        for (const c of shape) {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeLessThan(GRID_BOUND);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeLessThan(GRID_BOUND);
        }
      }
    }
  });

  it('avoids an exact previous target', () => {
    const prev = generateShape(createRng('avoid-prev'), 4);
    const next = generateShape(createRng('avoid-next'), 4, prev);
    expect(sameCellSet(next, prev)).toBe(false);
    // Deterministic fallback never collides either.
    const fallback = fallbackShape(4);
    const avoided = generateShape(createRng('whatever'), 4, fallback);
    expect(sameCellSet(avoided, fallback)).toBe(false);
  });

  it('bounded: generation always terminates deterministically', () => {
    expect(MAX_SHAPE_ATTEMPTS).toBeGreaterThan(0);
    expect(MAX_ROUND_ATTEMPTS).toBeGreaterThan(0);
    const shape = generateShape(createRng('budget'), 6);
    expect(shape).toHaveLength(6);
  });
});

describe('generateRound (per-round invariants over many seeds and levels)', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(sessionRounds('seed-42', 'normal')).toEqual(sessionRounds('seed-42', 'normal'));
  });

  it('produces different sessions for different seeds', () => {
    const a = sessionRounds('seed-a', 'normal');
    const b = sessionRounds('seed-b', 'normal');
    expect(a[0].target).not.toEqual(b[0].target);
  });

  it('validates every round across seeds and levels (solver agreement, ambiguity, distinctness)', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = SPATIAL_DIFFICULTY_PARAMS[level];
      for (let seed = 1; seed <= 50; seed += 1) {
        const rounds = sessionRounds(String(seed), level);
        for (const round of rounds) {
          const validation = validateRound(round, params);
          expect({ ok: validation.ok, reason: validation.reason }).toEqual({ ok: true, reason: null });
        }
      }
    }
  });

  it('keeps consecutive targets distinct (near-duplicate avoidance)', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      for (let seed = 1; seed <= 50; seed += 1) {
        const rounds = sessionRounds(String(seed), level);
        for (let i = 1; i < rounds.length; i += 1) {
          expect(sameCellSet(cellsOf(rounds[i].target), cellsOf(rounds[i - 1].target))).toBe(false);
        }
      }
    }
  });

  it('SAME rounds: the candidate is exactly the target rotated by the round degrees', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const round of sessionRounds(String(seed), 'normal')) {
        if (round.kind === 'same') {
          expect(round.transform).toBe('rotate');
          expect(
            sameBlockSet(round.candidate, rotateBlocks(round.target, round.candidateDegrees)),
          ).toBe(true);
          if (round.candidateDegrees !== 0) {
            expect(sameBlockSet(round.candidate, round.target)).toBe(false);
          }
        }
      }
    }
  });

  it('DIFFERENT rounds: the candidate is never a rotation of the target, and never equal', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const round of sessionRounds(String(seed), 'hard')) {
        if (round.kind === 'different') {
          expect(round.transform === 'mirror' || round.transform === 'alter').toBe(true);
          expect(sameBlockSet(round.candidate, round.target)).toBe(false);
          expect(solveRound(round.candidate, round.target, 15)).toBe('different');
          expect(
            isBlockRotationOf(round.candidate, round.target, SPATIAL_DIFFICULTY_PARAMS.hard.angleMask),
          ).toBe(false);
        }
      }
    }
  });

  it('easy DIFFERENT rounds are mutate-only (every 3-block target is reflection-symmetric)', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const round of sessionRounds(String(seed), 'easy')) {
        // Connected triominoes are all reflection-symmetric (corner) or
        // rotation-symmetric (straight, rejected), so every accepted target
        // here must be chiral-excluded and mirrors must be skipped.
        expect(hasReflectionSymmetry(cellsOf(round.target))).toBe(true);
        if (round.kind === 'different') {
          expect(round.transform).toBe('alter');
        }
      }
    }
  });

  it('mirror candidates appear only for chiral targets and are never rotations', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const round of sessionRounds(String(seed), 'hard')) {
        if (round.transform === 'mirror') {
          expect(hasReflectionSymmetry(cellsOf(round.target))).toBe(false);
          expect(isBlockRotationOf(round.candidate, round.target, 15)).toBe(false);
        }
      }
    }
  });

  it('easy rounds may use the trivial 0° rotation; SAME at 0° equals the target', () => {
    const params = SPATIAL_DIFFICULTY_PARAMS.easy;
    let sawZeroDegrees = false;
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const round of sessionRounds(String(seed), 'easy')) {
        expect(anglesFromMask(params.angleMask)).toContain(round.candidateDegrees);
        if (round.candidateDegrees === 0) {
          sawZeroDegrees = true;
          if (round.kind === 'same') {
            expect(sameBlockSet(round.candidate, round.target)).toBe(true);
          }
        }
      }
    }
    expect(sawZeroDegrees).toBe(true);
  });

  it('blocks are well-formed with correct counts and in-range colors', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
        const params = SPATIAL_DIFFICULTY_PARAMS[level];
        for (const round of sessionRounds(String(seed), level)) {
          expect(isWellFormed(round.target)).toBe(true);
          expect(isWellFormed(round.candidate)).toBe(true);
          expect(round.target).toHaveLength(params.blocks);
          expect(round.candidate).toHaveLength(params.blocks);
        }
      }
    }
  });
});

describe('solveRound', () => {
  it('solves a constructed SAME round as same', () => {
    let round: RotationRound | null = null;
    for (let attempt = 0; attempt < 20 && round === null; attempt += 1) {
      const candidate = generateRound({
        rng: createRng('solve-same').fork(String(attempt)),
        roundIndex: 0,
        params: SPATIAL_DIFFICULTY_PARAMS.normal,
        prevTarget: null,
      });
      if (candidate.kind === 'same') {
        round = candidate;
      }
    }
    expect(round).not.toBeNull();
    if (round !== null) {
      expect(
        solveRound(round.candidate, round.target, SPATIAL_DIFFICULTY_PARAMS.normal.angleMask),
      ).toBe('same');
    }
  });

  it('solves a color-mutated candidate as different even with a matching outline', () => {
    const blocks: Block[] = [
      { x: 0, y: 0, colorIndex: 0 },
      { x: 1, y: 0, colorIndex: 1 },
      { x: 1, y: 1, colorIndex: 2 },
    ];
    const altered = alterBlocks(blocks, createRng('solve-alter'));
    expect(solveRound(altered, blocks, 15)).toBe('different');
  });
});
