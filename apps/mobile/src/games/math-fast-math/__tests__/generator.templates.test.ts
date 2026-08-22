// Content-pack audit for Fast Math (campaign 012 W09): every curated template
// must be drawable by at least one shipped level ("no dead content"), every
// template admitted by a level must be valid under that level's ranges, and
// the fixed tiers must stay strictly ordered on their difficulty axes.
// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  ADAPTIVE_MAX_STEP,
  ADAPTIVE_PARAMS,
  MATH_DIFFICULTY_PARAMS,
  adaptiveParamsForStep,
} from '../difficulty';
import { PROBLEM_TEMPLATES, TWO_STEP_TEMPLATES, isTrivialProblem } from '../generator';
import type { MathDifficultyParams, Operator } from '../types';

const LEVELS = ['easy', 'normal', 'hard', 'expert'] as const;

type Level = (typeof LEVELS)[number];

/** Levels whose single-step draw filter admits this template. */
function levelsAdmitting(t: { a: number; b: number; operator: string }): Level[] {
  return LEVELS.filter((level) => {
    const params = MATH_DIFFICULTY_PARAMS[level];
    const op = t.operator as Operator;
    if (!params.operators.includes(op)) return false;
    const range = params.ranges[op];
    return t.a >= 1 && t.a <= range.maxLeft && t.b >= 1 && t.b <= range.maxRight;
  });
}

/** Regimes with a live two-step gate (the only drawers of TWO_STEP_TEMPLATES). */
function twoStepRegimes(): { label: Level | 'adaptive-top'; params: MathDifficultyParams }[] {
  return [
    { label: 'expert', params: MATH_DIFFICULTY_PARAMS.expert },
    {
      label: 'adaptive-top',
      params: adaptiveParamsForStep(ADAPTIVE_PARAMS, ADAPTIVE_MAX_STEP),
    },
  ];
}

/** Levels whose two-step draw filter admits this template. */
function regimesAdmittingTwoStep(t: {
  a: number;
  b: number;
  operator: string;
  c: number;
  tailOperator: '+' | '−';
}): (Level | 'adaptive-top')[] {
  return twoStepRegimes()
    .filter(({ params }) => {
      const op = t.operator as Operator;
      if (!params.operators.includes(op)) return false;
      const first = params.ranges[op];
      const tail = params.ranges[t.tailOperator];
      return (
        t.a >= 1 &&
        t.a <= first.maxLeft &&
        t.b >= 1 &&
        t.b <= first.maxRight &&
        t.c >= 1 &&
        t.c <= tail.maxRight
      );
    })
    .map(({ label }) => label);
}

function evaluateFirstStep(op: Operator, a: number, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      expect(b).not.toBe(0);
      expect(a % b).toBe(0);
      return a / b;
  }
}

describe('single-step template bank (PROBLEM_TEMPLATES)', () => {
  it('admits every template at one or more shipped levels (no dead content)', () => {
    for (const t of PROBLEM_TEMPLATES) {
      expect(levelsAdmitting(t).length).toBeGreaterThan(0);
    }
  });

  it('every admitted template is exact, non-trivial and inside the admitting ranges', () => {
    for (const t of PROBLEM_TEMPLATES) {
      for (const level of levelsAdmitting(t)) {
        const params = MATH_DIFFICULTY_PARAMS[level];
        const op = t.operator as Operator;
        const range = params.ranges[op];
        expect(t.a).toBeLessThanOrEqual(range.maxLeft);
        expect(t.b).toBeLessThanOrEqual(range.maxRight);
        switch (op) {
          case '+':
            expect(t.a).toBeGreaterThanOrEqual(1);
            expect(t.b).toBeGreaterThanOrEqual(1);
            expect(t.result).toBe(t.a + t.b);
            break;
          case '−':
            expect(t.a).toBeGreaterThanOrEqual(2);
            expect(t.result).toBe(t.a - t.b);
            expect(t.result).toBeGreaterThanOrEqual(1);
            break;
          case '×':
            expect(t.a).toBeGreaterThanOrEqual(2);
            expect(t.b).toBeGreaterThanOrEqual(2);
            expect(t.result).toBe(t.a * t.b);
            break;
          case '÷':
            expect(t.b).toBeGreaterThanOrEqual(2);
            expect(t.result).toBeGreaterThanOrEqual(2);
            expect(t.a).toBe(t.result * t.b); // exact by construction
            expect(t.a).toBeLessThanOrEqual(range.maxLeft);
            break;
        }
        expect(
          isTrivialProblem({ operator: op, left: t.a, right: t.b, answer: t.result }),
        ).toBe(false);
      }
    }
  });

  it('covers every shipped level (each level draws some curated content)', () => {
    for (const level of LEVELS) {
      const drawn = PROBLEM_TEMPLATES.filter((t) => levelsAdmitting(t).includes(level));
      expect(drawn.length).toBeGreaterThan(0);
    }
  });
});

