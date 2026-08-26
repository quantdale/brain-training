/**
 * Shared evaluator/grammar contract for Equation Builder (006R task 4.1).
 *
 * This module defines the single source of truth for equation evaluation.
 * All components — UI, solver, tutorial, and generator validation — must
 * use this evaluator to ensure consistency.
 *
 * Evaluation: left-to-right (no operator precedence).
 * Parentheses group sub-expressions.
 * Division by zero returns null (invalid). Non-integer division returns null.
 */
import type { Operator, EquationToken } from './types';

/**
 * Evaluate a sequence of equation tokens.
 * Returns the numeric result, or null if the equation is invalid
 * (malformed structure, division by zero, non-integer division).
 *
 * This is the canonical evaluator used by:
 * - UI: to evaluate the player's equation
 * - Solver: to verify puzzle solvability
 * - Tutorial: to evaluate demo equations
 * - Generator: to validate generated puzzles
 */
export function evaluateEquation(tokens: readonly EquationToken[]): number | null {
  let pos = 0;

  function parseFactor(): number | null {
    if (pos >= tokens.length) return null;

    const token = tokens[pos];

    if (typeof token === 'number') {
      pos += 1;
      return token;
    }

    if (token === '(') {
      pos += 1;
      const result = parseExpr();
      if (pos >= tokens.length || tokens[pos] !== ')') return null;
      pos += 1;
      return result;
    }

    return null;
  }

  function parseExpr(): number | null {
    let value = parseFactor();
    if (value === null) return null;

    // Left-to-right evaluation (no operator precedence)
    while (pos < tokens.length && typeof tokens[pos] === 'string' && tokens[pos] !== '(' && tokens[pos] !== ')') {
      const op = tokens[pos] as Operator;
      pos += 1;
      const right = parseFactor();
      if (right === null) return null;

      if (op === '+') {
        value = value + right;
      } else if (op === '-') {
        value = value - right;
      } else if (op === '×') {
        value = value * right;
      } else if (op === '÷') {
        if (right === 0) return null;
        if (value % right !== 0) return null;
        value = value / right;
      } else {
        return null;
      }
    }

    return value;
  }

  const result = parseExpr();
  if (result === null || pos !== tokens.length) return null;
  return result;
}

/**
 * Check if a set of numbers can produce the target with the given operators.
 * This is the solver used by the generator to verify puzzle solvability.
 *
 * Explores all possible binary tree structures (parenthesizations) and
 * operator assignments to determine if any combination yields the target.
 */
export function canSolve(
  target: number,
  numbers: readonly number[],
  operators: readonly Operator[],
): boolean {
  function combine(nums: readonly number[]): Set<number> {
    if (nums.length === 1) {
      return new Set([nums[0]]);
    }

    const result = new Set<number>();

    for (let split = 1; split < nums.length; split++) {
      const leftNums = nums.slice(0, split);
      const rightNums = nums.slice(split);

      const leftResults = combine(leftNums);
      const rightResults = combine(rightNums);

      for (const left of leftResults) {
        for (const right of rightResults) {
          for (const op of operators) {
            const value = applyOperator(left, op, right);
            if (value !== null) {
              result.add(value);
            }
          }
        }
      }
    }

    return result;
  }

  const allResults = combine(numbers);
  return allResults.has(target);
}

/**
 * Apply a single operator to two operands.
 * Returns null for invalid operations (division by zero, non-integer division).
 */
function applyOperator(left: number, op: Operator, right: number): number | null {
  switch (op) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '×':
      return left * right;
    case '÷':
      if (right === 0) return null;
      if (left % right !== 0) return null;
      return left / right;
    default:
      return null;
  }
}

/**
 * Validate that equation tokens form a valid alternating sequence:
 * number, operator, number, operator, ..., number
 * with properly matched parentheses.
 */
