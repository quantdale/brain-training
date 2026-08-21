/**
 * Deterministic equation generation for the Math Missing Operator game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Equations come from a
 * per-round RNG fork (`round:<index>:attempt:<n>`), so the same seed always
 * yields the same session.
 *
 * Unique-solution lemma (proved exhaustively by the tests): for `a ≥ 2`,
 * `b ≥ 2`, the only pairs where two operators produce the same result are
 * (2,2) — `2+2 = 2×2 = 4` — and (4,2) — `4−2 = 4÷2 = 2`. The generator keeps
 * `a ≥ minA ≥ 4` and `b ≥ 2` and explicitly rejects (4,2) for `−`/`÷`, so
 * every emitted equation has exactly one correct operator among all four
 * displayed buttons. The `isUniqueSolution` check below is a runtime safety
 * net on top of that constructive proof.
 *
 * Additional invariants (covered by tests):
 * - division is always exact (`a = b·q`, quotient `c = q`),
 * - no trivial `×1`/`÷1` (`b ≥ 2`, `q ≥ 2`),
 * - generation is bounded (`MAX_EQUATION_ATTEMPTS` per round, with a
 *   deterministic guaranteed-valid fallback).
 */
import type { DifficultyLevel, Rng } from '@/sdk';

import { aMaxForRound } from './difficulty';
import type { Equation, MathMissingOperatorDifficultyParams, Operator } from './types';
import { OPERATORS } from './types';

/* -------------------------------------------------------------------------- */
/*  Content-pack: curated equation templates                                   */
/* -------------------------------------------------------------------------- */

/**
 * A pre-verified equation template.  `numbers` is [a, b]; `operators` holds
 * the single correct operator; `result` is `a op b`.  Each template is
 * exhaustively verified to have exactly one solution among all four operators.
 */
export interface EquationTemplate {
  readonly numbers: readonly number[];
  readonly operators: readonly string[];
  readonly result: number;
}

/**
 * Curated equation templates guaranteed to have a unique solution.
 * The generator picks from these when compatible with the active difficulty
 * params, supplementing procedural generation with hand-crafted variety.
 *
 * Invariants maintained by construction:
 * - a ≥ 4, b ≥ 2 (satisfies minA / minB for all shipped levels)
 * - no trivial ×1 / ÷1 (b ≥ 2, quotient ≥ 2)
 * - no ambiguous pair (4,2) for − / ÷
 * - division always exact
 * - exactly one of {+, −, *, /} produces the stated result
 */
export const EQUATION_TEMPLATES: readonly EquationTemplate[] = [
  // Small operands (easy / normal compatible)
  { numbers: [8, 2], operators: ['*'], result: 16 },   // 8 × 2 = 16
  { numbers: [7, 3], operators: ['*'], result: 21 },   // 7 × 3 = 21
  { numbers: [9, 4], operators: ['*'], result: 36 },   // 9 × 4 = 36
  { numbers: [6, 4], operators: ['+'], result: 10 },    // 6 + 4 = 10
  { numbers: [11, 5], operators: ['+'], result: 16 },   // 11 + 5 = 16
  { numbers: [14, 6], operators: ['-'], result: 8 },    // 14 − 6 = 8
  { numbers: [20, 8], operators: ['-'], result: 12 },   // 20 − 8 = 12
  { numbers: [8, 6], operators: ['+'], result: 14 },    // 8 + 6 = 14
  { numbers: [9, 5], operators: ['*'], result: 45 },    // 9 × 5 = 45
  { numbers: [7, 2], operators: ['*'], result: 14 },    // 7 × 2 = 14
  { numbers: [5, 3], operators: ['+'], result: 8 },     // 5 + 3 = 8
  // Medium operands (normal / hard / expert compatible)
  { numbers: [12, 3], operators: ['/'], result: 4 },    // 12 ÷ 3 = 4
  { numbers: [15, 5], operators: ['/'], result: 3 },    // 15 ÷ 5 = 3
  { numbers: [16, 4], operators: ['/'], result: 4 },    // 16 ÷ 4 = 4
  { numbers: [18, 6], operators: ['/'], result: 3 },    // 18 ÷ 6 = 3
  { numbers: [13, 4], operators: ['-'], result: 9 },    // 13 − 4 = 9
  { numbers: [10, 2], operators: ['*'], result: 20 },   // 10 × 2 = 20
  { numbers: [24, 8], operators: ['/'], result: 3 },    // 24 ÷ 8 = 3
  { numbers: [10, 7], operators: ['+'], result: 17 },   // 10 + 7 = 17
  { numbers: [12, 4], operators: ['/'], result: 3 },    // 12 ÷ 4 = 3
  // Large operands (hard / expert compatible — covers all 4 operators)
  { numbers: [14, 3], operators: ['*'], result: 42 },   // 14 × 3 = 42
  { numbers: [16, 5], operators: ['+'], result: 21 },   // 16 + 5 = 21
  // Large-operand depth block (machine-verified unique solutions; b ≤ expert
  // maxB so the compatibility filter admits exactly the intended levels —
  // entries with b > hard's maxB serve expert only, and a > 40 only surfaces
  // in later expert rounds as aMax escalates toward 99).
  { numbers: [24, 6], operators: ['/'], result: 4 },    // 24 ÷ 6 = 4
  { numbers: [36, 9], operators: ['/'], result: 4 },    // 36 ÷ 9 = 4
  { numbers: [48, 8], operators: ['/'], result: 6 },    // 48 ÷ 8 = 6
  { numbers: [63, 7], operators: ['/'], result: 9 },    // 63 ÷ 7 = 9
  { numbers: [96, 8], operators: ['/'], result: 12 },   // 96 ÷ 8 = 12
  { numbers: [13, 7], operators: ['*'], result: 91 },   // 13 × 7 = 91
  { numbers: [19, 4], operators: ['*'], result: 76 },   // 19 × 4 = 76
  { numbers: [17, 6], operators: ['*'], result: 102 },  // 17 × 6 = 102
  { numbers: [28, 5], operators: ['*'], result: 140 },  // 28 × 5 = 140
  { numbers: [87, 5], operators: ['+'], result: 92 },   // 87 + 5 = 92
  { numbers: [64, 10], operators: ['-'], result: 54 },  // 64 − 10 = 54
  { numbers: [73, 9], operators: ['+'], result: 82 },   // 73 + 9 = 82
];

