// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_GENERATION_ATTEMPTS,
  MIN_PATTERN_DISTANCE,
  applyFold,
  applyFoldBaseOnly,
  applyFoldXor,
  cloneGrid,
  generateRoundData,
  generateSourceGrid,
  gridDims,
  gridDistance,
  gridsEqual,
  makeEmptyGrid,
  validateRound,
} from '../generator';
import type { Grid } from '../generator';
import { ADAPTIVE_PARAMS, DIFFICULTY_PARAMS } from '../difficulty';
import { ALL_FOLDS } from '../types';
import type { FoldType } from '../types';

const g = (rows: string[]): Grid =>
  rows.map((row) => row.split('').map((ch) => ch === 'X'));

describe('grid helpers', () => {
  it('makeEmptyGrid builds an all-false matrix', () => {
    const grid = makeEmptyGrid(2, 3);
    expect(grid).toHaveLength(2);
    expect(grid[0]).toHaveLength(3);
    expect(grid.flat().every((cell) => cell === false)).toBe(true);
  });

  it('cloneGrid is independent of the original', () => {
    const original = makeEmptyGrid(2, 2);
    const copy = cloneGrid(original);
    copy[0][0] = true;
    expect(original[0][0]).toBe(false);
    expect(copy[0][0]).toBe(true);
  });

  it('gridDims reports rows × cols', () => {
    expect(gridDims(makeEmptyGrid(3, 5))).toEqual({ rows: 3, cols: 5 });
  });

  it('gridsEqual compares cell-for-cell', () => {
    expect(gridsEqual(makeEmptyGrid(2, 2), makeEmptyGrid(2, 2))).toBe(true);
    const a = makeEmptyGrid(2, 2);
    a[1][1] = true;
    expect(gridsEqual(a, makeEmptyGrid(2, 2))).toBe(false);
    expect(gridsEqual(makeEmptyGrid(2, 2), makeEmptyGrid(2, 3))).toBe(false);
  });

  it('gridDistance counts differing cells and penalizes mismatched dims', () => {
    const a = g(['X.', '.X']);
    const b = g(['X.', '..']);
    expect(gridDistance(a, b)).toBe(1);
    expect(gridDistance(a, a)).toBe(0);
    expect(gridDistance(makeEmptyGrid(3, 3), makeEmptyGrid(2, 2))).toBeGreaterThan(
      MIN_PATTERN_DISTANCE,
    );
  });
});

describe('applyFold (OR merge)', () => {
  it('foldV folds the left half onto the right half', () => {
    // Left column [X; .] ORs onto the mirrored right column.
    expect(applyFold(g(['X.', '..']), 'foldV')).toEqual(g(['X', '.']));
  });

  it('foldV merges by OR: filled cells from either half survive', () => {
    expect(applyFold(g(['XX', 'X.']), 'foldV')).toEqual(g(['X', 'X']));
  });

  it('foldH folds the top half onto the bottom half', () => {
    expect(applyFold(g(['..', 'X.']), 'foldH')).toEqual(g(['X.']));
    expect(applyFold(g(['XX', 'X.']), 'foldH')).toEqual(g(['XX']));
  });

  it('foldVH applies both folds (smallest result)', () => {
    expect(applyFold(g(['X.', '.X']), 'foldVH')).toEqual(g(['X']));
  });

  it('halves the relevant dimension (odd sizes keep the fold line)', () => {
    // 3×4 → foldV keeps height 3, width ceil(4/2)=2.
    expect(gridDims(applyFold(makeEmptyGrid(3, 4), 'foldV'))).toEqual({
      rows: 3,
      cols: 2,
    });
    // 3×4 → foldH keeps width 4, height ceil(3/2)=2.
    expect(gridDims(applyFold(makeEmptyGrid(3, 4), 'foldH'))).toEqual({
      rows: 2,
      cols: 4,
    });
    // 3×4 → foldVH → 2×2.
    expect(gridDims(applyFold(makeEmptyGrid(3, 4), 'foldVH'))).toEqual({
      rows: 2,
      cols: 2,
    });
  });
});

