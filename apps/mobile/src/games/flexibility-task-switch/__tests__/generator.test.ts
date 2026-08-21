// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  flexibilityTaskSwitchParamsFromProfile,
  resolveFlexibilityTaskSwitchDifficulty,
} from '../difficulty';
import { generateRound, generateSession, validatePlan, validateRound } from '../generator';
import { TASK_ANSWERS, TOKEN_COLORS, TOKEN_SHAPES, correctAnswerFor } from '../types';
import type { FlexibilityTaskSwitchDifficultyParams, GeneratedRound } from '../types';

const NORMAL = flexibilityTaskSwitchParamsFromProfile(
  resolveFlexibilityTaskSwitchDifficulty('normal'),
);

function paramsWith(overrides: Partial<FlexibilityTaskSwitchDifficultyParams>): FlexibilityTaskSwitchDifficultyParams {
  return { ...NORMAL, ...overrides };
}

describe('generateSession', () => {
  it('builds exactly `rounds` rounds', () => {
    expect(generateSession('len-easy', paramsWith({ rounds: 10 }))).toHaveLength(10);
    expect(generateSession('len-expert', paramsWith({ rounds: 14 }))).toHaveLength(14);
  });

  it('is deterministic: same seed → identical plan', () => {
    const a = generateSession('det', NORMAL);
    const b = generateSession('det', NORMAL);
    expect(a).toEqual(b);
  });

  it('diverges for different seeds', () => {
    const a = generateSession('seed-A', NORMAL);
    const b = generateSession('seed-B', NORMAL);
    expect(a).not.toEqual(b);
  });

  it('produces structurally valid rounds within the active alphabet', () => {
    const plan = generateSession('valid', NORMAL);
    for (let i = 0; i < plan.length; i += 1) {
      const round = plan[i];
      expect(validateRound(round, NORMAL.numColors, NORMAL.numShapes)).toEqual([]);
      expect(round.options).toEqual(TASK_ANSWERS[round.task]);
      expect(round.token.number).toBeGreaterThanOrEqual(1);
      expect(round.token.number).toBeLessThanOrEqual(NORMAL.numNumbers);
      expect(TOKEN_COLORS.slice(0, NORMAL.numColors)).toContain(round.token.color);
      expect(TOKEN_SHAPES.slice(0, NORMAL.numShapes)).toContain(round.token.shape);
      expect(correctAnswerFor(round.task, round.token)).toBe(round.options[round.correctIndex]);
    }
  });

  it('never marks round 0 as a switch trial', () => {
    for (const seed of ['sw-1', 'sw-2', 'sw-3']) {
      expect(generateSession(seed, NORMAL)[0].isSwitch).toBe(false);
    }
  });

  it('switchRate = 1 switches on every trial after the first (pool ≥ 2)', () => {
    const plan = generateSession('all-switch', paramsWith({ switchRate: 1, taskPool: ['parity', 'magnitude'] }));
    expect(plan.length).toBeGreaterThan(1);
    for (let i = 1; i < plan.length; i += 1) {
      expect(plan[i].task).not.toBe(plan[i - 1].task);
      expect(plan[i].isSwitch).toBe(true);
    }
  });

  it('switchRate = 0 never switches', () => {
    const plan = generateSession('no-switch', paramsWith({ switchRate: 0 }));
    for (const round of plan) {
      expect(round.isSwitch).toBe(false);
      if (plan.indexOf(round) > 0) {
        expect(round.task).toBe(plan[plan.indexOf(round) - 1].task);
      }
    }
  });
});

describe('generateRound', () => {
  it('matches the session plan for the same seed position', () => {
    const seed = 'pos';
    const plan = generateSession(seed, NORMAL);
    // Each round derives from forked streams; replaying the parent stream
    // round-by-round reproduces the same content.
    const rng = createRng(seed);
    let prevTask: GeneratedRound['task'] | null = null;
    for (let i = 0; i < plan.length; i += 1) {
      const round = generateRound(rng, i, prevTask, NORMAL);
      expect(round).toEqual(plan[i]);
      prevTask = round.task;
    }
  });

  it('throws when a generated round violates its invariants', () => {
    // Force a violation by shrinking the alphabet below what validation allows:
    // numNumbers 9 is fine, but a pool with zero tasks makes pick() throw.
    expect(() =>
      generateRound(createRng('x'), 0, null, paramsWith({ taskPool: [] })),
    ).toThrow();
  });
});

