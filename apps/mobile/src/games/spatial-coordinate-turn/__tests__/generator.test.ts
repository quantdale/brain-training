// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  POSITION_OPTION_COUNT,
  directionsOrder,
  generateRound,
  generateSession,
  rotateDir,
  simulate,
  validateRound,
} from '../generator';
import { ADAPTIVE_PARAMS, DIFFICULTY_PARAMS } from '../difficulty';
import type { Command, SpatialCoordinateTurnDifficultyParams } from '../types';

describe('directionsOrder / rotateDir', () => {
  it('exposes the clockwise order for both direction sets', () => {
    expect(directionsOrder(4)).toEqual(['N', 'E', 'S', 'W']);
    expect(directionsOrder(8)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
  });

  it('rotates clockwise/right and counter-clockwise/left', () => {
    expect(rotateDir('N', 'right', 1, 4)).toBe('E');
    expect(rotateDir('N', 'left', 1, 4)).toBe('W');
    expect(rotateDir('N', 'right', 1, 8)).toBe('NE');
    expect(rotateDir('N', 'left', 1, 8)).toBe('NW');
  });

  it('wraps around the compass ring', () => {
    expect(rotateDir('W', 'right', 1, 4)).toBe('N');
    expect(rotateDir('N', 'left', 1, 4)).toBe('W');
    expect(rotateDir('NW', 'right', 1, 8)).toBe('N');
  });

  it('turns 180° with half the ring (about-face)', () => {
    expect(rotateDir('N', 'right', 2, 4)).toBe('S');
    expect(rotateDir('N', 'right', 4, 8)).toBe('S');
    expect(rotateDir('SE', 'right', 4, 8)).toBe('NW');
  });
});

describe('simulate', () => {
  it('applies turns and forward/back moves on the free plane', () => {
    // Facing N: right → E, forward 2 → (2, 0).
    const sim = simulate({ x: 0, y: 0 }, 'N', [
      { type: 'right' },
      { type: 'forward', steps: 2 },
    ], 4);
    expect(sim.finalPos).toEqual({ x: 2, y: 0 });
    expect(sim.finalHeading).toBe('E');
    expect(sim.turnCount).toBe(1);
  });

  it('moves backwards relative to the current heading', () => {
    // Facing S: back 3 → north 3 (y increases).
    const sim = simulate({ x: 1, y: 1 }, 'S', [{ type: 'back', steps: 3 }], 4);
    expect(sim.finalPos).toEqual({ x: 1, y: 4 });
    expect(sim.finalHeading).toBe('S');
    expect(sim.turnCount).toBe(0);
  });

  it('handles about-face and diagonal (8-way) movement', () => {
    const about = simulate({ x: 0, y: 0 }, 'N', [{ type: 'about' }], 4);
    expect(about.finalHeading).toBe('S');
    expect(about.turnCount).toBe(1);

    const diag = simulate({ x: 0, y: 0 }, 'NE', [{ type: 'forward', steps: 2 }], 8);
    expect(diag.finalPos).toEqual({ x: 2, y: 2 });
  });
});

describe('generateSession', () => {
  it('produces one round per configured round count', () => {
    expect(generateSession('len', DIFFICULTY_PARAMS.normal)).toHaveLength(10);
    expect(generateSession('len', DIFFICULTY_PARAMS.easy)).toHaveLength(8);
  });

  it('is deterministic for the same seed and diverges for different seeds', () => {
    const a = generateSession('det', DIFFICULTY_PARAMS.normal);
    const b = generateSession('det', DIFFICULTY_PARAMS.normal);
    expect(a).toEqual(b);

    const c = generateSession('other', DIFFICULTY_PARAMS.normal);
    expect(a).not.toEqual(c);
  });
});

describe('heading-option shuffle', () => {
  it('is deterministic per seed but varies across seeds (no fixed clockwise order)', () => {
    const a = generateSession('shuf-a', DIFFICULTY_PARAMS.normal);
    const b = generateSession('shuf-a', DIFFICULTY_PARAMS.normal);
    expect(a.map((r) => r.options)).toEqual(b.map((r) => r.options));

    const orders = new Set<string>();
    for (const seed of ['s1', 's2', 's3', 's4']) {
      for (const round of generateSession(seed, DIFFICULTY_PARAMS.easy)) {
        orders.add(round.options.join(','));
      }
    }
    // The pre-shuffle generator emitted exactly one fixed order.
    expect(orders.size).toBeGreaterThan(1);
  });

  it('spreads the correct index across positions (uniformity sanity over seeds)', () => {
    const counts = new Array<number>(4).fill(0);
    for (let i = 0; i < 40; i += 1) {
      for (const round of generateSession(`dist-${i}`, DIFFICULTY_PARAMS.easy)) {
        counts[round.correctIndex] += 1;
      }
    }
    // 320 heading rounds over 4 slots ≈ 80 each; every slot must occur far
    // above noise (>30 ≈ 6σ under uniformity). Fixed seeds ⇒ deterministic
    // assertion, never flaky; a fixed clockwise order would read [320,0,0,0].
    for (const count of counts) {
      expect(count).toBeGreaterThan(30);
    }
  });
});

describe('generateRound validity', () => {
  const levels: readonly (keyof typeof DIFFICULTY_PARAMS)[] = [
    'easy',
    'normal',
    'hard',
    'expert',
  ];

  function checkPlan(params: SpatialCoordinateTurnDifficultyParams, seed: string): void {
    const plan = generateSession(seed, params);
    for (const round of plan) {
      expect(validateRound(round)).toEqual([]);
    }
  }

  it('passes validateRound for every level and several seeds', () => {
    for (const level of levels) {
      for (const seed of ['v1', 'v2', 'v3']) {
        checkPlan(DIFFICULTY_PARAMS[level], seed);
      }
      checkPlan(ADAPTIVE_PARAMS, 'adaptive-seed');
    }
  });

  it('offers the full active direction set for heading tasks, shuffled', () => {
    const plan = generateSession('headings', DIFFICULTY_PARAMS.normal);
    for (const round of plan) {
      expect(round.task).toBe('heading');
      // Still a permutation of the active direction set…
      expect([...round.options].sort()).toEqual([...directionsOrder(4)].sort());
      // …and correctIndex tracks the final heading within the shuffled order.
      expect(round.options[round.correctIndex]).toBe(round.finalHeading);
    }
  });

  it('builds distinct 4-option coordinate sets for position tasks', () => {
    const plan = generateSession('positions', DIFFICULTY_PARAMS.expert);
    const positionRounds = plan.filter((r) => r.task === 'position');
    // Expert asks position on ~half the trials; the fixed seed guarantees some.
    expect(positionRounds.length).toBeGreaterThan(0);
    for (const round of positionRounds) {
      expect(round.options).toHaveLength(POSITION_OPTION_COUNT);
      const keys = round.options.map((c) => `${c.x},${c.y}`);
      expect(new Set(keys).size).toBe(POSITION_OPTION_COUNT);
      expect(round.options[round.correctIndex]).toEqual(round.finalPos);
    }
  });

  it('never produces position tasks when askPosition is false', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const plan = generateSession(`no-pos-${level}`, DIFFICULTY_PARAMS[level]);
      for (const round of plan) {
        expect(round.task).toBe('heading');
      }
    }
  });

  it('keeps command counts and move distances inside the difficulty bounds', () => {
    for (const level of levels) {
      const params = DIFFICULTY_PARAMS[level];
      const plan = generateSession(`bounds-${level}`, params);
      for (const round of plan) {
        expect(round.commandCount).toBeGreaterThanOrEqual(params.minSteps);
        expect(round.commandCount).toBeLessThanOrEqual(params.maxSteps);
        for (const command of round.commands as readonly Command[]) {
          if (command.type === 'forward' || command.type === 'back') {
            expect(command.steps).toBeGreaterThanOrEqual(1);
            expect(command.steps!).toBeLessThanOrEqual(params.moveMax);
          }
        }
      }
    }
  });

  it('guarantees a mix of turns and moves in every round', () => {
    const plan = generateSession('mix', DIFFICULTY_PARAMS.expert);
    for (const round of plan) {
      const hasTurn = round.commands.some(
        (c) => c.type === 'left' || c.type === 'right' || c.type === 'about',
      );
      const hasMove = round.commands.some(
        (c) => c.type === 'forward' || c.type === 'back',
      );
      expect(hasTurn).toBe(true);
      expect(hasMove).toBe(true);
    }
  });

  it('starts every round at the origin (free plane ⇒ always valid)', () => {
    const plan = generateSession('origin', DIFFICULTY_PARAMS.hard);
    for (const round of plan) {
      expect(round.start).toEqual({ x: 0, y: 0 });
    }
  });
});

describe('validateRound rejections', () => {
  it('flags a corrupted correctIndex', () => {
    const base = generateRound(createRng('corr'), DIFFICULTY_PARAMS.normal, 0);
    const badIndex: typeof base = {
      ...base,
      correctIndex: (base.correctIndex + 1) % base.options.length,
    };
    expect(validateRound(badIndex).length).toBeGreaterThan(0);
  });

  it('flags duplicated options and a wrong final heading', () => {
    const base = generateRound(createRng('corr2'), DIFFICULTY_PARAMS.normal, 0);
    expect(base.task).toBe('heading');

    const duplicated = {
      ...base,
      options: base.options.map(() => base.options[0]),
    } as typeof base;
    expect(validateRound(duplicated).length).toBeGreaterThan(0);

    const wrongHeading = {
      ...base,
      finalHeading: base.finalHeading === 'N' ? 'E' : 'N',
    } as typeof base;
    expect(validateRound(wrongHeading).length).toBeGreaterThan(0);
  });
});
