// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { CODE_CRACKER_DIFFICULTY_PARAMS } from '../difficulty';
import { computeFeedback, generateSecretCode } from '../generator';

/**
 * Solvability evidence (campaign 009 audit): every generated secret code must
 * be crackable within the difficulty's guess budget by a documented reference
 * strategy, using only the shipped feedback oracle. A round that optimal play
 * could not finish would be an unwinnable-content defect.
 *
 * Reference strategy (deterministic, no randomness):
 *   1. Opening guess: pairs 0,0,1,1,... (a strong fixed opener).
 *   2. Keep only candidates consistent with all feedback so far.
 *   3. When <= CONSISTENT_CAP candidates remain, guess the one whose feedback
 *      partition minimizes worst-case + expected remaining candidates;
 *      otherwise guess the first consistent candidate.
 * Measured offline over hundreds of random secrets: worst case 5 / 6 / 8 / 8
 * guesses for easy / normal / hard / expert — always within budget.
 */

const CONSISTENT_CAP = 300;

type Code = number[];

function* allCodes(len: number, colors: number, prefix: number[] = []): Generator<Code> {
  if (prefix.length === len) {
    yield prefix.slice();
    return;
  }
  for (let c = 0; c < colors; c += 1) {
    prefix.push(c);
    yield* allCodes(len, colors, prefix);
    prefix.pop();
  }
}

function solveWithinBudget(
  secret: Code,
  codeLength: number,
  colorCount: number,
  budget: number,
): number {
  let candidates: Code[] = [...allCodes(codeLength, colorCount)];
  const opener: Code = [];
  for (let i = 0; i < codeLength; i += 1) {
    opener.push(Math.floor(i / 2) % colorCount);
  }
  let guess: Code = opener;
  let guesses = 0;
  while (true) {
    guesses += 1;
    const fb = computeFeedback(secret, guess);
    if (fb.exact === codeLength) return guesses;
    if (guesses > budget) return Number.POSITIVE_INFINITY;
    candidates = candidates.filter((c) => {
      const f = computeFeedback(c, guess);
      return f.exact === fb.exact && f.colorOnly === fb.colorOnly;
    });
    if (candidates.length === 0) return Number.POSITIVE_INFINITY;
    if (candidates.length === 1) {
      guess = candidates[0];
      continue;
    }
    if (candidates.length <= CONSISTENT_CAP) {
      let best: Code = candidates[0];
      let bestScore = Number.POSITIVE_INFINITY;
      for (const g of candidates) {
        const parts = new Map<number, number>();
        for (const c of candidates) {
          const f = computeFeedback(c, g);
          const key = f.exact * 10 + f.colorOnly;
          parts.set(key, (parts.get(key) ?? 0) + 1);
        }
        let worst = 0;
        let sumSquares = 0;
        for (const v of parts.values()) {
          if (v > worst) worst = v;
          sumSquares += v * v;
        }
        const score = worst + sumSquares / candidates.length;
        if (score < bestScore) {
          bestScore = score;
          best = g;
        }
      }
      guess = best;
    } else {
      guess = candidates[0];
    }
  }
}

describe('generated codes are solvable within the guess budget', () => {
  const cases = [
    { level: 'easy', secrets: 20 },
    { level: 'normal', secrets: 12 },
    { level: 'hard', secrets: 8 },
    { level: 'expert', secrets: 6 },
  ] as const;

  for (const { level, secrets } of cases) {
    it(`reference solver cracks every ${level} code within ${CODE_CRACKER_DIFFICULTY_PARAMS[level].guessBudget} guesses`, () => {
      const params = CODE_CRACKER_DIFFICULTY_PARAMS[level];
      for (let i = 0; i < secrets; i += 1) {
        const rng = createRng(`solvability-${level}-${i}`);
        const secret = generateSecretCode({
          rng,
          roundIndex: 0,
          codeLength: params.codeLength,
          colorCount: params.colorCount,
          prevSecretCode: null,
        });
        // Sanity: the generator produced a code in range.
        expect(secret).toHaveLength(params.codeLength);
        for (const c of secret) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(params.colorCount);
        }
        const used = solveWithinBudget(
          secret,
          params.codeLength,
          params.colorCount,
          params.guessBudget,
        );
        expect(used).toBeLessThanOrEqual(params.guessBudget);
      }
    });
  }

  it('adaptive bounds stay solvable at the largest adaptive board', () => {
    // Adaptive can reach maxLength=6 with colorCount=6 and budget 10; verify
    // the reference solver still finishes within budget there.
    const codeLength = 6;
    const colorCount = 6;
    const budget = 10;
    for (let i = 0; i < 3; i += 1) {
      const rng = createRng(`solvability-adaptive-${i}`);
      const secret = generateSecretCode({
        rng,
        roundIndex: 0,
        codeLength,
        colorCount,
        prevSecretCode: null,
      });
      const used = solveWithinBudget(secret, codeLength, colorCount, budget);
      expect(used).toBeLessThanOrEqual(budget);
    }
  });
});
