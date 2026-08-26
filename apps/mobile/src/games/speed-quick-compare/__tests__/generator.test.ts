// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import {
  DECOY_BAND,
  buildDecoyValues,
  generateRound,
  generateSessionRounds,
  validateRound,
} from '../generator';
import { quickCompareParamsForLevel } from '../difficulty';
import type { QuickCompareDifficultyParams, QuickCompareRound } from '../types';

const LEVELS: DifficultyLevel[] = ['easy', 'normal', 'hard', 'expert', 'adaptive'];

function sumOf(round: QuickCompareRound, side: 'left' | 'right'): number {
  return round[side].numbers.reduce((a, b) => a + b, 0);
}

/** The canonical correct value/label of a round (mirrors the generator rule). */
function correctAnswerOf(round: QuickCompareRound): string {
  if (round.promptType === 'same-different') {
    return round.left.numbers[0] === round.right.numbers[0] ? 'Same' : 'Different';
  }
  if (round.promptType === 'magnitude') {
    return String(Math.max(round.left.numbers[0], round.right.numbers[0]));
  }
  return String(Math.max(sumOf(round, 'left'), sumOf(round, 'right')));
}

describe('generateRound', () => {
  it('produces a valid, unambiguous round for every level over many seeds', () => {
    for (const level of LEVELS) {
      const params = quickCompareParamsForLevel(level);
      for (let seed = 0; seed < 200; seed += 1) {
        const round = generateRound(createRng(String(seed)), 0, params);
        const validation = validateRound(round);
        // @jest/globals' typed expect takes a single argument; keep the
        // level/seed context via an explicit failure instead.
        if (!validation.ok) {
          throw new Error(`level=${level} seed=${seed}: ${validation.reason}`);
        }
        expect(validation.ok).toBe(true);
      }
    }
  });

  it('keeps exactly one correct option among distinct labels (v2 numeric options)', () => {
    const params = quickCompareParamsForLevel('normal');
    for (let seed = 0; seed < 100; seed += 1) {
      const round = generateRound(createRng(`labels-${seed}`), seed % 8, params);
      const unique = new Set(round.optionLabels);
      expect(unique.size).toBe(round.optionLabels.length);
      const expected = correctAnswerOf(round);
      const matches = round.optionLabels.filter((l) => l === expected);
      expect(matches).toHaveLength(1);
      expect(round.optionLabels.indexOf(expected)).toBe(round.correctIndex);
    }
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
        expect(sumOf(round, 'left')).not.toBe(sumOf(round, 'right'));
      }
    }
  });

  it('stays within the configured magnitude', () => {
    const easy = quickCompareParamsForLevel('easy');
    const round = generateRound(createRng('mag'), 0, easy);
    const max = Math.max(...round.left.numbers, ...round.right.numbers);
    expect(max).toBeLessThanOrEqual(easy.maxValue);
  });
});

