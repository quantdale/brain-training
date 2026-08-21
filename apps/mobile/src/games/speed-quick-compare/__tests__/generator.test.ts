// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { generateRound, generateSessionRounds, validateRound } from '../generator';
import { quickCompareParamsForLevel } from '../difficulty';
import type { QuickCompareDifficultyParams } from '../types';

const LEVELS: DifficultyLevel[] = ['easy', 'normal', 'hard', 'expert', 'adaptive'];

describe('generateRound', () => {
  it('produces a valid, unambiguous round for every level over many seeds', () => {
    for (const level of LEVELS) {
      const params = quickCompareParamsForLevel(level);
      for (let seed = 0; seed < 200; seed += 1) {
        const round = generateRound(createRng(String(seed)), 0, params);
        const validation = validateRound(round);
        expect(validation.ok, `level=${level} seed=${seed}: ${validation.reason}`).toBe(true);
      }
    }
  });

  it('keeps exactly one correct option among distinct labels', () => {
    const params = quickCompareParamsForLevel('normal');
    const round = generateRound(createRng('labels'), 0, params);
    const unique = new Set(round.optionLabels);
    expect(unique.size).toBe(round.optionLabels.length);
    // exactly one label maps to the canonical correct answer
    const expected = round.left.numbers[0] === round.right.numbers[0]
      ? 'Same'
      : round.left.numbers[0] > round.right.numbers[0]
        ? 'Left'
        : 'Right';
    const matches = round.optionLabels.filter((l) => l === expected);
    expect(matches).toHaveLength(1);
    expect(round.optionLabels.indexOf(expected)).toBe(round.correctIndex);
  });

  it('enforces the fairness invariant per prompt type', () => {
    const normal = quickCompareParamsForLevel('normal');
    for (let seed = 0; seed < 100; seed += 1) {
      const round = generateRound(createRng(`inv-${seed}`), seed, normal);
      if (round.promptType === 'same-different') {
        const same = round.left.numbers[0] === round.right.numbers[0];
        // Either both equal (answer Same) or both distinct (answer Different).
        expect(round.correctIndex === round.optionLabels.indexOf('Same')).toBe(same);
      } else if (round.promptType === 'magnitude') {
        expect(round.left.numbers[0]).not.toBe(round.right.numbers[0]);
      } else {
        const sumL = round.left.numbers.reduce((a, b) => a + b, 0);
        const sumR = round.right.numbers.reduce((a, b) => a + b, 0);
        expect(sumL).not.toBe(sumR);
      }
    }
  });

  it('respects the configured option count (filler distractors)', () => {
    const expert = quickCompareParamsForLevel('expert');
    const round = generateRound(createRng('optcount'), 0, expert);
    expect(round.optionLabels).toHaveLength(expert.optionCount);
  });

  it('stays within the configured magnitude', () => {
    const easy = quickCompareParamsForLevel('easy');
    const round = generateRound(createRng('mag'), 0, easy);
    const max = Math.max(...round.left.numbers, ...round.right.numbers);
    expect(max).toBeLessThanOrEqual(easy.maxValue);
  });
});

describe('generateSessionRounds', () => {
  it('is deterministic for a fixed seed', () => {
    const params = quickCompareParamsForLevel('normal');
    const a = generateSessionRounds(createRng('session'), params, params.rounds);
    const b = generateSessionRounds(createRng('session'), params, params.rounds);
    expect(a).toEqual(b);
    expect(a).toHaveLength(params.rounds);
    for (const round of a) {
      expect(validateRound(round).ok).toBe(true);
    }
  });

  it('produces varied prompt types when several are allowed', () => {
    const normal = quickCompareParamsForLevel('normal');
    const rounds = generateSessionRounds(createRng('variety'), normal, 40);
    const types = new Set(rounds.map((r) => r.promptType));
    expect(types.size).toBeGreaterThan(1);
  });
});

describe('validateRound', () => {
  it('flags a duplicated option label', () => {
    const params: QuickCompareDifficultyParams = quickCompareParamsForLevel('normal');
    const round = generateRound(createRng('dup'), 0, params);
    const broken = { ...round, optionLabels: [round.optionLabels[0], round.optionLabels[0]] };
    expect(validateRound(broken).ok).toBe(false);
  });

  it('flags a mis-pointed correctIndex', () => {
    const params = quickCompareParamsForLevel('normal');
    const round = generateRound(createRng('mis'), 0, params);
    const broken = { ...round, correctIndex: (round.correctIndex + 1) % round.optionLabels.length };
    expect(validateRound(broken).ok).toBe(false);
  });
});
