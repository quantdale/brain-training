// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_GENERATION_ATTEMPTS,
  MIN_PATTERN_DISTANCE,
  applyTransform,
  coordsToIndex,
  generateRoundData,
  generateSourcePattern,
  indexToCoords,
  isSymmetric,
  patternDistance,
} from '../generator';
import { ALL_TRANSFORMS } from '../types';
import type { TransformType } from '../types';

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

describe('indexToCoords / coordsToIndex', () => {
  it('round-trips for a 3×3 grid', () => {
    const side = 3;
    for (let i = 0; i < 9; i += 1) {
      const { row, col } = indexToCoords(i, side);
      expect(coordsToIndex(row, col, side)).toBe(i);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(side);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(side);
    }
  });

  it('round-trips for a 4×4 grid', () => {
    const side = 4;
    for (let i = 0; i < 16; i += 1) {
      const { row, col } = indexToCoords(i, side);
      expect(coordsToIndex(row, col, side)).toBe(i);
    }
  });
});

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

describe('applyTransform', () => {
  it('rotate90 on a 3×3 grid transforms correctly', () => {
    // Pattern: top-left cell (0,0) → after 90° CW: (0,2) = index 2
    // Pattern: center (1,1) → stays at (1,1) = index 4
    // Pattern: bottom-right (2,2) → (2,0) = index 6
    const pattern = [0, 4, 8];
    const result = applyTransform(pattern, 'rotate90', 3);
    expect(result).toEqual([2, 4, 6]);
  });

  it('rotate180 on a 3×3 grid transforms correctly', () => {
    // (0,0)→(2,2)=8, (0,1)→(2,1)=7, (1,0)→(1,2)=5
    const pattern = [0, 1, 3];
    const result = applyTransform(pattern, 'rotate180', 3);
    expect(result).toEqual([5, 7, 8]);
  });

  it('rotate270 on a 3×3 grid transforms correctly', () => {
    // (0,0)→(2,0)=6, (1,1)→(1,1)=4, (2,2)→(0,2)=2
    const pattern = [0, 4, 8];
    const result = applyTransform(pattern, 'rotate270', 3);
    expect(result).toEqual([2, 4, 6]);
  });

  it('mirrorH on a 3×3 grid flips left-right', () => {
    // (0,0)→(0,2)=2, (0,1)→(0,1)=1, (1,0)→(1,2)=5
    const pattern = [0, 1, 3];
    const result = applyTransform(pattern, 'mirrorH', 3);
    expect(result).toEqual([1, 2, 5]);
  });

  it('mirrorV on a 3×3 grid flips top-bottom', () => {
    // (0,0)→(2,0)=6, (0,1)→(2,1)=7, (1,0)→(1,0)=3
    const pattern = [0, 1, 3];
    const result = applyTransform(pattern, 'mirrorV', 3);
    expect(result).toEqual([3, 6, 7]);
  });

  it('result is always sorted', () => {
    const pattern = [8, 0, 4];
    for (const t of ALL_TRANSFORMS) {
      const result = applyTransform(t === 'rotate270' ? pattern : [0, 1, 2], t, 3);
      for (let i = 1; i < result.length; i += 1) {
        expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
      }
    }
  });

  it('preserves pattern size', () => {
    const pattern = [0, 2, 5, 7];
    for (const t of ALL_TRANSFORMS) {
      expect(applyTransform(pattern, t, 4)).toHaveLength(4);
    }
  });
});

// ---------------------------------------------------------------------------
// Symmetry
// ---------------------------------------------------------------------------