describe('distractor fold variants', () => {
  it('applyFoldXor merges by XOR instead of OR', () => {
    // Overlapping fill at the top row: OR keeps it, XOR cancels it.
    const source = g(['XX', 'X.']);
    expect(applyFold(source, 'foldV')).toEqual(g(['X', 'X']));
    expect(applyFoldXor(source, 'foldV')).toEqual(g(['.', 'X']));
  });

  it('applyFoldBaseOnly drops the folded-over half entirely', () => {
    const source = g(['X.', '..']);
    expect(applyFoldBaseOnly(source, 'foldV')).toEqual(g(['.', '.']));
  });

  it('both variants share the correct result dimensions', () => {
    const source = makeEmptyGrid(4, 4);
    for (const fold of ALL_FOLDS as readonly FoldType[]) {
      const dims = gridDims(applyFold(source, fold));
      expect(gridDims(applyFoldXor(source, fold))).toEqual(dims);
      expect(gridDims(applyFoldBaseOnly(source, fold))).toEqual(dims);
    }
  });
});

describe('generateSourceGrid', () => {
  it('fills exactly `filledCells` distinct cells', () => {
    const grid = generateSourceGrid(createRng('src'), 0, 3, 4, 4);
    const filled = grid.flat().filter((cell) => cell).length;
    expect(filled).toBe(4);
    expect(grid).toHaveLength(3);
    expect(grid[0]).toHaveLength(4);
  });

  it('is deterministic for the same seed + round', () => {
    const a = generateSourceGrid(createRng('det'), 2, 3, 3, 3);
    const b = generateSourceGrid(createRng('det'), 2, 3, 3, 3);
    expect(gridsEqual(a, b)).toBe(true);
  });

  it('diverges across fork salts (round index is part of the salt)', () => {
    const a = generateSourceGrid(createRng('salts'), 0, 4, 4, 6);
    const b = generateSourceGrid(createRng('salts'), 1, 4, 4, 6);
    expect(gridsEqual(a, b)).toBe(false);
  });
});

