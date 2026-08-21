// Property/invariant tests for the Coordinate Turn navigation algebra.
//
// The 4/8-direction rotation group and the free-plane simulator are
// mathematically provable: right×N = identity, left inverts right, about-face
// is a half turn, and simulate() matches a manual step-by-step walk. The
// generator's validateRound contract is asserted across many seeded sessions.
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  directionsOrder,
  generateRound,
  generateSession,
  rotateDir,
  simulate,
  validateRound,
} from '../generator';
import { resolveSpatialCoordinateTurnDifficulty, spatialCoordinateTurnParamsFromProfile } from '../difficulty';
import type { Command, Coord, Dir } from '../types';

function paramsForLevel(level: 'easy' | 'normal' | 'hard' | 'expert') {
  return spatialCoordinateTurnParamsFromProfile(resolveSpatialCoordinateTurnDifficulty(level));
}

describe('direction rotation algebra (4 directions)', () => {
  const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

  it('four right turns are the identity', () => {
    for (const dir of DIRS) {
      let d = dir;
      for (let i = 0; i < 4; i += 1) {
        d = rotateDir(d, 'right', 1, 4);
      }
      expect(d).toBe(dir);
    }
  });

  it('left is the inverse of right; about-face equals two right turns', () => {
    for (const dir of DIRS) {
      expect(rotateDir(rotateDir(dir, 'right', 1, 4), 'left', 1, 4)).toBe(dir);
      expect(rotateDir(dir, 'right', 2, 4)).toBe(rotateDir(dir, 'left', 2, 4));
    }
  });

  it('right and left agree with the compass (N→E clockwise)', () => {
    expect(rotateDir('N', 'right', 1, 4)).toBe('E');
    expect(rotateDir('E', 'right', 1, 4)).toBe('S');
    expect(rotateDir('N', 'left', 1, 4)).toBe('W');
    expect(directionsOrder(4)).toEqual(['N', 'E', 'S', 'W']);
  });
});

describe('direction rotation algebra (8 directions)', () => {
  it('eight right turns are the identity; about-face equals four', () => {
    for (const dir of directionsOrder(8)) {
      let d = dir;
      for (let i = 0; i < 8; i += 1) {
        d = rotateDir(d, 'right', 1, 8);
      }
      expect(d).toBe(dir);
      expect(rotateDir(dir, 'right', 4, 8)).toBe(rotateDir(dir, 'left', 4, 8));
    }
  });

  it('intercardinals sit between their cardinals in clockwise order', () => {
    expect(rotateDir('N', 'right', 1, 8)).toBe('NE');
    expect(rotateDir('NE', 'right', 1, 8)).toBe('E');
    expect(rotateDir('N', 'left', 1, 8)).toBe('NW');
  });
});

describe('simulate matches step-by-step walking on the free plane', () => {
  it('finalPos/finalHeading equal a manual walk of the same commands', () => {
    const DELTA: Record<Dir, { dx: number; dy: number }> = {
      N: { dx: 0, dy: 1 },
      NE: { dx: 1, dy: 1 },
      E: { dx: 1, dy: 0 },
      SE: { dx: 1, dy: -1 },
      S: { dx: 0, dy: -1 },
      SW: { dx: -1, dy: -1 },
      W: { dx: -1, dy: 0 },
      NW: { dx: -1, dy: 1 },
    };
    const rng = createRng('coord-walk');
    for (let trial = 0; trial < 40; trial += 1) {
      const startDir = rng.pick(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const);
      const commands: Command[] = Array.from({ length: rng.nextInt(7) + 1 }, () => {
        const roll = rng.next();
        if (roll < 0.35) return { type: rng.next() < 0.5 ? 'left' : 'right' };
        if (roll < 0.5) return { type: 'about' };
        return { type: rng.next() < 0.6 ? 'forward' : 'back', steps: rng.nextInt(3) + 1 };
      });
      const start: Coord = { x: rng.nextInt(11) - 5, y: rng.nextInt(11) - 5 };

      // Manual walk.
      let x = start.x;
      let y = start.y;
      let dir = startDir;
      let turns = 0;
      for (const command of commands) {
        if (command.type === 'left' || command.type === 'right') {
          dir = rotateDir(dir, command.type, 1, 8);
          turns += 1;
        } else if (command.type === 'about') {
          dir = rotateDir(dir, 'right', 4, 8);
          turns += 1;
        } else {
          const sign = command.type === 'forward' ? 1 : -1;
          const steps = command.steps ?? 1;
          x += DELTA[dir].dx * sign * steps;
          y += DELTA[dir].dy * sign * steps;
        }
      }

      const sim = simulate(start, startDir, commands, 8);
      expect(sim.finalPos.x).toBe(x);
      expect(sim.finalPos.y).toBe(y);
      expect(sim.finalHeading).toBe(dir);
      expect(sim.turnCount).toBe(turns);
    }
  });
});

describe('generated sessions satisfy validateRound', () => {
  for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
    it(`validates every round of a ${level} session`, () => {
      const params = paramsForLevel(level);
      const plan = generateSession(`turn-${level}`, params);
      expect(plan).toHaveLength(params.rounds);
      for (const round of plan) {
        expect(validateRound(round)).toEqual([]);
      }
    });
  }

  it('produces distinct options with exactly one correct per round', () => {
    const params = paramsForLevel('expert'); // askPosition on
    for (let i = 0; i < 24; i += 1) {
      const round = generateRound(createRng(`turn-options:${i}`), params, i);
      const keys = round.options.map((o) =>
        round.task === 'heading' ? String(o) : `${(o as Coord).x},${(o as Coord).y}`,
      );
      expect(new Set(keys).size).toBe(keys.length);
      const correct =
        round.task === 'heading'
          ? round.options.filter((o) => o === round.finalHeading).length
          : round.options.filter(
              (o) => (o as Coord).x === round.finalPos.x && (o as Coord).y === round.finalPos.y,
            ).length;
      expect(correct).toBe(1);
    }
  });
});
