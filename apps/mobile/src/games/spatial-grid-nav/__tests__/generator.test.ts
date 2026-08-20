// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  CANDIDATE_COUNT,
  MAX_GENERATE_ATTEMPTS,
  generateRound,
  generateSession,
  inBounds,
  rotateDir,
  simulate,
  validateRound,
} from '../generator';
import { ADAPTIVE_PARAMS, DIFFICULTY_PARAMS } from '../difficulty';
import type { Cell, Command, Dir, SpatialGridNavDifficultyParams } from '../types';

/** Walk every intermediate position and confirm the marker stays in bounds. */
function walkInBounds(start: Cell, startDir: Dir, commands: readonly Command[], side: number): boolean {
  const dirDelta: Record<Dir, { dr: number; dc: number }> = {
    N: { dr: -1, dc: 0 },
    E: { dr: 0, dc: 1 },
    S: { dr: 1, dc: 0 },
    W: { dr: 0, dc: -1 },
  };
  const rotate: Record<Dir, Dir> = { N: 'E', E: 'S', S: 'W', W: 'N' };
  let row = start.row;
  let col = start.col;
  let dir = startDir;
  if (!inBounds({ row, col }, side)) return false;
  for (const command of commands) {
    if (command.type === 'left' || command.type === 'right') {
      dir = command.type === 'right' ? rotate[dir] : (rotateDir(dir, 'left') as Dir);
    } else {
      const step = command.type === 'forward' ? 1 : -1;
      const { dr, dc } = dirDelta[dir];
      row += dr * step;
      col += dc * step;
    }
    if (!inBounds({ row, col }, side)) return false;
  }
  return true;
}

const ALL_PARAM_SETS: SpatialGridNavDifficultyParams[] = [
  DIFFICULTY_PARAMS.easy,
  DIFFICULTY_PARAMS.normal,
  DIFFICULTY_PARAMS.hard,
  DIFFICULTY_PARAMS.expert,
  ADAPTIVE_PARAMS,
];

describe('rotateDir', () => {
  it('rotates clockwise for right and counter-clockwise for left', () => {
    expect(rotateDir('N', 'right')).toBe('E');
    expect(rotateDir('E', 'right')).toBe('S');
    expect(rotateDir('S', 'right')).toBe('W');
    expect(rotateDir('W', 'right')).toBe('N');
    expect(rotateDir('N', 'left')).toBe('W');
    expect(rotateDir('W', 'left')).toBe('S');
  });
});

describe('inBounds', () => {
  it('accepts in-range cells and rejects out-of-range cells', () => {
    expect(inBounds({ row: 0, col: 0 }, 5)).toBe(true);
    expect(inBounds({ row: 4, col: 4 }, 5)).toBe(true);
    expect(inBounds({ row: -1, col: 0 }, 5)).toBe(false);
    expect(inBounds({ row: 0, col: 5 }, 5)).toBe(false);
  });
});

describe('simulate', () => {
  it('moves forward and back relative to facing', () => {
    const forward = simulate({ row: 2, col: 2 }, 'N', [{ type: 'forward' }], 5);
    expect(forward.finalCell).toEqual({ row: 1, col: 2 });
    const back = simulate({ row: 2, col: 2 }, 'N', [{ type: 'back' }], 5);
    expect(back.finalCell).toEqual({ row: 3, col: 2 });
    const turnAndMove = simulate(
      { row: 2, col: 2 },
      'N',
      [{ type: 'right' }, { type: 'forward' }],
      5,
    );
    expect(turnAndMove.finalCell).toEqual({ row: 2, col: 3 });
    expect(turnAndMove.turnCount).toBe(1);
  });
});

describe('generateSession determinism', () => {
  it('produces the same plan for the same seed', () => {
    const a = generateSession('seed-1', DIFFICULTY_PARAMS.normal);
    const b = generateSession('seed-1', DIFFICULTY_PARAMS.normal);
    expect(a).toEqual(b);
    expect(a).toHaveLength(DIFFICULTY_PARAMS.normal.rounds);
  });

  it('produces different plans for different seeds', () => {
    const a = generateSession('seed-a', DIFFICULTY_PARAMS.normal);
    const b = generateSession('seed-b', DIFFICULTY_PARAMS.normal);
    expect(a).not.toEqual(b);
  });

  it('exposes the full plan with all required fields', () => {
    const plan = generateSession('fields', DIFFICULTY_PARAMS.normal);
    const round = plan[0];
    expect(round.start).toBeDefined();
    expect(round.startDir).toBeDefined();
    expect(round.commands.length).toBe(round.commandCount);
    expect(round.options.length).toBe(DIFFICULTY_PARAMS.normal.options);
    expect(round.options[round.correctIndex]).toEqual(round.finalCell);
  });
});

describe('validateRound across seeds and difficulties', () => {
  it('every generated round is valid and stays in bounds', () => {
    for (const params of ALL_PARAM_SETS) {
      for (let seed = 0; seed < 50; seed += 1) {
        const plan = generateSession(`gen-${seed}`, params);
        expect(plan).toHaveLength(params.rounds);
        for (const round of plan) {
          const problems = validateRound(round, params.gridSide);
          expect(problems).toEqual([]);
          expect(walkInBounds(round.start, round.startDir, round.commands, params.gridSide)).toBe(true);
          expect(round.commandCount).toBeGreaterThanOrEqual(params.minCommandCount);
          expect(round.commandCount).toBeLessThanOrEqual(params.maxCommandCount);
          expect(round.options).toHaveLength(params.options);
          // Exactly one correct option at correctIndex.
          const correctCount = round.options.filter(
            (o) => o.row === round.finalCell.row && o.col === round.finalCell.col,
          ).length;
          expect(correctCount).toBe(1);
          expect(round.options[round.correctIndex]).toEqual(round.finalCell);
        }
      }
    }
  });
});

describe('generateRound bounds and termination', () => {
  it('respects command-count bounds across difficulties', () => {
    for (const params of ALL_PARAM_SETS) {
      const rng = createRng('bounds');
      for (let i = 0; i < 20; i += 1) {
        const round = generateRound(rng, params, i);
        expect(round.commandCount).toBeGreaterThanOrEqual(params.minCommandCount);
        expect(round.commandCount).toBeLessThanOrEqual(params.maxCommandCount);
      }
    }
  });

  it('is bounded: generation always terminates with a valid round', () => {
    const round = generateRound(createRng('budget'), DIFFICULTY_PARAMS.expert, 0);
    expect(round.commands.length).toBeGreaterThan(0);
    expect(validateRound(round, DIFFICULTY_PARAMS.expert.gridSide)).toEqual([]);
    expect(MAX_GENERATE_ATTEMPTS).toBeGreaterThan(0);
    expect(CANDIDATE_COUNT).toBe(4);
  });
});