describe('generateRoundData + validateRound', () => {
  interface Chain {
    prevSource: Grid | null;
    prevFold: FoldType | null;
  }

  function chainFor(level: keyof typeof DIFFICULTY_PARAMS): void {
    const params = DIFFICULTY_PARAMS[level];
    let chain: Chain = { prevSource: null, prevFold: null };
    for (let round = 0; round < params.rounds; round += 1) {
      const data = generateRoundData({
        rng: createRng(`suite:${level}:${round}`),
        roundIndex: round,
        gridRows: params.gridRows,
        gridCols: params.gridCols,
        filledCells: params.filledCells,
        foldsAllowed: params.foldsAllowed,
        optionCount: params.optionCount,
        prevSource: chain.prevSource,
        prevFold: chain.prevFold,
      });
      // All documented invariants hold on every generated round.
      expect(() => validateRound(data)).not.toThrow();
      expect(data.options.length).toBeGreaterThanOrEqual(2);
      expect(data.options.length).toBeLessThanOrEqual(params.optionCount);
      expect(params.foldsAllowed).toContain(data.foldType);
      expect(data.foldLabel).toBeTruthy();
      // Consecutive sources are never near-duplicates.
      if (chain.prevSource !== null) {
        expect(gridDistance(data.source, chain.prevSource)).toBeGreaterThanOrEqual(
          MIN_PATTERN_DISTANCE,
        );
      }
      chain = { prevSource: data.source, prevFold: data.foldType };
    }
  }

  it('produces valid rounds for every fixed level across many seeds', () => {
    chainFor('easy');
    chainFor('normal');
    chainFor('hard');
    chainFor('expert');
  });

  it('produces valid rounds for adaptive parameters', () => {
    let prevSource: Grid | null = null;
    let prevFold: FoldType | null = null;
    for (let round = 0; round < ADAPTIVE_PARAMS.rounds; round += 1) {
      const data = generateRoundData({
        rng: createRng(`adaptive:${round}`),
        roundIndex: round,
        gridRows: ADAPTIVE_PARAMS.gridRows,
        gridCols: ADAPTIVE_PARAMS.gridCols,
        filledCells: ADAPTIVE_PARAMS.minFilledCells ?? ADAPTIVE_PARAMS.filledCells,
        foldsAllowed: ADAPTIVE_PARAMS.foldsAllowed,
        optionCount: ADAPTIVE_PARAMS.maxOptionCount ?? ADAPTIVE_PARAMS.optionCount,
        prevSource,
        prevFold,
      });
      expect(() => validateRound(data)).not.toThrow();
      prevSource = data.source;
      prevFold = data.foldType;
    }
  });

  it('is deterministic: same seed → identical round data', () => {
    const input = {
      rng: createRng('det-round'),
      roundIndex: 1,
      gridRows: 3,
      gridCols: 4,
      filledCells: 4,
      foldsAllowed: DIFFICULTY_PARAMS.normal.foldsAllowed,
      optionCount: 3,
      prevSource: null,
      prevFold: null,
    };
    const a = generateRoundData(input);
    const b = generateRoundData({ ...input, rng: createRng('det-round') });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('exposes exactly one correct option at correctOptionIndex', () => {
    const data = generateRoundData({
      rng: createRng('correct-index'),
      roundIndex: 0,
      gridRows: 4,
      gridCols: 4,
      filledCells: 5,
      foldsAllowed: DIFFICULTY_PARAMS.hard.foldsAllowed,
      optionCount: 3,
      prevSource: null,
      prevFold: null,
    });
    expect(gridsEqual(data.options[data.correctOptionIndex], data.correctPattern)).toBe(
      true,
    );
    const correctCount = data.options.filter((o) =>
      gridsEqual(o, data.correctPattern),
    ).length;
    expect(correctCount).toBe(1);
  });

  it('the correct pattern always equals applyFold(source, foldType)', () => {
    for (const seed of ['inv-1', 'inv-2', 'inv-3']) {
      const data = generateRoundData({
        rng: createRng(seed),
        roundIndex: 0,
        gridRows: 3,
        gridCols: 3,
        filledCells: 3,
        foldsAllowed: ALL_FOLDS,
        optionCount: 4,
        prevSource: null,
        prevFold: null,
      });
      expect(gridsEqual(applyFold(data.source, data.foldType), data.correctPattern)).toBe(
        true,
      );
    }
  });

  it('validateRound throws on tampered output', () => {
    const data = generateRoundData({
      rng: createRng('tamper'),
      roundIndex: 0,
      gridRows: 3,
      gridCols: 3,
      filledCells: 3,
      foldsAllowed: ['foldV'],
      optionCount: 2,
      prevSource: null,
      prevFold: null,
    });
    // Wrong correctOptionIndex.
    const wrongIndex = {
      ...data,
      correctOptionIndex: (data.correctOptionIndex + 1) % data.options.length,
    };
    expect(() => validateRound(wrongIndex)).toThrow();
    // Duplicate options.
    const duplicated = { ...data, options: [data.correctPattern, data.correctPattern] };
    expect(() => validateRound(duplicated)).toThrow();
    // Option with wrong dimensions.
    const wrongDims = { ...data, options: [...data.options.slice(1), makeEmptyGrid(9, 9)] };
    expect(() => validateRound(wrongDims)).toThrow();
  });
});

describe('constants', () => {
  it('documents the generation bounds', () => {
    expect(MIN_PATTERN_DISTANCE).toBeGreaterThan(0);
    expect(MAX_GENERATION_ATTEMPTS).toBeGreaterThan(0);
  });
});
