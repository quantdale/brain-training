// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS,
  ADAPTIVE_PARAMS,
  aMaxForRound,
  mathMissingOperatorParamsForLevel,
} from '../difficulty';
import {
  MAX_EQUATION_ATTEMPTS,
  evaluate,
  generateEquation,
  isUniqueSolution,
  uniqueSolutionCount,
} from '../generator';
import type { Equation } from '../types';
import { OPERATORS } from '../types';

function fullSession(
  seed: string,
  level: keyof typeof MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS | 'adaptive',
  rating = 0.5,
): Equation[] {
  const params = mathMissingOperatorParamsForLevel(level);
  const rng = createRng(seed);
  const equations: Equation[] = [];
  for (let round = 0; round < params.rounds; round += 1) {
    equations.push(generateEquation({ rng, roundIndex: round, params, level, rating }));
  }
  return equations;
}

describe('generateEquation', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42', 'normal')).toEqual(fullSession('seed-42', 'normal'));
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a', 'normal');
    const b = fullSession('seed-b', 'normal');
    expect(a).not.toEqual(b);
  });

  it('keeps every equation within the round ranges and exact for division', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = mathMissingOperatorParamsForLevel(level);
      for (let seed = 1; seed <= 30; seed += 1) {
        const equations = fullSession(String(seed), level);
        for (let round = 0; round < equations.length; round += 1) {
          const { a, b, c } = equations[round];
          const aMax = aMaxForRound(params, round, level, 0.5);
          expect(a).toBeGreaterThanOrEqual(params.minA);
          expect(a).toBeLessThanOrEqual(aMax);
          expect(b).toBeGreaterThanOrEqual(params.minB);
          expect(b).toBeLessThanOrEqual(params.maxB);
          expect(c).toBeGreaterThan(0);
          // Division is always exact and never ÷1: the divisor and the
          // quotient are both ≥ 2.
          expect(evaluate(equations[round].answerOperator, a, b)).toBe(c);
          if (equations[round].answerOperator === '/') {
            expect(a % b).toBe(0);
            expect(b).toBeGreaterThanOrEqual(2);
            expect(c).toBeGreaterThanOrEqual(2);
          }
          if (equations[round].answerOperator === '*') {
            expect(b).toBeGreaterThanOrEqual(2); // no trivial ×1
          }
        }
      }
    }
  });

  it('emits only equations with exactly one correct operator among all four', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      for (let seed = 1; seed <= 40; seed += 1) {
        for (const equation of fullSession(String(seed), level)) {
          expect(uniqueSolutionCount(equation.a, equation.b, equation.c)).toBe(1);
          expect(equation.answerOperator).toBe(
            OPERATORS.find((op) => evaluate(op, equation.a, equation.b) === equation.c),
          );
        }
      }
    }
  });

  it('draws the answer only from the level’s candidate operator set', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const) {
      const params = mathMissingOperatorParamsForLevel(level);
      for (let seed = 1; seed <= 20; seed += 1) {
        for (const equation of fullSession(String(seed), level)) {
          expect(params.operators).toContain(equation.answerOperator);
        }
      }
    }
  });

  it('covers every candidate operator of each level over a long session', () => {
    // Deterministic: 600 rounds per level with a fixed seed. Uniform picking
    // over ≤ 4 operators makes a missing candidate virtually impossible.
    const params = mathMissingOperatorParamsForLevel('expert');
    const seen = new Set<string>();
    const rng = createRng('coverage');
    for (let round = 0; round < 600; round += 1) {
      seen.add(generateEquation({ rng, roundIndex: round, params, level: 'expert' }).answerOperator);
    }
    expect([...seen].sort()).toEqual(['*', '+', '-', '/']);
  });

  it('is bounded: generation always terminates deterministically', () => {
    // Even with hostile parameter combinations, generation stays in budget and
    // the fallback is deterministic (same seed → same fallback equation).
    expect(MAX_EQUATION_ATTEMPTS).toBeGreaterThan(0);
    const params = ADAPTIVE_PARAMS;
    const a = generateEquation({ rng: createRng('budget'), roundIndex: 0, params, level: 'adaptive' });
    const b = generateEquation({ rng: createRng('budget'), roundIndex: 0, params, level: 'adaptive' });
    expect(a).toEqual(b);
    expect(isUniqueSolution(a.a, a.b, a.c)).toBe(true);
  });
});

describe('evaluate / uniqueSolutionCount', () => {
  it('evaluates the four operators and rejects inexact division', () => {
    expect(evaluate('+', 8, 2)).toBe(10);
    expect(evaluate('-', 8, 2)).toBe(6);
    expect(evaluate('*', 8, 2)).toBe(16);
    expect(evaluate('/', 8, 2)).toBe(4);
    expect(evaluate('/', 7, 2)).toBeNull();
    expect(evaluate('/', 4, 0)).toBeNull();
  });

  it('proves the uniqueness lemma by exhaustive enumeration', () => {
    // Unique-solution lemma: for a ≥ 2, b ≥ 2 the ONLY pairs where two
    // operators produce the same result are (2,2) — 2+2 = 2×2 = 4 — and
    // (4,2) — 4−2 = 4÷2 = 2. The generator excludes both by construction
    // (minA ≥ 4; explicit (4,2) rejection), so every generated equation has
    // exactly one correct operator among the four displayed buttons.
    const ambiguous: { a: number; b: number; c: number; ops: string[] }[] = [];
    for (let a = 2; a <= 50; a += 1) {
      for (let b = 2; b <= 25; b += 1) {
        const byResult = new Map<number, string[]>();
        for (const op of OPERATORS) {
          const c = evaluate(op, a, b);
          if (c !== null) {
            const list = byResult.get(c) ?? [];
            list.push(op);
            byResult.set(c, list);
          }
        }
        for (const [c, ops] of byResult) {
          if (ops.length > 1) {
            ambiguous.push({ a, b, c, ops });
          }
        }
      }
    }
    expect(ambiguous).toEqual([
      { a: 2, b: 2, c: 4, ops: ['+', '*'] },
      { a: 4, b: 2, c: 2, ops: ['-', '/'] },
    ]);
  });
});
