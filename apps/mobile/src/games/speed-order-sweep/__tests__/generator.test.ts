// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { generateRound, rowsFor, validateRound } from '../generator';
import { ORDER_SWEEP_DIFFICULTY_PARAMS } from '../difficulty';
import type { OrderSweepRound } from '../types';

/** Full session board set: all rounds for the given tuning. */
function fullSession(
  seed: string,
  count = 9,
  rounds = 5,
  columns = 3,
  maxValue = 40,
): OrderSweepRound[] {
  const rng = createRng(seed);
  const boards: OrderSweepRound[] = [];
  for (let round = 0; round < rounds; round += 1) {
    boards.push(generateRound({ rng, roundIndex: round, count, columns, maxValue }));
  }
  return boards;
}

describe('generateRound', () => {
  it('is deterministic per seed and differs across seeds', () => {
    expect(fullSession('seed-42')).toEqual(fullSession('seed-42'));
    const a = fullSession('seed-a');
    const b = fullSession('seed-b');
    expect(a[0]).not.toEqual(b[0]);
    expect(a).not.toEqual(b);
  });

  it('satisfies the generator invariants (unique values, ascending order, grid ids) across many seeds and all fixed tunings', () => {
    for (const params of Object.values(ORDER_SWEEP_DIFFICULTY_PARAMS)) {
      for (let seed = 1; seed <= 25; seed += 1) {
        for (const board of fullSession(String(seed), params.count, params.rounds, params.columns, params.maxValue)) {
          expect(validateRound(board, params.count, params.maxValue)).toEqual({
            ok: true,
            reason: null,
          });
        }
      }
    }
  });

  it('never deals a trivially row-major-sorted board (players must scan)', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const board of fullSession(String(seed))) {
        const sortedReading = board.tokens.every(
          (token) => token.value === board.order[token.id],
        );
        expect(sortedReading).toBe(false);
      }
    }
  });

  it('derives grid rows from count and columns', () => {
    expect(rowsFor(9, 3)).toBe(3);
    expect(rowsFor(12, 4)).toBe(3);
    expect(rowsFor(7, 3)).toBe(3); // ceil: one hole in the last row
    expect(() => rowsFor(0, 3)).toThrow(RangeError);
  });
});
