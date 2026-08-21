// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { RULE_GRID_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import type { RuleGridRound } from '../types';

/**
 * Independent uniqueness evidence (campaign 009 audit): verify with inline
 * logic (not the game's `isUniquelySolvable`) that (a) each generated board is
 * a Latin square and (b) exactly one symbol can fill the blank — the shipped
 * answer.
 */
function independentCheck(round: RuleGridRound): void {
  const n = round.size;
  // (a) Latin square: every row and column is a permutation of 0..n-1.
  const full = new Set(Array.from({ length: n }, (_, i) => i));
  for (let r = 0; r < n; r += 1) {
    expect(new Set(round.square[r])).toEqual(full);
  }
  for (let c = 0; c < n; c += 1) {
    const col = new Set<number>();
    for (let r = 0; r < n; r += 1) col.add(round.square[r][c]);
    expect(col).toEqual(full);
  }
  // (b) Exactly one symbol fits the blank (absent from its row AND column).
  const rowValues = new Set<number>();
  for (let c = 0; c < n; c += 1) {
    if (c !== round.blankCol) rowValues.add(round.square[round.blankRow][c]);
  }
  const colValues = new Set<number>();
  for (let r = 0; r < n; r += 1) {
    if (r !== round.blankRow) colValues.add(round.square[r][round.blankCol]);
  }
  const fitting: number[] = [];
  for (let s = 0; s < n; s += 1) {
    if (!rowValues.has(s) && !colValues.has(s)) fitting.push(s);
  }
  expect(fitting).toEqual([round.answer]);
}

describe('rule-grid independent uniqueness property', () => {
  const levels = ['easy', 'normal', 'hard', 'expert'] as const;

  for (const level of levels) {
    it(`every generated ${level} board is a Latin square with a forced blank (many seeds)`, () => {
      const params = RULE_GRID_DIFFICULTY_PARAMS[level];
      const seeds = Array.from({ length: 25 }, (_, i) => `independent-${level}-${i}`);
      for (const seed of seeds) {
        let prev: RuleGridRound | null = null;
        for (let round = 0; round < Math.min(params.rounds, 3); round += 1) {
          const generated = generateRound({
            rng: createRng(`${seed}-${round}`),
            roundIndex: round,
            params,
            prevRound: prev,
          });
          independentCheck(generated);
          prev = generated;
        }
      }
    });
  }
});
