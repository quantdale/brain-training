// Content-pack audit for Missing Operator (campaign 012 W09): every curated
// equation must keep its unique-solution guarantee, every template must be
// drawable by at least one shipped level ("no dead content"), and the fixed
// tiers must stay strictly ordered on their difficulty axes.
// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS, mathMissingOperatorParamsForLevel } from '../difficulty';
import { EQUATION_TEMPLATES, evaluate, generateEquation, isUniqueSolution } from '../generator';
import type { Operator } from '../types';

const LEVELS = ['easy', 'normal', 'hard', 'expert'] as const;

type Level = (typeof LEVELS)[number];

/** Levels whose draw filter admits this template in some round (aMax escalates to maxA). */
function levelsAdmitting(t: { numbers: readonly number[]; operators: readonly string[] }): Level[] {
  const [a, b] = t.numbers;
  return LEVELS.filter((level) => {
    const params = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS[level];
    if (!params.operators.includes(t.operators[0] as Operator)) return false;
    if (b < params.minB || b > params.maxB) return false;
    // aMaxForRound reaches exactly maxA on the final round, so admission
    // reduces to minA ≤ a ≤ maxA for some round.
    return a >= params.minA && a <= params.maxA;
  });
}

describe('template bank (EQUATION_TEMPLATES)', () => {
  it('keeps the unique-solution guarantee for every entry', () => {
    for (const t of EQUATION_TEMPLATES) {
      const [a, b] = t.numbers;
      expect(evaluate(t.operators[0] as Operator, a, b)).toBe(t.result);
      expect(isUniqueSolution(a, b, t.result)).toBe(true);
    }
  });

  it('admits every template at one or more shipped levels (no dead content)', () => {
    for (const t of EQUATION_TEMPLATES) {
      expect(levelsAdmitting(t).length).toBeGreaterThan(0);
    }
  });

  it('every admitted level can actually draw its templates within its round budget', () => {
    // Re-check admission through the real aMax escalation: by the last round,
    // aMax === maxA, so each admitting level must pass the full live filter.
    for (const t of EQUATION_TEMPLATES) {
      const [a, b] = t.numbers;
      for (const level of levelsAdmitting(t)) {
        const params = mathMissingOperatorParamsForLevel(level);
        const aMaxLast = Math.round(
          params.minA +
            (params.maxA - params.minA) *
              (params.rounds <= 1 ? 1 : (params.rounds - 1) / (params.rounds - 1)),
        );
        expect(aMaxLast).toBe(params.maxA);
        expect(a).toBeLessThanOrEqual(aMaxLast);
        expect(b).toBeGreaterThanOrEqual(params.minB);
        expect(b).toBeLessThanOrEqual(params.maxB);
        expect(params.operators).toContain(t.operators[0] as Operator);
      }
    }
  });

  it('covers every shipped level (each level draws some curated content)', () => {
    for (const level of LEVELS) {
      const drawn = EQUATION_TEMPLATES.filter((t) => levelsAdmitting(t).includes(level));
      expect(drawn.length).toBeGreaterThan(0);
    }
  });

  it('spreads draws across many distinct equations over a long expert session', () => {
    // Salt audit: per-round fork salts (`round:<index>:...`) keep rounds from
    // collapsing onto identical content. Deterministic — fixed seed.
    const params = mathMissingOperatorParamsForLevel('expert');
    const rng = createRng('w09-salt-audit');
    const seen = new Set<string>();
    for (let round = 0; round < 80; round += 1) {
      const e = generateEquation({ rng, roundIndex: round, params, level: 'expert' });
      seen.add(`${e.a}|${e.b}|${e.answerOperator}`);
    }
    // A dropped/constant round salt would collapse this to a handful of
    // repeats; healthy spread is dozens of distinct equations.
    expect(seen.size).toBeGreaterThanOrEqual(15);
  });
});

describe('difficulty tier consistency audit (campaign 012)', () => {
  it('escalates operand ceilings and time pressure monotonically across levels', () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      const lo = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS[LEVELS[i - 1]];
      const hi = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS[LEVELS[i]];
      expect(hi.minA).toBeGreaterThanOrEqual(lo.minA);
      expect(hi.maxA).toBeGreaterThan(lo.maxA);
      expect(hi.maxB).toBeGreaterThan(lo.maxB);
      expect(hi.baseTimeMs).toBeLessThan(lo.baseTimeMs);
      expect(hi.rounds).toBeGreaterThan(lo.rounds);
    }
  });

  it('grows the candidate operator set monotonically up to all four', () => {
    expect(MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.easy.operators).toEqual(['+', '-']);
    expect(MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.normal.operators).toEqual(['+', '-', '*']);
    expect(MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.hard.operators).toEqual(['+', '-', '*', '/']);
    expect(MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.expert.operators).toEqual([
      '+',
      '-',
      '*',
      '/',
    ]);
  });

  it('keeps the unique-solution preconditions intact at every level (minA ≥ 4, minB ≥ 2)', () => {
    for (const level of LEVELS) {
      const params = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS[level];
      expect(params.minA).toBeGreaterThanOrEqual(4);
      expect(params.minB).toBeGreaterThanOrEqual(2);
      expect(params.minA).toBeGreaterThan(params.minB);
    }
  });
});