export function isValidEquationStructure(tokens: readonly EquationToken[]): boolean {
  let depth = 0;
  let expectNumber = true;

  for (const token of tokens) {
    if (token === '(') {
      depth += 1;
      expectNumber = true;
    } else if (token === ')') {
      if (depth <= 0) return false;
      depth -= 1;
      expectNumber = false;
    } else if (typeof token === 'number') {
      if (!expectNumber) return false;
      expectNumber = false;
    } else if (typeof token === 'string' && ['+', '-', '×', '÷'].includes(token)) {
      if (expectNumber) return false;
      expectNumber = true;
    } else {
      return false;
    }
  }

  return depth === 0 && !expectNumber;
}

/**
 * Get the set of achievable targets for a given set of numbers and operators.
 * Used by the generator to find valid targets for procedural generation.
 */
export function getAchievableTargets(
  numbers: readonly number[],
  operators: readonly Operator[],
): Set<number> {
  function combine(nums: readonly number[]): Set<number> {
    if (nums.length === 1) {
      return new Set([nums[0]]);
    }

    const result = new Set<number>();

    for (let split = 1; split < nums.length; split++) {
      const leftNums = nums.slice(0, split);
      const rightNums = nums.slice(split);

      const leftResults = combine(leftNums);
      const rightResults = combine(rightNums);

      for (const left of leftResults) {
        for (const right of rightResults) {
          for (const op of operators) {
            const value = applyOperator(left, op, right);
            if (value !== null) {
              result.add(value);
            }
          }
        }
      }
    }

    return result;
  }

  return combine(numbers);
}

interface SolutionCandidate {
  readonly value: number;
  readonly tokens: EquationToken[];
}

/**
 * Find ONE token sequence that evaluates to `target` using every number in
 * `numbers` (each exactly once, in their given order) and only the allowed
 * operators. Returns null when no such equation exists.
 *
 * This is the reveal-side twin of `canSolve`: it searches the SAME space of
 * binary trees over contiguous number slices, so whenever the generator's
 * solvability proof (`canSolve`) succeeded, this reconstructs a witness
 * equation. Deterministic: subranges are enumerated split-ascending and
 * operators in list order; the first tree reaching the target wins.
 *
 * Composite children are wrapped in parentheses so the flat left-to-right
 * evaluation of `evaluateEquation` reproduces the tree's value exactly.
 */
export function findSolutionTokens(
  target: number,
  numbers: readonly number[],
  operators: readonly Operator[],
): EquationToken[] | null {
  if (numbers.length === 0) return null;

  // Memoized enumeration per contiguous subrange [i, j). Values are deduped
  // per subrange (first witness kept) to bound blowup without losing reach.
  const memo = new Map<string, SolutionCandidate[]>();

  function enumerate(i: number, j: number): SolutionCandidate[] {
    const key = `${i}:${j}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const results: SolutionCandidate[] = [];
    if (j - i === 1) {
      results.push({ value: numbers[i], tokens: [numbers[i]] });
    } else {
      const seen = new Set<number>();
      for (let split = i + 1; split < j; split += 1) {
        const lefts = enumerate(i, split);
        const rights = enumerate(split, j);
        for (const left of lefts) {
          for (const right of rights) {
            for (const op of operators) {
              const value = applyOperator(left.value, op, right.value);
              if (value === null || seen.has(value)) continue;
              seen.add(value);
              // Parenthesize composite children; a bare number needs none.
              const leftTokens =
                left.tokens.length === 1
                  ? left.tokens
                  : (['(', ...left.tokens, ')'] as EquationToken[]);
              const rightTokens =
                right.tokens.length === 1
                  ? right.tokens
                  : (['(', ...right.tokens, ')'] as EquationToken[]);
              results.push({
                value,
                tokens: [...leftTokens, op, ...rightTokens],
              });
            }
          }
        }
      }
    }

    memo.set(key, results);
    return results;
  }

  for (const candidate of enumerate(0, numbers.length)) {
    if (candidate.value === target) return candidate.tokens;
  }
  return null;
}
