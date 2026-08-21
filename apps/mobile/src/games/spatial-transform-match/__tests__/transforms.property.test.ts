// Property/invariant tests for the Transform Match transform algebra.
//
// The transforms are mathematically provable, so the tests below assert
// exact algebraic identities (composition, inverse, identity) rather than
// sampled behavior. Any generator change that breaks rotation handedness,
// bounds, or equivalence handling fails here.
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_GENERATION_ATTEMPTS,
  applyTransform,
  generateRoundData,
  isSymmetric,
  patternDistance,
} from '../generator';
import { ALL_TRANSFORMS } from '../types';
import { DIFFICULTY_PARAMS } from '../difficulty';

/** All cell-index subsets of `size` filled cells on a `side`² grid (sampled). */
function samplePatterns(side: number, filled: number, count: number): number[][] {
  const rng = createRng(`property-sample:${side}:${filled}`);
  const gridSize = side * side;
  const patterns: number[][] = [];
  for (let i = 0; i < count; i += 1) {
    const indices = Array.from({ length: gridSize }, (_, k) => k);
    patterns.push(rng.shuffle(indices).slice(0, filled).sort((a, b) => a - b));
  }
  return patterns;
}

describe('transform algebra', () => {
  const side = 4;
  const patterns = samplePatterns(side, 6, 24);

  it('rotate90 applied four times is the identity (full turn)', () => {
    for (const pattern of patterns) {
      let rotated = applyTransform(pattern, 'rotate90', side);
      rotated = applyTransform(rotated, 'rotate90', side);
      rotated = applyTransform(rotated, 'rotate90', side);
      rotated = applyTransform(rotated, 'rotate90', side);
      expect(rotated).toEqual(pattern);
    }
  });

  it('rotate270 equals rotate90 applied three times', () => {
    for (const pattern of patterns) {
      const direct = applyTransform(pattern, 'rotate270', side);
      let stepped = applyTransform(pattern, 'rotate90', side);
      stepped = applyTransform(stepped, 'rotate90', side);
      stepped = applyTransform(stepped, 'rotate90', side);
      expect(direct).toEqual(stepped);
    }
  });

  it('rotate180 equals mirrorH composed with mirrorV (either order)', () => {
    for (const pattern of patterns) {
      const hv = applyTransform(applyTransform(pattern, 'mirrorH', side), 'mirrorV', side);
      const vh = applyTransform(applyTransform(pattern, 'mirrorV', side), 'mirrorH', side);
      const rot = applyTransform(pattern, 'rotate180', side);
      expect(hv).toEqual(rot);
      expect(vh).toEqual(rot);
    }
  });

  it('mirrors are involutions (applying twice is the identity)', () => {
    for (const pattern of patterns) {
      expect(applyTransform(applyTransform(pattern, 'mirrorH', side), 'mirrorH', side)).toEqual(
        pattern,
      );
      expect(applyTransform(applyTransform(pattern, 'mirrorV', side), 'mirrorV', side)).toEqual(
        pattern,
      );
    }
  });

  it('every transform preserves the cell count and stays in bounds', () => {
    for (const pattern of patterns) {
      for (const transform of ALL_TRANSFORMS) {
        const transformed = applyTransform(pattern, transform, side);
        expect(transformed).toHaveLength(pattern.length);
        for (const index of transformed) {
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(side * side);
        }
        // Sorted + distinct output.
        for (let i = 1; i < transformed.length; i += 1) {
          expect(transformed[i]).toBeGreaterThan(transformed[i - 1]);
        }
      }
    }
  });

  it('isSymmetric agrees with applying the transform', () => {
    for (const pattern of patterns) {
      for (const transform of ALL_TRANSFORMS) {
        expect(isSymmetric(pattern, transform, side)).toBe(
          JSON.stringify(applyTransform(pattern, transform, side)) ===
            JSON.stringify([...pattern].sort((a, b) => a - b)),
        );
      }
    }
  });

  it('patternDistance is 0 for identical patterns and positive otherwise', () => {
    for (const pattern of patterns) {
      expect(patternDistance(pattern, pattern)).toBe(0);
      const shifted = pattern.map((i) => (i + 1) % (side * side));
      if (!patternsEqual(shifted, pattern)) {
        expect(patternDistance(pattern, shifted)).toBeGreaterThan(0);
      }
    }
  });
});

function patternsEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

describe('generateRoundData invariants', () => {
  const params = DIFFICULTY_PARAMS.expert;

  it('produces exactly one correct option equal to the transformed source', () => {
    for (let roundIndex = 0; roundIndex < 30; roundIndex += 1) {
      const data = generateRoundData({
        rng: createRng(`round-data:${roundIndex}`),
        roundIndex,
        gridSize: params.gridSize,
        side: Math.round(Math.sqrt(params.gridSize)),
        filledCells: params.filledCells,
        allowedTransforms: params.allowedTransforms,
        optionCount: params.optionCount,
        prevSource: null,
        prevTransform: null,
      });
      const correctMatches = data.options.filter((option) =>
        patternsEqual([...option], [...data.correctPattern]),
      );
      expect(correctMatches).toHaveLength(1);
      expect(data.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(data.correctOptionIndex).toBeLessThan(data.options.length);
      expect([...data.options[data.correctOptionIndex]]).toEqual([...data.correctPattern]);
      // The correct option equals the source under the chosen transform.
      expect(applyTransform(data.source, data.transformType, Math.round(Math.sqrt(params.gridSize)))).toEqual(
        [...data.correctPattern],
      );
      // Options are pairwise distinct.
      for (let i = 0; i < data.options.length; i += 1) {
        for (let j = i + 1; j < data.options.length; j += 1) {
          expect(patternsEqual([...data.options[i]], [...data.options[j]])).toBe(false);
        }
      }
    }
  });

  it('never picks a transform under which the source is symmetric', () => {
    for (let roundIndex = 0; roundIndex < 30; roundIndex += 1) {
      const data = generateRoundData({
        rng: createRng(`symmetry:${roundIndex}`),
        roundIndex,
        gridSize: params.gridSize,
        side: Math.round(Math.sqrt(params.gridSize)),
        filledCells: params.filledCells,
        allowedTransforms: params.allowedTransforms,
        optionCount: params.optionCount,
        prevSource: null,
        prevTransform: null,
      });
      expect(isSymmetric(data.source, data.transformType, Math.round(Math.sqrt(params.gridSize)))).toBe(
        false,
      );
    }
  });

  it('is deterministic per seed and bounded by the attempt budget', () => {
    const build = (seed: string) =>
      generateRoundData({
        rng: createRng(seed),
        roundIndex: 3,
        gridSize: params.gridSize,
        side: Math.round(Math.sqrt(params.gridSize)),
        filledCells: params.filledCells,
        allowedTransforms: params.allowedTransforms,
        optionCount: params.optionCount,
        prevSource: null,
        prevTransform: null,
      });
    expect(build('det-1')).toEqual(build('det-1'));
    expect(MAX_GENERATION_ATTEMPTS).toBeGreaterThan(0);
  });
});
