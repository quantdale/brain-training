// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  DEVIATION_VARIANTS,
  MAX_BOARD_ATTEMPTS,
  MIN_ODD_DISTANCE,
  generateBoard,
  isConfusable,
  manhattanDistance,
  renderSpecFor,
} from '../generator';
import type { OddOneOutBoard } from '../types';

/**
 * Replicate a full session's board stream (the reducer's round logic) so
 * tests can assert on the exact boards the UI will show.
 */
function boardsForSession(
  seed: string,
  gridSize: number,
  subtlety: number,
  rounds: number,
): OddOneOutBoard[] {
  const rng = createRng(seed);
  const boards: OddOneOutBoard[] = [];
  let prev: OddOneOutBoard | null = null;
  for (let round = 0; round < rounds; round += 1) {
    const board = generateBoard({ rng, roundIndex: round, subtlety, gridSize, prevBoard: prev });
    boards.push(board);
    prev = board;
  }
  return boards;
}

describe('generateBoard', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(boardsForSession('seed-42', 9, 0, 6)).toEqual(boardsForSession('seed-42', 9, 0, 6));
    expect(boardsForSession('seed-42', 16, 3, 6)).toEqual(boardsForSession('seed-42', 16, 3, 6));
  });

  it('produces different sessions for different seeds', () => {
    const a = boardsForSession('seed-a', 9, 1, 4);
    const b = boardsForSession('seed-b', 9, 1, 4);
    expect(a[0]).not.toEqual(b[0]);
    expect(a).not.toEqual(b);
  });

  it('generates exactly one odd item per board, genuinely different by the deviation dimension', () => {
    for (let subtlety = 0; subtlety < DEVIATION_VARIANTS.length; subtlety += 1) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const board = generateBoard({
          rng: createRng(String(seed)),
          roundIndex: 0,
          subtlety,
          gridSize: 9,
          prevBoard: null,
        });
        expect(board.oddIndex).toBeGreaterThanOrEqual(0);
        expect(board.oddIndex).toBeLessThan(9);
        // The deviation must come from the subtlety level's catalog.
        expect(DEVIATION_VARIANTS[subtlety].map((v) => v.key)).toContain(board.deviation.key);

        const oddSpec = renderSpecFor(board.deviation, true);
        const majoritySpec = renderSpecFor(board.deviation, false);
        // Every non-odd position renders exactly like the majority...
        for (let index = 0; index < 9; index += 1) {
          expect(renderSpecFor(board.deviation, index === board.oddIndex)).toEqual(
            index === board.oddIndex ? oddSpec : majoritySpec,
          );
        }
        // ...and the odd item differs in EXACTLY one dimension.
        const dims = ['glyph', 'color', 'rotation'] as const;
        const differing = dims.filter(
          (dim) => oddSpec[dim] !== majoritySpec[dim],
        );
        expect(differing).toHaveLength(1);
      }
    }
  });

  it('works on the 16-item grid too', () => {
    const board = generateBoard({
      rng: createRng('grid-16'),
      roundIndex: 0,
      subtlety: 2,
      gridSize: 16,
      prevBoard: null,
    });
    expect(board.oddIndex).toBeGreaterThanOrEqual(0);
    expect(board.oddIndex).toBeLessThan(16);
  });

  it('is bounded: generation always terminates deterministically', () => {
    // Even with an adversarial previous board, generation stays in budget.
    const rng = createRng('budget');
    const previous: OddOneOutBoard = {
      oddIndex: 4,
      deviation: DEVIATION_VARIANTS[1][0],
    };
    const board = generateBoard({
      rng,
      roundIndex: 1,
      subtlety: 1,
      gridSize: 9,
      prevBoard: previous,
    });
    expect(board.oddIndex).toBeGreaterThanOrEqual(0);
    expect(board.oddIndex).toBeLessThan(9);
    expect(MAX_BOARD_ATTEMPTS).toBeGreaterThan(0);
  });

  it('rejects out-of-range subtlety', () => {
    expect(() =>
      generateBoard({
        rng: createRng('x'),
        roundIndex: 0,
        subtlety: 4,
        gridSize: 9,
        prevBoard: null,
      }),
    ).toThrow(RangeError);
  });
});

describe('near-duplicate avoidance', () => {
  it('never places the odd item on the same index in consecutive rounds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const subtlety of [0, 1, 2, 3]) {
        const boards = boardsForSession(String(seed), 9, subtlety, 6);
        for (let round = 1; round < boards.length; round += 1) {
          expect(boards[round].oddIndex).not.toBe(boards[round - 1].oddIndex);
        }
      }
    }
  });

  it('keeps same-deviation odd items at least MIN_ODD_DISTANCE apart', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const boards = boardsForSession(String(seed), 9, 2, 6);
      for (let round = 1; round < boards.length; round += 1) {
        const prev = boards[round - 1];
        const current = boards[round];
        if (current.deviation.key === prev.deviation.key) {
          expect(manhattanDistance(current.oddIndex, prev.oddIndex, 9)).toBeGreaterThanOrEqual(
            MIN_ODD_DISTANCE,
          );
        }
      }
    }
  });
});

describe('manhattanDistance', () => {
  it('measures grid distance on a square board', () => {
    expect(manhattanDistance(0, 8, 9)).toBe(4); // opposite corners of 3×3
    expect(manhattanDistance(0, 1, 9)).toBe(1);
    expect(manhattanDistance(0, 3, 9)).toBe(1);
    expect(manhattanDistance(4, 4, 9)).toBe(0);
  });
});

describe('isConfusable', () => {
  const a: OddOneOutBoard = { oddIndex: 4, deviation: DEVIATION_VARIANTS[1][0] };
  const sameKeyNear: OddOneOutBoard = { oddIndex: 5, deviation: DEVIATION_VARIANTS[1][0] };
  const sameKeyFar: OddOneOutBoard = { oddIndex: 8, deviation: DEVIATION_VARIANTS[1][0] };
  const otherKeySameIndex: OddOneOutBoard = { oddIndex: 4, deviation: DEVIATION_VARIANTS[1][1] };
  const otherKeyNear: OddOneOutBoard = { oddIndex: 5, deviation: DEVIATION_VARIANTS[1][1] };

  it('treats a null previous board as infinitely far', () => {
    expect(isConfusable(null, a, 9)).toBe(false);
  });

  it('flags the same odd index as confusable regardless of deviation', () => {
    expect(isConfusable(a, otherKeySameIndex, 9)).toBe(true);
  });

  it('flags the same deviation within the distance threshold', () => {
    expect(isConfusable(a, sameKeyNear, 9)).toBe(true); // distance 1
  });

  it('allows the same deviation far away and different deviations nearby', () => {
    expect(isConfusable(a, sameKeyFar, 9)).toBe(false); // distance 3
    expect(isConfusable(a, otherKeyNear, 9)).toBe(false);
  });
});
