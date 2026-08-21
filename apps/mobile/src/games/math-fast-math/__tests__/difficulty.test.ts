// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_MAX_STEP,
  ADAPTIVE_MIN_STEP,
  ADAPTIVE_PARAMS,
  MATH_DIFFICULTY_PARAMS,
  adaptiveParamsForStep,
  mathParamsForLevel,
  mathParamsFromProfile,
  mathParamsToRecord,
  operatorsForStep,
  resolveMathDifficulty,
  sessionChallengeRating,
} from '../difficulty';
import { OPERATORS } from '../types';
import type { MathDifficultyParams } from '../types';

describe('Fast Math difficulty parameter mapping', () => {
  it('maps each fixed level to concrete rounds/budget/mix/ranges tuning', () => {
    expect(MATH_DIFFICULTY_PARAMS.easy).toEqual({
      rounds: 4,
      timeBudgetMs: 10_000,
      operators: ['+', '−'],
      ranges: {
        '+': { maxLeft: 10, maxRight: 10 },
        '−': { maxLeft: 10, maxRight: 10 },
        '×': { maxLeft: 6, maxRight: 6 },
        '÷': { maxLeft: 25, maxRight: 5 },
      },
    });
    expect(MATH_DIFFICULTY_PARAMS.normal).toEqual({
      rounds: 5,
      timeBudgetMs: 8_000,
      operators: ['+', '−', '×'],
      ranges: {
        '+': { maxLeft: 12, maxRight: 12 },
        '−': { maxLeft: 12, maxRight: 12 },
        '×': { maxLeft: 9, maxRight: 9 },
        '÷': { maxLeft: 64, maxRight: 8 },
      },
    });
    expect(MATH_DIFFICULTY_PARAMS.hard).toEqual({
      rounds: 6,
      timeBudgetMs: 6_000,
      operators: ['+', '−', '×', '÷'],
      ranges: {
        '+': { maxLeft: 20, maxRight: 20 },
        '−': { maxLeft: 20, maxRight: 20 },
        '×': { maxLeft: 12, maxRight: 12 },
        '÷': { maxLeft: 100, maxRight: 10 },
      },
    });
    expect(MATH_DIFFICULTY_PARAMS.expert).toEqual({
      rounds: 7,
      timeBudgetMs: 4_000,
      operators: ['+', '−', '×', '÷'],
      ranges: {
        '+': { maxLeft: 30, maxRight: 30 },
        '−': { maxLeft: 30, maxRight: 30 },
        '×': { maxLeft: 15, maxRight: 15 },
        '÷': { maxLeft: 169, maxRight: 13 },
      },
      twoStepChance: 0.35,
    });
  });

  it('defines adaptive tuning with difficulty-step bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      rounds: 6,
      timeBudgetMs: 8_000,
      operators: ['+', '−'],
      ranges: {
        '+': { maxLeft: 12, maxRight: 12 },
        '−': { maxLeft: 12, maxRight: 12 },
        '×': { maxLeft: 9, maxRight: 9 },
        '÷': { maxLeft: 100, maxRight: 8 },
      },
      minStep: 0,
      maxStep: 4,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveMathDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
      expect(profile.parameters).toEqual(mathParamsToRecord(mathParamsForLevel(level)));
    }
    const adaptive = resolveMathDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
    expect(adaptive.parameters).toEqual(mathParamsToRecord(ADAPTIVE_PARAMS));
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = mathParamsForLevel('easy');
    const b = mathParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(MATH_DIFFICULTY_PARAMS.easy);
  });

  it('round-trips parameters through a resolved profile', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = mathParamsFromProfile(resolveMathDifficulty(level));
      expect(params).toEqual(mathParamsForLevel(level));
    }
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveMathDifficulty('normal');
    const incomplete = { ...profile.parameters };
    delete incomplete['maxLeft_×'];
    expect(() => mathParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /maxLeft_×/,
    );
  });

  it('rejects invalid operator masks', () => {
    const base = resolveMathDifficulty('normal').parameters;
    expect(() =>
      mathParamsFromProfile({ level: 'normal', challengeRating: 0.5, parameters: { ...base, operatorMask: 0 } }),
    ).toThrow(/operatorMask/);
    expect(() =>
      mathParamsFromProfile({ level: 'normal', challengeRating: 0.5, parameters: { ...base, operatorMask: 16 } }),
    ).toThrow(/operatorMask/);
  });

  it('keeps the ÷ config invariant (maxLeft ≥ maxRight²) for every fixed level', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const div = MATH_DIFFICULTY_PARAMS[level].ranges['÷'];
      expect(div.maxLeft).toBeGreaterThanOrEqual(div.maxRight * div.maxRight);
    }
  });
});

