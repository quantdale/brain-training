// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  generatePuzzle,
  solveSequence,
} from '../generator';
import { LOGIC_DIFFICULTY_PARAMS } from '../difficulty';
import type { LogicPuzzle } from '../types';

/**
 * Audit regression: the independent solver (`solveSequence`) and the generator
 * must agree on the answer for every emitted puzzle, and the player-facing
 * options must encode exactly that answer. This guards against a
 * solver/generator mismatch (a known logic-game defect class).
 */
describe('next-sequence solver/generator consistency', () => {
  const levels = ['easy', 'normal', 'hard', 'expert'] as const;

  for (const level of levels) {
    it(`generator answer always matches solveSequence for ${level} across many seeds`, () => {
      const params = LOGIC_DIFFICULTY_PARAMS[level];
      const seeds = Array.from({ length: 50 }, (_, i) => `consistency-${level}-${i}`);
      for (const seed of seeds) {
        const rng = createRng(seed);
        let prevPuzzle: LogicPuzzle | null = null;
        for (let round = 0; round < params.rounds; round += 1) {
          const puzzle = generatePuzzle({
            rng,
            roundIndex: round,
            tier: params.recipeTier,
            params,
            prevPuzzle,
          });
          // The independent solver must identify the same family and answer.
          const solved = solveSequence(puzzle.terms);
          expect(solved).not.toBeNull();
          expect(solved?.family).toBe(puzzle.family);
          expect(solved?.next).toBe(puzzle.answer);
          // The option set must encode exactly one correct answer.
          expect(puzzle.options[puzzle.answerIndex]).toBe(puzzle.answer);
          expect(new Set(puzzle.options).size).toBe(puzzle.options.length);
          expect(puzzle.options).toHaveLength(4);
          for (const value of puzzle.options) {
            expect(value).toBeGreaterThanOrEqual(params.minValue);
            expect(value).toBeLessThanOrEqual(params.maxValue);
          }
          prevPuzzle = puzzle;
        }
      }
    });
  }

  it('is deterministic: same seed reproduces the same puzzles', () => {
    const params = LOGIC_DIFFICULTY_PARAMS.normal;
    const build = (seed: string): LogicPuzzle[] => {
      const rng = createRng(seed);
      const out: LogicPuzzle[] = [];
      let prev: LogicPuzzle | null = null;
      for (let round = 0; round < params.rounds; round += 1) {
        const p = generatePuzzle({ rng, roundIndex: round, tier: params.recipeTier, params, prevPuzzle: prev });
        out.push(p);
        prev = p;
      }
      return out;
    };
    expect(build('det')).toEqual(build('det'));
  });
});