describe('v2 numeric decoys', () => {
  it('gives same/different rounds exactly the binary pair at every optionCount', () => {
    for (const level of LEVELS) {
      const params = quickCompareParamsForLevel(level);
      for (let seed = 0; seed < 60; seed += 1) {
        const round = generateRound(createRng(`bin-${seed}`), seed % 6, params);
        if (round.promptType !== 'same-different') {
          continue;
        }
        expect([...round.optionLabels].sort()).toEqual(['Different', 'Same']);
      }
    }
  });

  it('numeric prompts carry optionCount plausible values including the true answer', () => {
    for (const level of ['normal', 'hard', 'expert'] as const) {
      const params = quickCompareParamsForLevel(level);
      let sawNumeric = false;
      for (let seed = 0; seed < 120 && !sawNumeric; seed += 1) {
        const round = generateRound(createRng(`num-${seed}`), seed % 6, params);
        if (round.promptType === 'same-different') {
          continue;
        }
        sawNumeric = true;
        expect(round.optionLabels).toHaveLength(params.optionCount);
        const correct = Number(correctAnswerOf(round));
        const numbers = round.optionLabels.map(Number);
        expect(numbers.filter((n) => n === correct)).toHaveLength(1); // uniqueness
        for (const n of numbers) {
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(1);
        }
      }
      expect(sawNumeric).toBe(true);
    }
  });

  it('keeps decoys inside the ±15% plausibility band whenever the band can supply them', () => {
    const levels: DifficultyLevel[] = ['normal', 'hard', 'expert', 'adaptive'];
    for (const level of levels) {
      const params = quickCompareParamsForLevel(level);
      for (let seed = 0; seed < 120; seed += 1) {
        const round = generateRound(createRng(`band-${seed}`), seed % 6, params);
        if (round.promptType === 'same-different') {
          continue;
        }
        const correct = Number(correctAnswerOf(round));
        const shown =
          round.promptType === 'magnitude'
            ? [round.left.numbers[0], round.right.numbers[0]]
            : [sumOf(round, 'left'), sumOf(round, 'right')];
        const lo = Math.min(...shown);
        const hi = Math.max(...shown);
        const bandLo = Math.max(1, Math.ceil(lo * (1 - DECOY_BAND)));
        const bandHi = Math.floor(hi * (1 + DECOY_BAND));
        // In-band supply excluding the correct value itself:
        const supply = Math.max(0, bandHi - bandLo + 1) - (correct >= bandLo && correct <= bandHi ? 1 : 0);
        const needed = params.optionCount - 1;
        if (supply >= needed) {
          for (const label of round.optionLabels) {
            const n = Number(label);
            if (n === correct) {
              continue;
            }
            expect(n).toBeGreaterThanOrEqual(bandLo);
            expect(n).toBeLessThanOrEqual(bandHi);
          }
        }
      }
    }
  });

  it('orders raw decoys closest-first and never repeats or hits the answer', () => {
    const samples: [number, number][] = [
      [50, 40],
      [7, 3],
      [2, 3],
      [99, 98],
      [1, 2],
    ];
    for (const [correct, otherShown] of samples) {
      const decoys = buildDecoyValues(correct, otherShown, 3);
      expect(decoys).toHaveLength(3);
      expect(new Set(decoys).size).toBe(3);
      for (const d of decoys) {
        expect(d).not.toBe(correct);
        expect(d).toBeGreaterThanOrEqual(1);
      }
      // The other shown operand is always the first (most plausible) decoy.
      expect(decoys[0]).toBe(otherShown);
    }
  });
});

describe('proximity pressure (spreadPct)', () => {
  it('configures a strictly shrinking gap budget across tiers', () => {
    const spreads = ['easy', 'normal', 'hard', 'expert'].map(
      (l) => quickCompareParamsForLevel(l as DifficultyLevel).spreadPct,
    );
    expect(spreads).toEqual([60, 40, 25, 15]);
  });

  it('bounds generated magnitude gaps by the configured spread', () => {
    for (const level of ['normal', 'hard', 'expert'] as const) {
      const params = quickCompareParamsForLevel(level);
      const spreadPct = params.spreadPct ?? 100;
      let checked = 0;
      for (let seed = 0; seed < 150 && checked < 50; seed += 1) {
        const round = generateRound(createRng(`gap-${seed}`), seed % 6, params);
        if (round.promptType !== 'magnitude') {
          continue;
        }
        const a = round.left.numbers[0];
        const b = round.right.numbers[0];
        const bigger = Math.max(a, b);
        // The draw stays inside the spread window after clamping to
        // [1, maxValue]; rounding at the window edges can overshoot by <1%.
        const tolerance = Math.ceil((spreadPct / 100) * bigger) + 1;
        expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(0);
    }
  });

  it('bounds generated sum-compare gaps by the configured spread', () => {
    for (const level of ['normal', 'hard', 'expert'] as const) {
      const params = quickCompareParamsForLevel(level);
      const spreadPct = params.spreadPct ?? 100;
      let checked = 0;
      for (let seed = 0; seed < 150 && checked < 30; seed += 1) {
        const round = generateRound(createRng(`gapsum-${seed}`), seed % 6, params);
        if (round.promptType !== 'sum-compare') {
          continue;
        }
        const sl = sumOf(round, 'left');
        const sr = sumOf(round, 'right');
        const tolerance = Math.ceil((spreadPct / 100) * Math.max(sl, sr)) + 1;
        expect(Math.abs(sl - sr)).toBeLessThanOrEqual(tolerance);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(0);
    }
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