describe('isSymmetric', () => {
  it('detects a symmetric pattern under rotate180', () => {
    // Pattern symmetric under 180° rotation: [0, 4, 8] on 3×3
    // (0,0)→(2,2)=8, (1,1)→(1,1)=4, (2,2)→(0,0)=0 → same set
    expect(isSymmetric([0, 4, 8], 'rotate180', 3)).toBe(true);
  });

  it('detects a non-symmetric pattern under rotate90', () => {
    // [0, 1, 2] on 3×3: rotate90 → [2, 5, 8], different
    expect(isSymmetric([0, 1, 2], 'rotate90', 3)).toBe(false);
  });

  it('detects a pattern symmetric under mirrorH', () => {
    // [1, 3, 5, 7] on 3×3 (diamond): mirrorH → [1, 3, 5, 7]
    expect(isSymmetric([1, 3, 5, 7], 'mirrorH', 3)).toBe(true);
  });

  it('detects a pattern symmetric under mirrorV', () => {
    // [3, 4, 5] on 3×3 (middle row): mirrorV → [3, 4, 5]
    expect(isSymmetric([3, 4, 5], 'mirrorV', 3)).toBe(true);
  });

  it('returns false for patterns of different lengths', () => {
    expect(isSymmetric([0, 1], 'rotate90', 3)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pattern distance
// ---------------------------------------------------------------------------

describe('patternDistance', () => {
  it('returns 0 for identical patterns', () => {
    expect(patternDistance([0, 1, 2], [0, 1, 2])).toBe(0);
  });

  it('counts differing cells (filledCells - intersection)', () => {
    // [0,1,2] vs [0,1,3]: intersection=2, distance = 3-2 = 1
    expect(patternDistance([0, 1, 2], [0, 1, 3])).toBe(1);
    // [0,1,2] vs [3,4,5]: intersection=0, distance = 3-0 = 3
    expect(patternDistance([0, 1, 2], [3, 4, 5])).toBe(3);
  });

  it('handles different-length patterns', () => {
    expect(patternDistance([0, 1], [0, 1, 2])).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Source pattern generation
// ---------------------------------------------------------------------------

describe('generateSourcePattern', () => {
  it('is deterministic: same seed produces same pattern', () => {
    const a = generateSourcePattern(createRng('src-42'), 0, 9, 3);
    const b = generateSourcePattern(createRng('src-42'), 0, 9, 3);
    expect(a).toEqual(b);
  });

  it('produces the correct number of filled cells', () => {
    const pattern = generateSourcePattern(createRng('fill'), 0, 16, 5);
    expect(pattern).toHaveLength(5);
  });

  it('all cells are in range', () => {
    const pattern = generateSourcePattern(createRng('range'), 0, 9, 4);
    for (const cell of pattern) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(9);
    }
  });

  it('cells are sorted and unique', () => {
    const pattern = generateSourcePattern(createRng('unique'), 0, 16, 6);
    const set = new Set(pattern);
    expect(set.size).toBe(6);
    for (let i = 1; i < pattern.length; i += 1) {
      expect(pattern[i]).toBeGreaterThan(pattern[i - 1]);
    }
  });

  it('different seeds produce different patterns', () => {
    const a = generateSourcePattern(createRng('seed-a'), 0, 9, 3);
    const b = generateSourcePattern(createRng('seed-b'), 0, 9, 3);
    expect(a).not.toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Full round data generation
// ---------------------------------------------------------------------------

describe('generateRoundData', () => {
  it('is deterministic: same seed reproduces the same round', () => {
    const makeRound = () =>
      generateRoundData({
        rng: createRng('round-det'),
        roundIndex: 0,
        gridSize: 9,
        side: 3,
        filledCells: 3,
        allowedTransforms: ['rotate90', 'rotate180'],
        optionCount: 3,
        prevSource: null,
        prevTransform: null,
      });
    expect(makeRound()).toEqual(makeRound());
  });

  it('correct option equals the transformed source exactly', () => {
    const round = generateRoundData({
      rng: createRng('correct-check'),
      roundIndex: 0,
      gridSize: 9,
      side: 3,
      filledCells: 3,
      allowedTransforms: ['rotate90'],
      optionCount: 2,
      prevSource: null,
      prevTransform: null,
    });
    const expected = applyTransform(round.source, round.transformType, 3);
    expect(round.correctPattern).toEqual(expected);
    expect(round.options[round.correctOptionIndex]).toEqual(expected);
  });

  it('distractors differ from the correct option', () => {
    const round = generateRoundData({
      rng: createRng('distractor-check'),
      roundIndex: 0,
      gridSize: 9,
      side: 3,
      filledCells: 3,
      allowedTransforms: ['rotate90'],
      optionCount: 3,
      prevSource: null,
      prevTransform: null,
    });
    const correct = round.options[round.correctOptionIndex];
    for (let i = 0; i < round.options.length; i += 1) {
      if (i === round.correctOptionIndex) continue;
      expect(round.options[i]).not.toEqual(correct);
    }
  });

  it('option count matches the requested count', () => {
    const round = generateRoundData({
      rng: createRng('opt-count'),
      roundIndex: 0,
      gridSize: 9,
      side: 3,
      filledCells: 3,
      allowedTransforms: ['rotate90', 'rotate180', 'rotate270'],
      optionCount: 4,
      prevSource: null,
      prevTransform: null,
    });
    expect(round.options).toHaveLength(4);
  });

  it('source is not symmetric under the chosen transform', () => {
    // Run many seeds to verify the symmetry rejection works.
    for (let seed = 0; seed < 50; seed += 1) {
      const round = generateRoundData({
        rng: createRng(`sym-${seed}`),
        roundIndex: 0,
        gridSize: 9,
        side: 3,
        filledCells: 3,
        allowedTransforms: ['rotate90', 'rotate180', 'rotate270', 'mirrorH', 'mirrorV'],
        optionCount: 3,
        prevSource: null,
        prevTransform: null,
      });
      expect(isSymmetric(round.source, round.transformType, 3)).toBe(false);
    }
  });

  it('near-duplicate avoidance: consecutive rounds differ', () => {
    const rng = createRng('near-dup');
    let prevSource: readonly number[] | null = null;
    let prevTransform: TransformType | null = null;
    for (let round = 0; round < 10; round += 1) {
      const data = generateRoundData({
        rng,
        roundIndex: round,
        gridSize: 9,
        side: 3,
        filledCells: 3,
        allowedTransforms: ['rotate90', 'rotate180'],
        optionCount: 2,
        prevSource,
        prevTransform,
      });
      if (prevSource !== null) {
        expect(patternDistance(data.source, prevSource)).toBeGreaterThanOrEqual(MIN_PATTERN_DISTANCE);
      }
      prevSource = data.source;
      prevTransform = data.transformType;
    }
  });

  it('works on a 4×4 grid', () => {
    const round = generateRoundData({
      rng: createRng('grid-16'),
      roundIndex: 0,
      gridSize: 16,
      side: 4,
      filledCells: 5,
      allowedTransforms: ['rotate90', 'rotate180', 'rotate270'],
      optionCount: 3,
      prevSource: null,
      prevTransform: null,
    });
    expect(round.source).toHaveLength(5);
    for (const cell of round.source) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(16);
    }
    expect(round.options).toHaveLength(3);
  });

  it('is bounded: generation always terminates', () => {
    // Even with tight constraints, generation stays in budget.
    const round = generateRoundData({
      rng: createRng('budget'),
      roundIndex: 0,
      gridSize: 9,
      side: 3,
      filledCells: 3,
      allowedTransforms: ['rotate90'],
      optionCount: 2,
      prevSource: null,
      prevTransform: null,
    });
    expect(round.source).toHaveLength(3);
    expect(MAX_GENERATION_ATTEMPTS).toBeGreaterThan(0);
  });
});
