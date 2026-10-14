import { describe, expect, it } from '@jest/globals';

import { createRng } from '@/sdk';
import { mathEquationBuilderParamsForLevel } from '../difficulty';
import { evaluateEquation, findSolutionTokens } from '../evaluator';
import { generatePuzzle } from '../generator';
import type { EquationToken, Operator } from '../types';

/** Independent shunting-yard oracle, separate from the production recursive parser. */
function ordinaryValue(tokens: readonly EquationToken[]): number {
  const values: number[] = [];
  const operators: (Operator | '(')[] = [];
  const precedence = { '+': 1, '-': 1, '×': 2, '÷': 2 };
  const apply = () => {
    const operator = operators.pop();
    const right = values.pop()!;
    const left = values.pop()!;
    if (operator === '+') values.push(left + right);
    else if (operator === '-') values.push(left - right);
    else if (operator === '×') values.push(left * right);
    else if (operator === '÷') {
      if (right === 0 || left % right !== 0) throw new Error('Witness uses invalid division');
      values.push(left / right);
    } else throw new Error('Malformed witness');
  };
  for (const token of tokens) {
    if (typeof token === 'number') values.push(token);
    else if (token === '(') operators.push(token);
    else if (token === ')') {
      while (operators[operators.length - 1] !== '(') apply();
      operators.pop();
    } else {
      let top = operators[operators.length - 1];
      while (top !== undefined && top !== '(' && precedence[top] >= precedence[token]) {
        apply();
        top = operators[operators.length - 1];
      }
      operators.push(token);
    }
  }
  while (operators.length > 0) apply();
  if (values.length !== 1 || !Number.isFinite(values[0])) throw new Error('Malformed witness result');
  return values[0];
}

describe('Equation Builder generated puzzles under ordinary notation', () => {
  it.each(['easy', 'normal', 'hard', 'expert', 'adaptive'] as const)('generates deterministic solvable %s puzzles with only the offered operands/operators', (level) => {
    const params = mathEquationBuilderParamsForLevel(level);
    for (let seedIndex = 0; seedIndex < 10; seedIndex += 1) {
      let previousTarget: number | null = null;
      const seed = `standard-${level}-${seedIndex}`;
      for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
        const input = { rng: createRng(seed), roundIndex, params, prevTarget: previousTarget };
        const puzzle = generatePuzzle(input);
        expect(generatePuzzle({ ...input, rng: createRng(seed) })).toEqual(puzzle);
        const witness = findSolutionTokens(puzzle.target, puzzle.numbers, puzzle.operators);
        expect(witness).not.toBeNull();
        expect(ordinaryValue(witness!)).toBe(puzzle.target);
        expect(evaluateEquation(witness!)).toBe(puzzle.target);
        expect(witness!.filter((token) => typeof token === 'number')).toEqual(puzzle.numbers);
        for (const token of witness!) {
          if (typeof token === 'string' && token !== '(' && token !== ')') expect(puzzle.operators).toContain(token);
        }
        expect(puzzle.target).toBeGreaterThanOrEqual(params.targetMin);
        expect(puzzle.target).toBeLessThanOrEqual(params.targetMax);
        expect(puzzle.target).not.toBe(previousTarget);
        previousTarget = puzzle.target;
      }
    }
  });
});