/** Upper bound on re-draw attempts per round before the fallback is used. */
export const MAX_EQUATION_ATTEMPTS = 16;

/** Evaluate `a op b`; `null` when division is not exact. */
export function evaluate(op: Operator, a: number, b: number): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

/** How many of the four operators make `a op b === c` hold (division exact). */
export function uniqueSolutionCount(a: number, b: number, c: number): number {
  let count = 0;
  for (const op of OPERATORS) {
    if (evaluate(op, a, b) === c) {
      count += 1;
    }
  }
  return count;
}

/** True when exactly one of the four displayed operators solves the equation. */
export function isUniqueSolution(a: number, b: number, c: number): boolean {
  return uniqueSolutionCount(a, b, c) === 1;
}

export interface GenerateEquationInput {
  readonly rng: Rng;
  /** 0-based round index; part of the fork salt. */
  readonly roundIndex: number;
  readonly params: MathMissingOperatorDifficultyParams;
  readonly level: DifficultyLevel;
  /** Adaptive-only: the live rating influences the first-operand ceiling. */
  readonly rating?: number;
}

/** Generate one equation; see module docs for the invariants. */
export function generateEquation(input: GenerateEquationInput): Equation {
  const { rng, roundIndex, params, level, rating = 0.5 } = input;
  const aMax = aMaxForRound(params, roundIndex, level, rating);

  // ---- Content-pack: try curated templates first ----
  const compatibleTemplates = EQUATION_TEMPLATES.filter((t) => {
    const [a, b] = t.numbers;
    return (
      a >= params.minA &&
      a <= aMax &&
      b >= params.minB &&
      b <= params.maxB &&
      params.operators.includes(t.operators[0] as Operator)
    );
  });

  if (compatibleTemplates.length > 0) {
    const fork = rng.fork(`templates:round:${roundIndex}`);
    const shuffled = fork.shuffle([...compatibleTemplates]);
    for (const template of shuffled) {
      const [a, b] = template.numbers;
      if (isUniqueSolution(a, b, template.result)) {
        return {
          a,
          b,
          c: template.result,
          answerOperator: template.operators[0] as Operator,
        };
      }
    }
  }

  // ---- Procedural fallback (original algorithm) ----
  for (let attempt = 0; attempt < MAX_EQUATION_ATTEMPTS; attempt += 1) {
    const equation = attemptEquation(
      rng.fork(`round:${roundIndex}:attempt:${attempt}`),
      params,
      aMax,
    );
    if (equation !== null && isUniqueSolution(equation.a, equation.b, equation.c)) {
      return equation;
    }
  }

  // Extremely unlikely fallback: a deterministic, guaranteed-valid equation
  // (see fallbackEquation). Same seed → same fallback.
  return fallbackEquation(params, aMax);
}

