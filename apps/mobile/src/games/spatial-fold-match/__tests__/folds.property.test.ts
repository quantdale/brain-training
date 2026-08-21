// Property/invariant tests for the Fold Match fold algebra.
//
// The paper-fold merge is provable: result dimensions are ceil(half), VH
// composes V then H, and the OR-merge semantics match a brute-force
// reference implementation. The generator's validateRound contract is
// asserted across many seeded sessions.
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  applyFold,
  applyFoldBaseOnly,
  applyFoldXor,
  generateRoundData,
  gridsEqual,
  gridDistance,
  makeEmptyGrid,
  validateRound,
} from '../generator';
import { resolveSpatialFoldMatchDifficulty, spatialFoldMatchParamsFromProfile } from '../difficulty';
import type { FoldType } from '../types';

function paramsForLevel(level: 'easy' | 'normal' | 'hard' | 'expert') {
  return spatialFoldMatchParamsFromProfile(resolveSpatialFoldMatchDifficulty(level));
}

/** Brute-force reference: fold left-over-right with an arbitrary merge. */
function referenceFoldV(
  grid: readonly (readonly boolean[])[],
  merge: (a: boolean, b: boolean) => boolean,
): boolean[][] {
  const rows = grid.length;
  const cols = grid[0].length;
  const rightStart = Math.floor(cols / 2);
  const newCols = Math.ceil(cols / 2);
  const out: boolean[][] = Array.from({ length: rows }, () => Array.from({ length: newCols }, () => false));
  for (let r = 0; r < rows; r += 1) {
    for (let j = 0; j < newCols; j += 1) {
      out[r][j] = grid[r][rightStart + j];
    }
    for (let c = 0; c < rightStart; c += 1) {
      const target = cols - 1 - c - rightStart;
      out[r][target] = merge(out[r][target], grid[r][c]);
    }
  }
  return out;
}

describe('fold algebra', () => {
  const or = (a: boolean, b: boolean): boolean => a || b;

  it('foldV matches the brute-force OR reference on random grids', () => {
    const rng = createRng('foldv-ref');
    for (let trial = 0; trial < 30; trial += 1) {
      const rows = rng.nextInt(3) + 2;
      const cols = rng.nextInt(4) + 2;
      const grid = makeEmptyGrid(rows, cols);
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          grid[r][c] = rng.next() < 0.5;
        }
      }
      expect(applyFold(grid, 'foldV')).toEqual(referenceFoldV(grid, or));
    }
  });

  it('foldVH equals foldV composed with foldH', () => {
    const rng = createRng('foldvh-compose');
    for (let trial = 0; trial < 20; trial += 1) {
      const rows = rng.nextInt(3) + 2;
      const cols = rng.nextInt(4) + 2;
      const grid = makeEmptyGrid(rows, cols);
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          grid[r][c] = rng.next() < 0.5;
        }
      }
      expect(applyFold(applyFold(grid, 'foldV'), 'foldH')).toEqual(applyFold(grid, 'foldVH'));
    }
  });

  it('result dimensions are ceil of the folded half', () => {
    const grid = makeEmptyGrid(3, 5);
    expect(applyFold(grid, 'foldV')).toHaveLength(3);
    expect(applyFold(grid, 'foldV')[0]).toHaveLength(Math.ceil(5 / 2));
    expect(applyFold(grid, 'foldH')).toHaveLength(Math.ceil(3 / 2));
    expect(applyFold(grid, 'foldH')[0]).toHaveLength(5);
    expect(applyFold(grid, 'foldVH')).toHaveLength(Math.ceil(3 / 2));
    expect(applyFold(grid, 'foldVH')[0]).toHaveLength(Math.ceil(5 / 2));
  });

  it('XOR and base-only variants share the correct dimensions and differ under overlap', () => {
    // Overlapping filled mirrored cells: OR keeps them, XOR drops them.
    const overlap = makeEmptyGrid(2, 4);
    overlap[0][0] = true;
    overlap[0][3] = true; // mirror of column 0
    const orResult = applyFold(overlap, 'foldV');
    const xorResult = applyFoldXor(overlap, 'foldV');
    const baseResult = applyFoldBaseOnly(overlap, 'foldV');
    expect(orResult[0][1]).toBe(true);
    expect(xorResult[0][1]).toBe(false);
    expect(baseResult[0][1]).toBe(true); // base half kept as-is
    expect(xorResult).toHaveLength(orResult.length);
    expect(baseResult[0]).toHaveLength(orResult[0].length);
  });

  it('gridDistance is 0 for equal grids and counts differing cells otherwise', () => {
    const a = makeEmptyGrid(2, 2);
    const b = makeEmptyGrid(2, 2);
    expect(gridDistance(a, b)).toBe(0);
    b[1][0] = true;
    b[0][1] = true;
    expect(gridDistance(a, b)).toBe(2);
    expect(gridsEqual(a, a)).toBe(true);
    expect(gridsEqual(a, b)).toBe(false);
  });
});

describe('generated rounds satisfy validateRound', () => {
  for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
    it(`validates every round of a ${level} session`, () => {
      const params = paramsForLevel(level);
      let prevSource: readonly (readonly boolean[])[] | null = null;
      let prevFold: FoldType | null = null;
      for (let roundIndex = 0; roundIndex < params.rounds; roundIndex += 1) {
        const data = generateRoundData({
          rng: createRng(`fold-${level}`),
          roundIndex,
          gridRows: params.gridRows,
          gridCols: params.gridCols,
          filledCells: params.filledCells,
          foldsAllowed: params.foldsAllowed,
          optionCount: params.optionCount,
          prevSource,
          prevFold,
        });
        prevSource = data.source;
        prevFold = data.foldType;
        expect(() => validateRound(data)).not.toThrow();
        // The chosen fold must actually alter the source (no ambiguous answer).
        expect(gridsEqual(applyFold(data.source, data.foldType), data.source)).toBe(false);
      }
    });
  }

  it('is deterministic per seed', () => {
    const params = paramsForLevel('normal');
    const build = () =>
      generateRoundData({
        rng: createRng('fold-det'),
        roundIndex: 2,
        gridRows: params.gridRows,
        gridCols: params.gridCols,
        filledCells: params.filledCells,
        foldsAllowed: params.foldsAllowed,
        optionCount: params.optionCount,
        prevSource: null,
        prevFold: null,
      });
    expect(build()).toEqual(build());
  });
});