describe('adaptiveParamsForStep', () => {
  it('step 0 equals the adaptive base', () => {
    expect(adaptiveParamsForStep(ADAPTIVE_PARAMS, 0)).toEqual(ADAPTIVE_PARAMS);
  });

  it('the top step interpolates to the expert ranges with the base round count', () => {
    const derived = adaptiveParamsForStep(ADAPTIVE_PARAMS, ADAPTIVE_MAX_STEP);
    expect(derived.ranges).toEqual(MATH_DIFFICULTY_PARAMS.expert.ranges);
    expect(derived.timeBudgetMs).toBe(4_000);
    expect(derived.operators).toEqual(OPERATORS);
    expect(derived.rounds).toBe(ADAPTIVE_PARAMS.rounds);
    // The two-step tier ramps in with the ranges toward the expert chance.
    expect(derived.twoStepChance).toBe(MATH_DIFFICULTY_PARAMS.expert.twoStepChance);
  });

  it('grows monotonically: wider ranges and a tighter budget per step', () => {
    const budgets: number[] = [];
    const maxLefts: number[] = [];
    for (let step = ADAPTIVE_MIN_STEP; step <= ADAPTIVE_MAX_STEP; step += 1) {
      const params = adaptiveParamsForStep(ADAPTIVE_PARAMS, step);
      budgets.push(params.timeBudgetMs as number);
      maxLefts.push(params.ranges['+'].maxLeft);
    }
    for (let i = 1; i < budgets.length; i += 1) {
      expect(budgets[i]).toBeLessThanOrEqual(budgets[i - 1]);
      expect(maxLefts[i]).toBeGreaterThanOrEqual(maxLefts[i - 1]);
    }
  });

  it('keeps the ÷ config invariant at every step', () => {
    for (let step = ADAPTIVE_MIN_STEP; step <= ADAPTIVE_MAX_STEP; step += 1) {
      const div = adaptiveParamsForStep(ADAPTIVE_PARAMS, step).ranges['÷'];
      expect(div.maxLeft).toBeGreaterThanOrEqual(div.maxRight * div.maxRight);
    }
  });

  it('clamps steps outside the bounds deterministically', () => {
    expect(adaptiveParamsForStep(ADAPTIVE_PARAMS, -5)).toEqual(adaptiveParamsForStep(ADAPTIVE_PARAMS, 0));
    expect(adaptiveParamsForStep(ADAPTIVE_PARAMS, 99)).toEqual(
      adaptiveParamsForStep(ADAPTIVE_PARAMS, ADAPTIVE_MAX_STEP),
    );
  });
});

describe('operatorsForStep', () => {
  it('grows the operator mix with the step', () => {
    expect(operatorsForStep(0)).toEqual(['+', '−']);
    expect(operatorsForStep(1)).toEqual(['+', '−']);
    expect(operatorsForStep(2)).toEqual(['+', '−', '×']);
    expect(operatorsForStep(3)).toEqual(['+', '−', '×']);
    expect(operatorsForStep(4)).toEqual(OPERATORS);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveMathDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 3)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final step linearly into [0, 1]', () => {
    const profile = resolveMathDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 0)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 2)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 4)).toBe(1);
  });
});