describe('two-step template bank (TWO_STEP_TEMPLATES)', () => {
  it('is admitted by every regime with a live two-step gate', () => {
    for (const t of TWO_STEP_TEMPLATES) {
      expect(regimesAdmittingTwoStep(t)).toEqual(['expert', 'adaptive-top']);
    }
  });

  it('keeps every template exact, positive and within three digits at expert', () => {
    const params = MATH_DIFFICULTY_PARAMS.expert;
    for (const t of TWO_STEP_TEMPLATES) {
      const intermediate = evaluateFirstStep(t.operator as Operator, t.a, t.b);
      const answer = t.tailOperator === '+' ? intermediate + t.c : intermediate - t.c;
      expect(answer).toBe(t.result);
      expect(answer).toBeGreaterThanOrEqual(1);
      expect(answer).toBeLessThanOrEqual(999);
      expect(intermediate).toBeGreaterThanOrEqual(0);
      expect(t.c).toBeGreaterThanOrEqual(1);
      expect(params.operators).toContain(t.operator as Operator);
    }
  });
});

describe('difficulty tier consistency audit (campaign 012)', () => {
  it('escalates rounds and time pressure monotonically across fixed levels', () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      const lo = MATH_DIFFICULTY_PARAMS[LEVELS[i - 1]];
      const hi = MATH_DIFFICULTY_PARAMS[LEVELS[i]];
      expect(hi.rounds).toBeGreaterThan(lo.rounds);
      expect(hi.timeBudgetMs ?? 0).toBeLessThan(lo.timeBudgetMs ?? 0);
    }
  });

  it('widens every operator range monotonically across fixed levels', () => {
    for (const op of ['+', '−', '×', '÷'] as const) {
      for (let i = 1; i < LEVELS.length; i += 1) {
        const lo = MATH_DIFFICULTY_PARAMS[LEVELS[i - 1]].ranges[op];
        const hi = MATH_DIFFICULTY_PARAMS[LEVELS[i]].ranges[op];
        expect(hi.maxLeft).toBeGreaterThanOrEqual(lo.maxLeft);
        expect(hi.maxRight).toBeGreaterThanOrEqual(lo.maxRight);
      }
    }
  });

  it('satisfies the division config invariant maxLeft ≥ maxRight² everywhere', () => {
    // Keeps `left = answer × right` (both drawn ≤ maxRight) inside maxLeft.
    for (const level of [...LEVELS, 'adaptive'] as const) {
      const params =
        level === 'adaptive'
          ? ADAPTIVE_PARAMS
          : MATH_DIFFICULTY_PARAMS[level];
      const div = params.ranges['÷'];
      expect(div.maxLeft).toBeGreaterThanOrEqual(div.maxRight * div.maxRight);
    }
  });

  it('grows the operator mix monotonically and reserves two-step depth for expert', () => {
    expect(MATH_DIFFICULTY_PARAMS.easy.operators).toEqual(['+', '−']);
    expect(MATH_DIFFICULTY_PARAMS.normal.operators).toEqual(['+', '−', '×']);
    expect(MATH_DIFFICULTY_PARAMS.hard.operators).toEqual(['+', '−', '×', '÷']);
    expect(MATH_DIFFICULTY_PARAMS.expert.twoStepChance ?? 0).toBeGreaterThan(0);
    for (const level of ['easy', 'normal', 'hard'] as const) {
      expect(MATH_DIFFICULTY_PARAMS[level].twoStepChance ?? 0).toBe(0);
    }
  });

  it('ends the adaptive ramp exactly on the expert tier envelope', () => {
    const top = adaptiveParamsForStep(ADAPTIVE_PARAMS, ADAPTIVE_MAX_STEP);
    const expert = MATH_DIFFICULTY_PARAMS.expert;
    expect(top.ranges).toEqual(expert.ranges);
    expect(top.twoStepChance).toBe(expert.twoStepChance);
    expect(top.operators).toEqual(expert.operators);
  });
});