/**
 * One random draw for the round. Returns null when the drawn operands are
 * infeasible or ambiguous for the chosen operator; the caller re-draws with
 * an incremented attempt salt. All draws use the attempt-forked RNG, so
 * every step is deterministic.
 */
function attemptEquation(
  attemptRng: Rng,
  params: MathMissingOperatorDifficultyParams,
  aMax: number,
): Equation | null {
  const op = attemptRng.pick(params.operators);

  switch (op) {
    case '+': {
      const a = attemptRng.nextIntRange(params.minA, aMax + 1);
      const b = attemptRng.nextIntRange(params.minB, params.maxB + 1);
      // Unique: a+b == a×b only at (2,2) — impossible (minA ≥ 4); a+b == a−b
      // needs b = 0 — impossible (minB ≥ 2); a+b == a÷b has no positive solution.
      return { a, b, c: a + b, answerOperator: '+' };
    }
    case '-': {
      const a = attemptRng.nextIntRange(params.minA, aMax + 1);
      // b < a keeps the result positive; non-empty because a ≥ minA ≥ minB+1.
      const b = attemptRng.nextIntRange(params.minB, Math.min(params.maxB, a - 1) + 1);
      if (a === 4 && b === 2) {
        return null; // 4−2 == 4÷2 → ambiguous with the displayed ÷ button.
      }
      return { a, b, c: a - b, answerOperator: '-' };
    }
    case '*': {
      const a = attemptRng.nextIntRange(params.minA, aMax + 1);
      // b ≥ 2 excludes trivial ×1; (2,2) is impossible (minA ≥ 4).
      const b = attemptRng.nextIntRange(2, params.maxB + 1);
      return { a, b, c: a * b, answerOperator: '*' };
    }
    case '/': {
      // Draw the quotient q (= c) and the divisor b; a = b·q stays within
      // [minA, aMax]. Exact by construction; b,q ≥ 2 excludes ÷1 and ÷(itself).
      const q = attemptRng.nextIntRange(2, params.maxB + 1);
      const lo = Math.max(2, Math.ceil(params.minA / q));
      const hi = Math.min(params.maxB, Math.floor(aMax / q));
      if (hi < lo) {
        return null; // No feasible divisor for this quotient this round.
      }
      const b = attemptRng.nextIntRange(lo, hi + 1);
      if (b === 2 && q === 2) {
        return null; // 4÷2 == 4−2 → ambiguous with the displayed − button.
      }
      return { a: b * q, b, c: q, answerOperator: '/' };
    }
  }
}

/**
 * Deterministic fallback used only when every random attempt was rejected.
 * The first operator of the level's candidate set is used; each case picks a
 * canonical operand pair that satisfies the range and uniqueness invariants.
 * Unreachable with the shipped difficulty params (verified by tests).
 */
function fallbackEquation(
  params: MathMissingOperatorDifficultyParams,
  aMax: number,
): Equation {
  const op = params.operators[0];
  switch (op) {
    case '+':
      return { a: params.minA, b: params.minB, c: params.minA + params.minB, answerOperator: '+' };
    case '-': {
      const a = params.minA;
      // Skip the ambiguous (4,2) pair when it is in range (minB=2, maxB≥3).
      const b =
        a === 4 && params.minB === 2 && params.maxB >= 3 ? 3 : params.minB;
      return { a, b, c: a - b, answerOperator: '-' };
    }
    case '*':
      return {
        a: params.minA,
        b: Math.max(2, params.minB),
        c: params.minA * Math.max(2, params.minB),
        answerOperator: '*',
      };
    case '/': {
      // Scan quotients upward for a feasible, unambiguous (b, q) pair.
      for (let q = 2; q <= params.maxB; q += 1) {
        const lo = Math.max(2, Math.ceil(params.minA / q));
        const hi = Math.min(params.maxB, Math.floor(aMax / q));
        if (hi < lo) {
          continue;
        }
        const b = hi; // Deterministic: the largest feasible divisor.
        if (b === 2 && q === 2) {
          continue; // Ambiguous with − (4÷2 == 4−2).
        }
        return { a: b * q, b, c: q, answerOperator: '/' };
      }
      // Invariant: division-including levels satisfy ceil(minA/2) ≤ maxB and
      // maxA ≥ minA ≥ 6, so q=2 always yields a feasible (b, q) above.
      throw new Error(
        `math-missing-operator: division fallback infeasible for params minA=${params.minA} maxA=${params.maxA} maxB=${params.maxB}`,
      );
    }
  }
}
