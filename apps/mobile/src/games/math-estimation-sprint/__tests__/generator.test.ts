// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  ADAPTIVE_MAX_STEP,
  ADAPTIVE_MIN_STEP,
  ADAPTIVE_PARAMS,
  MATH_DIFFICULTY_PARAMS,
  adaptiveParamsForStep,
} from '../difficulty';
import {
  MAX_PROBLEM_ATTEMPTS,
  generateProblem,
  generateSessionProblems,
  isNearDuplicate,
  isTrivialProblem,
  problemSignature,
} from '../generator';
import type { MathDifficultyParams, MathProblem } from '../types';

/** Assert every documented generation invariant for one problem. */
function assertProblemValid(problem: MathProblem, params: MathDifficultyParams): void {
  const range = params.ranges[problem.operator];
  expect(params.operators).toContain(problem.operator);
  expect(Number.isInteger(problem.left)).toBe(true);
  expect(Number.isInteger(problem.right)).toBe(true);
  expect(Number.isInteger(problem.answer)).toBe(true);
  expect(problem.answer).toBeGreaterThanOrEqual(0);
  expect(isTrivialProblem(problem)).toBe(false);
  switch (problem.operator) {
    case '+':
      expect(problem.left).toBeGreaterThanOrEqual(1);
      expect(problem.left).toBeLessThanOrEqual(range.maxLeft);
      expect(problem.right).toBeGreaterThanOrEqual(1);
      expect(problem.right).toBeLessThanOrEqual(range.maxRight);
      expect(problem.answer).toBe(problem.left + problem.right);
      break;
    case '−':
      expect(problem.left).toBeGreaterThanOrEqual(2);
      expect(problem.left).toBeLessThanOrEqual(range.maxLeft);
      expect(problem.right).toBeGreaterThanOrEqual(1);
      expect(problem.right).toBeLessThanOrEqual(range.maxRight);
      expect(problem.answer).toBe(problem.left - problem.right);
      expect(problem.answer).toBeGreaterThanOrEqual(1);
      break;
    case '×':
      expect(problem.left).toBeGreaterThanOrEqual(2);
      expect(problem.left).toBeLessThanOrEqual(range.maxLeft);
      expect(problem.right).toBeGreaterThanOrEqual(2);
      expect(problem.right).toBeLessThanOrEqual(range.maxRight);
      expect(problem.answer).toBe(problem.left * problem.right);
      break;
    case '÷':
      expect(problem.right).toBeGreaterThanOrEqual(2);
      expect(problem.right).toBeLessThanOrEqual(range.maxRight);
      expect(problem.answer).toBeGreaterThanOrEqual(2);
      expect(problem.answer).toBeLessThanOrEqual(range.maxRight);
      // Exactness by construction: left is always the dividend, answer × right.
      expect(problem.left).toBe(problem.answer * problem.right);
      expect(problem.left).toBeLessThanOrEqual(range.maxLeft);
      break;
  }
}

/** Assert every documented session invariant (no consecutive near-duplicates). */
function assertSessionValid(problems: readonly MathProblem[], params: MathDifficultyParams): void {
  expect(problems).toHaveLength(params.rounds);
  for (let i = 0; i < problems.length; i += 1) {
    assertProblemValid(problems[i], params);
    if (i > 0) {
      expect(isNearDuplicate(problems[i], problems[i - 1])).toBe(false);
    }
  }
}

function fullSession(seed: string, params: MathDifficultyParams): MathProblem[] {
  return generateSessionProblems(createRng(seed), params);
}

describe('generateSessionProblems', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42', MATH_DIFFICULTY_PARAMS.normal)).toEqual(
      fullSession('seed-42', MATH_DIFFICULTY_PARAMS.normal),
    );
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a', MATH_DIFFICULTY_PARAMS.normal);
    const b = fullSession('seed-b', MATH_DIFFICULTY_PARAMS.normal);
    expect(a).not.toEqual(b);
  });

  it('satisfies every generation invariant over many seeds (normal)', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      assertSessionValid(fullSession(String(seed), MATH_DIFFICULTY_PARAMS.normal), MATH_DIFFICULTY_PARAMS.normal);
    }
  });

  it('satisfies every generation invariant for all fixed levels', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = MATH_DIFFICULTY_PARAMS[level];
      for (let seed = 1; seed <= 20; seed += 1) {
        assertSessionValid(fullSession(`lvl-${level}-${seed}`, params), params);
      }
    }
  });

  it('satisfies every generation invariant for every adaptive step', () => {
    for (let step = ADAPTIVE_MIN_STEP; step <= ADAPTIVE_MAX_STEP; step += 1) {
      const params = adaptiveParamsForStep(ADAPTIVE_PARAMS, step);
      for (let seed = 1; seed <= 20; seed += 1) {
        assertSessionValid(fullSession(`step-${step}-${seed}`, params), params);
      }
    }
  });
});

