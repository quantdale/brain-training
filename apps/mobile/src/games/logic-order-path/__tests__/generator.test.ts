// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  ITEM_POOL,
  MAX_ATTEMPTS,
  generateRound,
  validateGeneratedRound,
} from '../generator';
import {
  availableNext,
  countTopologicalOrders,
  isUniquelyOrdered,
  validateRound,
} from '../solver';
import {
  ORDER_PATH_DIFFICULTY_PARAMS,
  orderPathParamsForLevel,
} from '../difficulty';
import type { DifficultyLevel } from '@/sdk';
import type { OrderPathDifficultyParams } from '../types';

function roundFor(
  seed: string,
  roundIndex: number,
  params: OrderPathDifficultyParams,
  prevSolution: readonly string[] | null,
) {
  return generateRound({
    rng: createRng(seed),
    roundIndex,
    itemCount: params.itemCount,
    edgeDensityTarget: params.edgeDensityTarget,
    prevSolution,
  });
}

describe('generateRound', () => {
  it('produces a valid uniquely-ordered puzzle for every level and many seeds', () => {
    const levels: DifficultyLevel[] = ['easy', 'normal', 'hard', 'expert', 'adaptive'];
    for (const level of levels) {
      const params = orderPathParamsForLevel(level);
      let prev: readonly string[] | null = null;
      for (let roundIndex = 0; roundIndex < 4; roundIndex += 1) {
        const round = roundFor(`valid-${level}`, roundIndex, params, prev);
        expect(round.items).toHaveLength(params.itemCount);
        expect(validateGeneratedRound(round)).toBe(true);
        // Solver cross-check: exactly one topological order, and it is `solution`.
        expect(isUniquelyOrdered(round.items, round.edges)).toBe(true);
        prev = round.solution;
      }
    }
  });

  it('is deterministic for the same seed + round index', () => {
    const params = ORDER_PATH_DIFFICULTY_PARAMS.normal;
    const a = roundFor('det', 2, params, null);
    const b = roundFor('det', 2, params, null);
    expect(a).toEqual(b);
  });

  it('diverges for different seeds', () => {
    const params = ORDER_PATH_DIFFICULTY_PARAMS.normal;
    const a = roundFor('seed-A', 0, params, null);
    const b = roundFor('seed-B', 0, params, null);
    expect(a.solution).not.toEqual(b.solution);
  });

  it('draws items from the pool without repeats, in sorted order', () => {
    const round = roundFor('items', 0, ORDER_PATH_DIFFICULTY_PARAMS.expert, null);
    expect(round.items).toHaveLength(ORDER_PATH_DIFFICULTY_PARAMS.expert.itemCount);
    expect(new Set(round.items).size).toBe(round.items.length);
    for (const item of round.items) {
      expect(ITEM_POOL).toContain(item);
    }
    expect(round.items).toEqual([...round.items].sort());
  });

  it('ships a solution that is a permutation of the items', () => {
    const round = roundFor('perm', 3, ORDER_PATH_DIFFICULTY_PARAMS.normal, null);
    expect([...round.solution].sort()).toEqual([...round.items].sort());
    expect(round.stepCount).toBe(round.items.length);
  });

  it('keeps edge count within [itemCount-1, density target] and mirrors constraints', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = ORDER_PATH_DIFFICULTY_PARAMS[level];
      const totalPossible = (params.itemCount * (params.itemCount - 1)) / 2;
      const targetCount = Math.max(
        params.itemCount - 1,
        Math.round(totalPossible * params.edgeDensityTarget),
      );
      const round = roundFor(`edges-${level}`, 0, params, null);

      // A unique order needs at least a spanning chain of M-1 edges.
      expect(round.edges.length).toBeGreaterThanOrEqual(params.itemCount - 1);
      expect(round.edges.length).toBeLessThanOrEqual(targetCount);
      expect(round.constraints).toHaveLength(round.edges.length);
      for (const [from, to] of round.edges) {
        expect(round.constraints).toContain(`${from} before ${to}`);
        expect(round.items).toContain(from);
        expect(round.items).toContain(to);
      }
    }
  });

  it('keeps every forward edge at density 1.0 (easy)', () => {
    const params = ORDER_PATH_DIFFICULTY_PARAMS.easy;
    const totalPossible = (params.itemCount * (params.itemCount - 1)) / 2;
    const round = roundFor('full', 0, params, null);
    expect(round.edges).toHaveLength(totalPossible);
  });

  it('avoids near-duplicate consecutive rounds (different first item)', () => {
    const params = ORDER_PATH_DIFFICULTY_PARAMS.normal;
    let prev = roundFor('near', 0, params, null);
    for (let roundIndex = 1; roundIndex < 6; roundIndex += 1) {
      const round = roundFor('near', roundIndex, params, prev.solution);
      expect(round.solution[0]).not.toBe(prev.solution[0]);
      prev = round;
    }
  });

  it('exposes the attempt budget constant', () => {
    expect(MAX_ATTEMPTS).toBeGreaterThan(0);
  });
});

describe('solver', () => {
  it('availableNext yields only unblocked remaining items', () => {
    const edges: [string, string][] = [
      ['A', 'B'],
      ['B', 'C'],
    ];
    expect(availableNext(['A', 'B', 'C'], edges, [])).toEqual(['A']);
    expect(availableNext(['A', 'B', 'C'], edges, ['A'])).toEqual(['B']);
    expect(availableNext(['A', 'B', 'C'], edges, ['A', 'B'])).toEqual(['C']);
    expect(availableNext(['A', 'B', 'C'], edges, ['A', 'B', 'C'])).toEqual([]);
  });

  it('countTopologicalOrders distinguishes unique / ambiguous / inconsistent DAGs', () => {
    const chain: [string, string][] = [
      ['A', 'B'],
      ['B', 'C'],
    ];
    expect(countTopologicalOrders(['A', 'B', 'C'], chain)).toBe(1);
    // No edges: any order works (capped answer of 2).
    expect(countTopologicalOrders(['A', 'B'], [])).toBe(2);
    // Cycle: dead end.
    expect(countTopologicalOrders(['A', 'B'], [['A', 'B'], ['B', 'A']])).toBe(0);
  });

  it('isUniquelyOrdered rejects an unconstrained pair', () => {
    expect(isUniquelyOrdered(['A', 'B'], [])).toBe(false);
    expect(isUniquelyOrdered(['A', 'B'], [['A', 'B']])).toBe(true);
  });

  it('validateRound rejects wrong solutions', () => {
    const edges: [string, string][] = [
      ['A', 'B'],
      ['B', 'C'],
    ];
    expect(validateRound(['A', 'B', 'C'], edges, ['A', 'B', 'C'])).toBe(true);
    expect(validateRound(['A', 'B', 'C'], edges, ['B', 'A', 'C'])).toBe(false);
    expect(validateRound(['A', 'B', 'C'], edges, ['A', 'B'])).toBe(false);
    expect(validateRound(['A', 'B', 'C'], edges, ['A', 'A', 'B'])).toBe(false);
    // Ambiguous puzzle: no solution can validate.
    expect(validateRound(['A', 'B'], [], ['A', 'B'])).toBe(false);
  });
});
