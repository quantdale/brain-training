// Solution-reveal suite (campaign 014): the failure UI reveals one valid
// solution computed by `findSolutionTokens`. These tests pin the contract:
// the revealed equation must exist for every shippable puzzle, evaluate to
// the target through the canonical evaluator, consume exactly the offered
// numbers (in order), use only allowed operators, and be deterministic.
// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { evaluateEquation, findSolutionTokens, isValidEquationStructure } from '../evaluator';
import { MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS } from '../difficulty';
import { PUZZLE_TEMPLATES, generatePuzzle } from '../generator';

/** Numbers appearing in the token stream, in order. */
function numbersOf(tokens: readonly (number | string)[]): number[] {
  return tokens.filter((t): t is number => typeof t === 'number');
}

describe('findSolutionTokens', () => {
  it('finds a witness equation for every curated template in the bank', () => {
    for (const template of PUZZLE_TEMPLATES) {
      const solution = findSolutionTokens(
        template.target,
        template.numbers,
        ['+', '-', '×', '÷'],
      );
      expect(solution).not.toBeNull();
      expect(evaluateEquation(solution!)).toBe(template.target);
    }
  });

  it('reveals solutions for generated puzzles under each level’s own operator mix', () => {
    for (const [level, params] of Object.entries(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS)) {
      for (let seed = 1; seed <= 15; seed += 1) {
        const puzzle = generatePuzzle({
          rng: createRng(`reveal-${level}-${seed}`),
          roundIndex: 0,
          params,
          prevTarget: null,
        });
        const solution = findSolutionTokens(puzzle.target, puzzle.numbers, params.operators);

        // The generator proved solvability, so a witness must exist…
        expect(solution).not.toBeNull();
        const tokens = solution!;
        // …and it must evaluate to the target through the canonical evaluator.
        expect(evaluateEquation(tokens)).toBe(puzzle.target);
        // It consumes exactly the offered numbers, in their given order.
        expect(numbersOf(tokens)).toEqual([...puzzle.numbers]);
        // It only uses operators the round allows.
        for (const token of tokens) {
          if (typeof token === 'string' && token !== '(' && token !== ')') {
            expect(params.operators).toContain(token);
          }
        }
        // It satisfies the shared grammar validator.
        expect(isValidEquationStructure(tokens)).toBe(true);
      }
    }
  });

  it('is deterministic: identical inputs yield an identical witness', () => {
    const a = findSolutionTokens(89, [2, 7, 9, 3, 5], ['+', '-', '×', '÷']);
    const b = findSolutionTokens(89, [2, 7, 9, 3, 5], ['+', '-', '×', '÷']);
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
    // The witness is a pure function of its arguments — no RNG involvement.
    expect(evaluateEquation(a!)).toBe(89);
  });

  it('returns null when no equation reaches the target', () => {
    // With '+' only, [2, 4] can only ever make 6.
    expect(findSolutionTokens(7, [2, 4], ['+'])).toBeNull();
    expect(findSolutionTokens(6, [2, 4], ['+'])).not.toBeNull();
  });

  it('handles the single-number degenerate case', () => {
    expect(findSolutionTokens(9, [9], ['+'])).toEqual([9]);
    expect(findSolutionTokens(8, [9], ['+'])).toBeNull();
  });
});