describe('generateProblem', () => {
  it('retries near-duplicates deterministically and stays valid', () => {
    const rng = createRng('budget');
    const params = MATH_DIFFICULTY_PARAMS.normal;
    const first = generateProblem({ rng, problemIndex: 0, params, prevProblem: null });
    // The same fork stream + identical previous problem redraws the same
    // candidate first, exercising the bounded regeneration loop.
    const second = generateProblem({ rng, problemIndex: 0, params, prevProblem: first });
    expect(isNearDuplicate(second, first)).toBe(false);
    assertProblemValid(second, params);
    expect(MAX_PROBLEM_ATTEMPTS).toBeGreaterThan(0);
  });

  it('never exceeds the input length constraints of the drawn ranges', () => {
    const rng = createRng('range-check');
    for (let index = 0; index < 40; index += 1) {
      const problem = generateProblem({
        rng,
        problemIndex: index,
        params: MATH_DIFFICULTY_PARAMS.expert,
        prevProblem: null,
      });
      assertProblemValid(problem, MATH_DIFFICULTY_PARAMS.expert);
    }
  });
});

describe('problemSignature', () => {
  it('sorts operands for commutative operators', () => {
    expect(problemSignature({ operator: '+', left: 4, right: 3, answer: 7 })).toBe('+|3|4');
    expect(problemSignature({ operator: '×', left: 5, right: 2, answer: 10 })).toBe('×|2|5');
  });

  it('preserves operand order for non-commutative operators', () => {
    expect(problemSignature({ operator: '−', left: 7, right: 3, answer: 4 })).toBe('−|7|3');
    expect(problemSignature({ operator: '÷', left: 12, right: 3, answer: 4 })).toBe('÷|12|3');
  });
});

describe('isNearDuplicate', () => {
  it('flags identical problems and commutative swaps', () => {
    expect(
      isNearDuplicate(
        { operator: '+', left: 3, right: 4, answer: 7 },
        { operator: '+', left: 3, right: 4, answer: 7 },
      ),
    ).toBe(true);
    expect(
      isNearDuplicate(
        { operator: '+', left: 4, right: 3, answer: 7 },
        { operator: '+', left: 3, right: 4, answer: 7 },
      ),
    ).toBe(true);
    expect(
      isNearDuplicate(
        { operator: '×', left: 3, right: 4, answer: 12 },
        { operator: '×', left: 4, right: 3, answer: 12 },
      ),
    ).toBe(true);
  });

  it('distinguishes non-commutative operand orders', () => {
    expect(
      isNearDuplicate(
        { operator: '÷', left: 12, right: 3, answer: 4 },
        { operator: '÷', left: 12, right: 4, answer: 3 },
      ),
    ).toBe(false);
    expect(
      isNearDuplicate(
        { operator: '−', left: 7, right: 3, answer: 4 },
        { operator: '−', left: 3, right: 7, answer: -4 },
      ),
    ).toBe(false);
  });

  it('never flags a null previous problem', () => {
    expect(isNearDuplicate({ operator: '+', left: 1, right: 2, answer: 3 }, null)).toBe(false);
  });
});

describe('isTrivialProblem', () => {
  it('flags zero operands and self-cancelling problems', () => {
    expect(isTrivialProblem({ operator: '+', left: 0, right: 5, answer: 5 })).toBe(true);
    expect(isTrivialProblem({ operator: '+', left: 5, right: 0, answer: 5 })).toBe(true);
    expect(isTrivialProblem({ operator: '−', left: 3, right: 3, answer: 0 })).toBe(true);
    expect(isTrivialProblem({ operator: '−', left: 5, right: 0, answer: 5 })).toBe(true);
    expect(isTrivialProblem({ operator: '×', left: 0, right: 5, answer: 0 })).toBe(true);
    expect(isTrivialProblem({ operator: '×', left: 1, right: 5, answer: 5 })).toBe(true);
    expect(isTrivialProblem({ operator: '÷', left: 5, right: 1, answer: 5 })).toBe(true);
    expect(isTrivialProblem({ operator: '÷', left: 5, right: 5, answer: 1 })).toBe(true);
  });

  it('accepts non-trivial problems', () => {
    expect(isTrivialProblem({ operator: '+', left: 2, right: 3, answer: 5 })).toBe(false);
    expect(isTrivialProblem({ operator: '−', left: 7, right: 3, answer: 4 })).toBe(false);
    expect(isTrivialProblem({ operator: '×', left: 2, right: 3, answer: 6 })).toBe(false);
    expect(isTrivialProblem({ operator: '÷', left: 12, right: 3, answer: 4 })).toBe(false);
  });
});
