// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_ATTEMPTS,
  buildSymbolOptions,
  generateRound,
  generateSquare,
  isUniquelySolvable,
  validateGeneratedRound,
} from '../generator';
import type { RuleGridRound } from '../types';

interface SessionParams {
  size: number;
  rounds: number;
  roundTimeMs: number;
}

function fullSession(seed: string, size = 4, rounds = 4): RuleGridRound[] {
  const rng = createRng(seed);
  const params: SessionParams = { size, rounds, roundTimeMs: 20000 };
  const out: RuleGridRound[] = [];
  let prev: RuleGridRound | null = null;
  for (let i = 0; i < rounds; i += 1) {
    const round = generateRound({ rng, roundIndex: i, params, prevRound: prev });
    out.push(round);
    prev = round;
  }
  return out;
}

/** Verify every row and every column is a permutation of 0..n-1. */
function assertLatinSquare(square: readonly (readonly number[])[], n: number): void {
  const full = new Set(Array.from({ length: n }, (_, i) => i));
  for (let r = 0; r < n; r += 1) {
    expect(new Set(square[r])).toEqual(full);
  }
  for (let c = 0; c < n; c += 1) {
    const col = new Set<number>();
    for (let r = 0; r < n; r += 1) {
      col.add(square[r][c]);
    }
    expect(col).toEqual(full);
  }
}

describe('generateSquare', () => {
  it('produces a valid Latin square for many sizes and seeds', () => {
    for (const n of [3, 4, 5, 6]) {
      for (let s = 0; s < 20; s += 1) {
        const square = generateSquare(n, createRng(`sq-${n}-${s}`));
        expect(square).toHaveLength(n);
        assertLatinSquare(square, n);
      }
    }
  });
});

describe('generateRound', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42')).toEqual(fullSession('seed-42'));
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a');
    const b = fullSession('seed-b');
    expect(a[0].square).not.toEqual(b[0].square);
    expect(a).not.toEqual(b);
  });

  it('generates a valid Latin square for every round across many seeds/sizes', () => {
    for (const size of [3, 4, 5, 6]) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const session = fullSession(String(seed), size, 5);
        for (const round of session) {
          expect(round.size).toBe(size);
          assertLatinSquare(round.square, size);
        }
      }
    }
  });

  it('blanks exactly one cell and records the unique answer', () => {
    const session = fullSession('blank-check', 4, 4);
    for (const round of session) {
      expect(round.blankIndex).toBeGreaterThanOrEqual(0);
      expect(round.blankIndex).toBeLessThan(round.size * round.size);
      expect(round.answer).toBe(round.square[round.blankRow][round.blankCol]);
    }
  });

  it('every blank is uniquely solvable (validated) across many seeds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const session = fullSession(String(seed), 5, 5);
      for (const round of session) {
        expect(validateGeneratedRound(round)).toBe(true);
      }
    }
  });

  it('options include the answer and are plausible (4-5 for n>=4) across many seeds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const session = fullSession(String(seed), 4, 4);
      for (const round of session) {
        expect(round.options).toContain(round.answer);
        const distinct = new Set(round.options);
        expect(distinct.size).toBe(round.options.length);
        for (const o of round.options) {
          expect(o).toBeGreaterThanOrEqual(0);
          expect(o).toBeLessThan(round.size);
        }
        expect(round.options.length).toBeGreaterThanOrEqual(4);
        expect(round.options.length).toBeLessThanOrEqual(5);
      }
    }
  });

  it('avoids near-duplicate blank positions between consecutive rounds for many seeds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const session = fullSession(String(seed), 4, 6);
      for (let i = 1; i < session.length; i += 1) {
        const prev = session[i - 1];
        const cur = session[i];
        const samePosition = prev.blankRow === cur.blankRow && prev.blankCol === cur.blankCol;
        expect(samePosition).toBe(false);
      }
    }
  });

  it('is bounded: generation always terminates deterministically', () => {
    const rng = createRng('budget');
    const round = generateRound({ rng, roundIndex: 1, params: { size: 4, rounds: 4, roundTimeMs: 1 }, prevRound: null });
    expect(round.square).toHaveLength(4);
    expect(MAX_ATTEMPTS).toBeGreaterThan(0);
    expect(validateGeneratedRound(round)).toBe(true);
  });
});

describe('isUniquelySolvable', () => {
  it('returns true for a valid Latin square with a uniquely-solvable blank', () => {
    const n = 4;
    const square = generateSquare(n, createRng('unique'));
    const blankIndex = 5;
    const answer = square[1][1];
    expect(isUniquelySolvable(square, blankIndex, n, answer)).toBe(true);
  });
});

describe('buildSymbolOptions', () => {
  it('always includes the answer and stays within the target size', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const fork = createRng(`opt-${seed}`);
      const options = buildSymbolOptions(fork, 2, 5);
      expect(options).toContain(2);
      expect(options.length).toBeLessThanOrEqual(5);
      expect(options.length).toBeGreaterThanOrEqual(4);
    }
  });
});
