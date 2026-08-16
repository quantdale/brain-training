/**
 * Deterministic validated-problem generation for the Fast Math game.
 *
 * A session's seed is recorded with its result, so the full session is
 * reproducible from `(RNG_ALGORITHM_VERSION, gameVersion, generatorVersion,
 * seed, difficulty)` per the SDK generator rule. Problems come from a
 * per-problem RNG fork (`problem:<index>:attempt:<n>`) and are validated at
 * generation:
 *
 * - All operands and answers are integers; answers are always ≥ 0.
 * - Addition:  left ∈ [1, maxLeft],  right ∈ [1, maxRight], answer = left + right.
 * - Subtraction: left ∈ [2, maxLeft], right ∈ [1, min(maxRight, left−1)],
 *   answer = left − right ≥ 1 (no zero answer, no `x − 0`).
 * - Multiplication: left, right ∈ [2, …] (no zero/one factors).
 * - Division: right ∈ [2, maxRight], answer ∈ [2, maxRight],
 *   left = answer × right — exact by construction, and `left ≤ maxLeft`
 *   always holds because every level's config satisfies `maxLeft ≥ maxRight²`
 *   (asserted in difficulty tests). No `x ÷ 1`, no `x ÷ x`.
 *
 * Triviality (zero operands, ×0/×1, ÷1, self-subtraction) is therefore
 * avoided by construction, not by rejection. The only bounded regeneration
 * loop is near-duplicate avoidance: a candidate whose signature equals the
 * previous problem's (commutative-swap aware for + and ×) is re-drawn with an
 * incremented attempt salt until it differs, or `MAX_PROBLEM_ATTEMPTS` is
 * exhausted — the deterministic fallback then accepts the last candidate
 * (still fully valid; only variety is affected). Every step is deterministic:
 * the same seed always yields the same session for the same play history.
 */
import type { Rng } from '@/sdk';

import type { MathDifficultyParams, MathProblem, Operator } from './types';

/** Upper bound on re-draw attempts before the last candidate is accepted. */
export const MAX_PROBLEM_ATTEMPTS = 20;

export interface GenerateProblemInput {
  readonly rng: Rng;
  /** 0-based problem index; part of the fork salt. */
  readonly problemIndex: number;
  readonly params: MathDifficultyParams;
  /** Previous problem, or null for the first problem of a session. */
  readonly prevProblem: MathProblem | null;
}

/** Generate one validated problem (see module docs for the invariants). */
export function generateProblem(input: GenerateProblemInput): MathProblem {
  const { rng, problemIndex, params, prevProblem } = input;
  let last: MathProblem | null = null;
  for (let attempt = 0; attempt < MAX_PROBLEM_ATTEMPTS; attempt += 1) {
    last = drawProblem(rng.fork(`problem:${problemIndex}:attempt:${attempt}`), params);
    if (!isNearDuplicate(last, prevProblem)) {
      return last;
    }
  }
  // Extremely unlikely fallback: deterministically accept the last candidate.
  // The candidate still satisfies every generation invariant (only variety
  // is compromised).
  return last as MathProblem;
}

/** Convenience: a full deterministic problem list for one session. */
export function generateSessionProblems(
  rng: Rng,
  params: MathDifficultyParams,
  rounds: number = params.rounds,
): MathProblem[] {
  let prev: MathProblem | null = null;
  const problems: MathProblem[] = [];
  for (let index = 0; index < rounds; index += 1) {
    const problem = generateProblem({ rng, problemIndex: index, params, prevProblem: prev });
    problems.push(problem);
    prev = problem;
  }
  return problems;
}

/** Draw one candidate problem for the given params (valid by construction). */
function drawProblem(rng: Rng, params: MathDifficultyParams): MathProblem {
  const operator: Operator = rng.pick(params.operators);
  const range = params.ranges[operator];
  switch (operator) {
    case '+': {
      const left = rng.nextIntRange(1, range.maxLeft + 1);
      const right = rng.nextIntRange(1, range.maxRight + 1);
      return { operator, left, right, answer: left + right };
    }
    case '−': {
      const left = rng.nextIntRange(2, range.maxLeft + 1);
      // right ≤ left − 1 keeps the answer ≥ 1 (no `x − x`, no `x − 0`).
      const right = rng.nextIntRange(1, Math.min(range.maxRight, left - 1) + 1);
      return { operator, left, right, answer: left - right };
    }
    case '×': {
      const left = rng.nextIntRange(2, range.maxLeft + 1);
      const right = rng.nextIntRange(2, range.maxRight + 1);
      return { operator, left, right, answer: left * right };
    }
    case '÷': {
      // Exact by construction: left = answer × right. In-range by config:
      // every level satisfies maxLeft ≥ maxRight² (difficulty tests assert).
      const right = rng.nextIntRange(2, range.maxRight + 1);
      const answer = rng.nextIntRange(2, range.maxRight + 1);
      return { operator, left: answer * right, right, answer };
    }
  }
}

/**
 * Canonical signature of a problem: operator plus operands, with commutative
 * operands sorted for + and × so `3 + 4` and `4 + 3` count as the same
 * problem for near-duplicate purposes.
 */
export function problemSignature(problem: MathProblem): string {
  const isCommutative = problem.operator === '+' || problem.operator === '×';
  const first = isCommutative
    ? Math.min(problem.left, problem.right)
    : problem.left;
  const second = isCommutative
    ? Math.max(problem.left, problem.right)
    : problem.right;
  return `${problem.operator}|${first}|${second}`;
}

/** True when `a` repeats `b` exactly (commutativity-aware). */
export function isNearDuplicate(a: MathProblem, b: MathProblem | null): boolean {
  return b !== null && problemSignature(a) === problemSignature(b);
}

/**
 * Trivial-problem predicate. Generation avoids these by construction (see
 * module docs); the predicate is exported so tests can exhaustively verify
 * the invariant over many seeds.
 */
export function isTrivialProblem(problem: MathProblem): boolean {
  switch (problem.operator) {
    case '+':
      return problem.left === 0 || problem.right === 0;
    case '−':
      return problem.right === 0 || problem.left === problem.right;
    case '×':
      return (
        problem.left === 0 ||
        problem.right === 0 ||
        problem.left === 1 ||
        problem.right === 1
      );
    case '÷':
      return problem.right === 1 || problem.left === problem.right;
  }
}