describe('validateRound', () => {
  const base = generateSession('validate', NORMAL)[0];

  it('accepts a valid round', () => {
    expect(validateRound(base, NORMAL.numColors, NORMAL.numShapes)).toEqual([]);
  });

  it('rejects a wrong correctIndex', () => {
    const bad = { ...base, correctIndex: (base.correctIndex + 1) % base.options.length };
    expect(validateRound(bad, NORMAL.numColors, NORMAL.numShapes)).toContainEqual(
      'correctIndex does not point at the correct option',
    );
  });

  it('rejects an out-of-range or non-integer correctIndex', () => {
    const far = { ...base, correctIndex: base.options.length + 5 };
    expect(validateRound(far, NORMAL.numColors, NORMAL.numShapes).join(' ')).toMatch(/out of range/);
    const frac = { ...base, correctIndex: 0.5 };
    expect(validateRound(frac, NORMAL.numColors, NORMAL.numShapes).join(' ')).toMatch(/out of range/);
  });

  it('rejects duplicate options', () => {
    const bad: GeneratedRound = {
      task: 'parity',
      token: { number: 2, color: 'red', shape: 'circle' },
      options: ['Even', 'Even'],
      correctIndex: 0,
      isSwitch: false,
    };
    expect(validateRound(bad, 3, 3).join(' ')).toMatch(/duplicate option "Even"/);
  });

  it('rejects a missing correct option', () => {
    const bad: GeneratedRound = {
      task: 'parity',
      token: { number: 2, color: 'red', shape: 'circle' },
      options: ['Odd', 'Low'],
      correctIndex: 0,
      isSwitch: false,
    };
    const violations = validateRound(bad, 3, 3);
    expect(violations.join(' ')).toMatch(/exactly one correct option/);
  });

  it('rejects an unexpected option count', () => {
    const bad: GeneratedRound = {
      task: 'parity',
      token: { number: 2, color: 'red', shape: 'circle' },
      options: ['Even', 'Odd', 'Red', 'Blue'],
      correctIndex: 0,
      isSwitch: false,
    };
    expect(validateRound(bad, 3, 3).join(' ')).toMatch(/expected 2 options, got 4/);
  });

  it('rejects tokens outside the active alphabet', () => {
    const yellow: GeneratedRound = { ...base, token: { ...base.token, color: 'yellow' } };
    expect(validateRound(yellow, 3, 3).join(' ')).toMatch(/color is outside the active alphabet/);
    const star: GeneratedRound = { ...base, token: { ...base.token, shape: 'star' } };
    expect(validateRound(star, 3, 3).join(' ')).toMatch(/shape is outside the active alphabet/);
    const zero: GeneratedRound = { ...base, token: { ...base.token, number: 0 } };
    expect(validateRound(zero, 3, 3).join(' ')).toMatch(/number 0 out of range/);
    const ten: GeneratedRound = { ...base, token: { ...base.token, number: 10 } };
    expect(validateRound(ten, 3, 3).join(' ')).toMatch(/number 10 out of range/);
  });
});

describe('validatePlan', () => {
  it('accepts a generated plan', () => {
    expect(validatePlan(generateSession('plan-ok', NORMAL))).toEqual([]);
  });

  it('flags inconsistent isSwitch flags', () => {
    const plan = generateSession('plan-bad', NORMAL);
    const firstSwitch = plan.findIndex((r, i) => i > 0 && r.isSwitch);
    expect(firstSwitch).toBeGreaterThan(0);
    const tampered: GeneratedRound[] = plan.map((r, i) =>
      i === firstSwitch ? { ...r, isSwitch: false } : r,
    );
    expect(validatePlan(tampered).join(' ')).toMatch(new RegExp(`round ${firstSwitch}`));
  });
});
