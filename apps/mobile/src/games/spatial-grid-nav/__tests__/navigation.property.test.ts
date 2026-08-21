// Property/invariant tests for the Grid Navigator navigation algebra.
//
// The rotation group on 4 compass directions is provable: right×4 = identity,
// left is the inverse of right, and the generator's bounding-box start
// placement guarantees every visited cell stays in bounds — asserted here
// across many seeded sessions.
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { generateRound, generateSession, inBounds, rotateDir, simulate, validateRound } from '../generator';
import { DIFFICULTY_PARAMS } from '../difficulty';
import type { Cell, Command, Dir } from '../types';

describe('direction rotation algebra', () => {
  const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

  it('four right turns are the identity', () => {
    for (const dir of DIRS) {
      let d = dir;
      for (let i = 0; i < 4; i += 1) {
        d = rotateDir(d, 'right');
      }
      expect(d).toBe(dir);
    }
  });

  it('four left turns are the identity', () => {
    for (const dir of DIRS) {
      let d = dir;
      for (let i = 0; i < 4; i += 1) {
        d = rotateDir(d, 'left');
      }
      expect(d).toBe(dir);
    }
  });

  it('left is the inverse of right', () => {
    for (const dir of DIRS) {
      expect(rotateDir(rotateDir(dir, 'right'), 'left')).toBe(dir);
      expect(rotateDir(rotateDir(dir, 'left'), 'right')).toBe(dir);
    }
  });

  it('right and left agree with the compass (N→E clockwise)', () => {
    expect(rotateDir('N', 'right')).toBe('E');
    expect(rotateDir('E', 'right')).toBe('S');
    expect(rotateDir('N', 'left')).toBe('W');
  });
});

describe('simulate matches step-by-step walking', () => {
  it('finalCell equals a manual walk of the same commands', () => {
    const DELTA: Record<Dir, { dr: number; dc: number }> = {
      N: { dr: -1, dc: 0 },
      E: { dr: 0, dc: 1 },
      S: { dr: 1, dc: 0 },
      W: { dr: 0, dc: -1 },
    };
    const rng = createRng('simulate-walk');
    for (let trial = 0; trial < 40; trial += 1) {
      const startDir = rng.pick(['N', 'E', 'S', 'W'] as const);
      const commands: Command[] = Array.from({ length: rng.nextInt(8) + 1 }, () => {
        const roll = rng.next();
        if (roll < 0.4) return { type: rng.next() < 0.5 ? 'left' : 'right' };
        return { type: rng.next() < 0.7 ? 'forward' : 'back' };
      });
      const start: Cell = { row: rng.nextInt(10), col: rng.nextInt(10) };

      // Manual walk.
      let row = start.row;
      let col = start.col;
      let dir = startDir;
      for (const command of commands) {
        if (command.type === 'left' || command.type === 'right') {
          dir = rotateDir(dir, command.type);
        } else {
          const step = command.type === 'forward' ? 1 : -1;
          row += DELTA[dir].dr * step;
          col += DELTA[dir].dc * step;
        }
      }

      const sim = simulate(start, startDir, commands, 10);
      expect(sim.finalCell.row).toBe(row);
      expect(sim.finalCell.col).toBe(col);
    }
  });
});

describe('generated sessions keep the whole path in bounds', () => {
  for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
    it(`validates every round of a ${level} session`, () => {
      const params = DIFFICULTY_PARAMS[level];
      const plan = generateSession(`nav-${level}`, params);
      expect(plan).toHaveLength(params.rounds);
      for (const round of plan) {
        expect(validateRound(round, params.gridSide)).toEqual([]);
        // Replay the walk and assert EVERY visited cell is in bounds (the
        // bounding-box start guarantee).
        let row = round.start.row;
        let col = round.start.col;
        let dir = round.startDir;
        expect(inBounds({ row, col }, params.gridSide)).toBe(true);
        for (const command of round.commands) {
          if (command.type === 'left' || command.type === 'right') {
            dir = rotateDir(dir, command.type);
          } else {
            const step = command.type === 'forward' ? 1 : -1;
            switch (dir) {
              case 'N': row -= step; break;
              case 'S': row += step; break;
              case 'E': col += step; break;
              case 'W': col -= step; break;
            }
            expect(inBounds({ row, col }, params.gridSide)).toBe(true);
          }
        }
        expect(row).toBe(round.finalCell.row);
        expect(col).toBe(round.finalCell.col);
      }
    });
  }

  it('generates distinct options with exactly one correct per round', () => {
    const params = DIFFICULTY_PARAMS.normal;
    for (let i = 0; i < 20; i += 1) {
      const round = generateRound(createRng(`options:${i}`), params, i);
      const unique = new Set(round.options.map((c) => `${c.row},${c.col}`));
      expect(unique.size).toBe(round.options.length);
      const correctCount = round.options.filter((c) => c.row === round.finalCell.row && c.col === round.finalCell.col).length;
      expect(correctCount).toBe(1);
      expect(round.correctIndex).toBeGreaterThanOrEqual(0);
      expect(round.correctIndex).toBeLessThan(round.options.length);
    }
  });
});
