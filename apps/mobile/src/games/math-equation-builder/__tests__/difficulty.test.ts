// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { DEFAULT_CHALLENGE_RATINGS } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS,
  mathEquationBuilderParamsForLevel,
  mathEquationBuilderParamsFromProfile,
  nextAdaptiveParams,
  resolveMathEquationBuilderDifficulty,
  sessionChallengeRating,
} from '../difficulty';
import type { MathEquationBuilderDifficultyParams } from '../types';

describe('Equation Builder difficulty parameter mapping', () => {
  it('maps each fixed level to concrete tuning', () => {
    expect(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.easy).toEqual({
      numbersCount: 3,
      targetMin: 10,
      targetMax: 30,
      operators: ['+', '-'],
      rounds: 4,
      timeBudgetMs: 60_000,
    });
    expect(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal).toEqual({
      numbersCount: 4,
      targetMin: 10,
      targetMax: 50,
      operators: ['+', '-', '×'],
      rounds: 5,
      timeBudgetMs: 50_000,
    });
    expect(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.hard).toEqual({
      numbersCount: 4,
      targetMin: 20,
      targetMax: 100,
      operators: ['+', '-', '×', '÷'],
      rounds: 6,
      timeBudgetMs: 45_000,
    });
    expect(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.expert).toEqual({
      numbersCount: 5,
      targetMin: 50,
      targetMax: 200,
      operators: ['+', '-', '×', '÷'],
      rounds: 7,
      timeBudgetMs: 40_000,
    });
  });

  it('defines adaptive tuning with min/max bounds', () => {
    expect(ADAPTIVE_PARAMS).toEqual({
      numbersCount: 3,
      targetMin: 10,
      targetMax: 30,
      operators: ['+', '-'],
      rounds: 5,
      timeBudgetMs: 50_000,
      minNumbersCount: 3,
      maxNumbersCount: 5,
      minTarget: 10,
      maxTarget: 200,
    });
  });

  it('resolves levels through the SDK with the game parameters attached', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const profile = resolveMathEquationBuilderDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBe(DEFAULT_CHALLENGE_RATINGS[level]);
    }
    const adaptive = resolveMathEquationBuilderDifficulty('adaptive');
    expect(adaptive.challengeRating).toBe(0.5);
  });

  it('returns fresh param objects (never mutates the frozen defaults)', () => {
    const a = mathEquationBuilderParamsForLevel('easy');
    const b = mathEquationBuilderParamsForLevel('easy');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a).not.toBe(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.easy);
  });

  it('rejects profiles missing a required parameter', () => {
    const profile = resolveMathEquationBuilderDifficulty('normal');
    const { numbersCount: _omitted, ...incomplete } = profile.parameters;
    expect(() => mathEquationBuilderParamsFromProfile({ ...profile, parameters: incomplete })).toThrow(
      /numbersCount/,
    );
  });
});

describe('nextAdaptiveParams', () => {
  it('escalates on a pass', () => {
    const prev: MathEquationBuilderDifficultyParams = { ...ADAPTIVE_PARAMS };
    const next = nextAdaptiveParams(prev, true);
    expect(next.numbersCount).toBe(4);
    expect(next.operators).toContain('×');
  });

  it('de-escalates on a failure', () => {
    const escalated: MathEquationBuilderDifficultyParams = {
      ...ADAPTIVE_PARAMS,
      numbersCount: 4,
      operators: ['+', '-', '×'],
    };
    const next = nextAdaptiveParams(escalated, false);
    expect(next.numbersCount).toBe(3);
  });

  it('clamps at min bounds', () => {
    const atMin: MathEquationBuilderDifficultyParams = { ...ADAPTIVE_PARAMS, numbersCount: 3 };
    const next = nextAdaptiveParams(atMin, false);
    expect(next.numbersCount).toBe(3);
  });

  it('clamps at max bounds', () => {
    const atMax: MathEquationBuilderDifficultyParams = {
      ...ADAPTIVE_PARAMS,
      numbersCount: 5,
      operators: ['+', '-', '×', '÷'],
    };
    const next = nextAdaptiveParams(atMax, true);
    expect(next.numbersCount).toBe(5);
  });
});

describe('sessionChallengeRating', () => {
  it('reports the SDK default rating for fixed levels', () => {
    const profile = resolveMathEquationBuilderDifficulty('hard');
    expect(sessionChallengeRating('hard', profile, 4)).toBe(profile.challengeRating);
  });

  it('maps the adaptive final numbers count linearly into [0, 1]', () => {
    const profile = resolveMathEquationBuilderDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 3)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 4)).toBe(0.5);
    expect(sessionChallengeRating('adaptive', profile, 5)).toBe(1);
  });
});

describe('tier consistency audit (campaign 012)', () => {
  it('escalates numbers count, target ceiling and time pressure monotonically', () => {
    const order = ['easy', 'normal', 'hard', 'expert'] as const;
    for (let i = 1; i < order.length; i += 1) {
      const lo = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS[order[i - 1]];
      const hi = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS[order[i]];
      expect(hi.numbersCount).toBeGreaterThanOrEqual(lo.numbersCount);
      expect(hi.targetMax).toBeGreaterThan(lo.targetMax);
      expect(hi.timeBudgetMs).toBeLessThan(lo.timeBudgetMs);
      expect(hi.rounds).toBeGreaterThan(lo.rounds);
    }
    // Easy stays genuinely easy: 3 numbers, +/− only.
    expect(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.easy.numbersCount).toBe(3);
    expect(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.easy.operators).toEqual(['+', '-']);
  });

  it('grows the operator mix monotonically (easy ⊂ normal ⊂ hard = expert)', () => {
    const easy = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.easy.operators;
    const normal = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal.operators;
    const hard = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.hard.operators;
    const expert = MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.expert.operators;
    expect(easy.every((op) => normal.includes(op))).toBe(true);
    expect(normal.every((op) => hard.includes(op))).toBe(true);
    expect(hard).toEqual(expert);
    // Expert is meaningfully harder than hard: one more number and double
    // the target ceiling — never a degenerate copy of the tier below it.
    expect(expert.length).toBe(4); // full operator set
    expect(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.expert.numbersCount).toBe(5);
    expect(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.expert.targetMax).toBe(
      2 * MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.hard.targetMax,
    );
  });
});
