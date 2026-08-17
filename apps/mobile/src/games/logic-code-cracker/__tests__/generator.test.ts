// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_CODE_ATTEMPTS,
  MIN_CODE_HAMMING_DISTANCE,
  generateSecretCode,
  computeFeedback,
  bruteForceFeedback,
  codeDistance,
  isNearDuplicate,
} from '../generator';

function fullSession(seed: string, codeLength = 4, colorCount = 6, rounds = 4): number[][] {
  const rng = createRng(seed);
  const codes: number[][] = [];
  let prev: number[] | null = null;
  for (let round = 0; round < rounds; round += 1) {
    const code = generateSecretCode({ rng, roundIndex: round, codeLength, colorCount, prevSecretCode: prev });
    codes.push(code);
    prev = code;
  }
  return codes;
}

describe('generateSecretCode', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42')).toEqual(fullSession('seed-42'));
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a');
    const b = fullSession('seed-b');
    expect(a[0]).not.toEqual(b[0]);
    expect(a).not.toEqual(b);
  });

  it('generates codes of correct length with valid colors', () => {
    const rng = createRng('color-check');
    const code = generateSecretCode({ rng, roundIndex: 0, codeLength: 4, colorCount: 6, prevSecretCode: null });
    expect(code).toHaveLength(4);
    for (const color of code) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThan(6);
    }
  });

  it('allows repeated colors (sampling with replacement)', () => {
    // With 2 colors and length 4, repeats are almost guaranteed.
    const codes = fullSession('repeat-test', 4, 2, 10);
    // At least one code should have a repeated color.
    const hasRepeat = codes.some((code) => new Set(code).size < code.length);
    expect(hasRepeat).toBe(true);
  });

  it('avoids near-duplicates between consecutive rounds for many seeds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sessions = fullSession(String(seed));
      for (let round = 1; round < sessions.length; round += 1) {
        const prev = sessions[round - 1];
        const current = sessions[round];
        if (prev.length >= 2) {
          expect(codeDistance(current, prev)).toBeGreaterThanOrEqual(
            MIN_CODE_HAMMING_DISTANCE,
          );
        }
      }
    }
  });

  it('works with different color counts', () => {
    const rng = createRng('color-count');
    const code = generateSecretCode({ rng, roundIndex: 0, codeLength: 5, colorCount: 8, prevSecretCode: null });
    expect(code).toHaveLength(5);
    expect(Math.max(...code)).toBeLessThan(8);
  });

  it('is bounded: generation always terminates deterministically', () => {
    const rng = createRng('budget');
    const previous = [0, 0, 0, 0];
    const code = generateSecretCode({ rng, roundIndex: 1, codeLength: 4, colorCount: 6, prevSecretCode: previous });
    expect(code).toHaveLength(4);
    expect(MAX_CODE_ATTEMPTS).toBeGreaterThan(0);
  });
});

describe('computeFeedback', () => {
  it('returns full exact match for identical codes', () => {
    expect(computeFeedback([1, 2, 3, 4], [1, 2, 3, 4])).toEqual({ exact: 4, colorOnly: 0 });
  });

  it('returns zero feedback for completely different codes', () => {
    expect(computeFeedback([1, 2, 3, 4], [5, 6, 7, 8])).toEqual({ exact: 0, colorOnly: 0 });
  });

  it('counts exact matches correctly', () => {
    expect(computeFeedback([1, 2, 3, 4], [1, 5, 3, 6])).toEqual({ exact: 2, colorOnly: 0 });
  });

  it('counts color-only matches correctly', () => {
    // Secret: [1, 2, 3, 4], Guess: [4, 3, 2, 1] — all color-only
    expect(computeFeedback([1, 2, 3, 4], [4, 3, 2, 1])).toEqual({ exact: 0, colorOnly: 4 });
  });

  it('does not double-count: exact takes priority', () => {
    // Secret: [1, 1, 2, 3], Guess: [1, 2, 1, 4]
    // Position 0: exact (1=1)
    // Position 2: color-only (1 in guess matches 1 in secret at pos 1)
    // Position 1: color-only (2 in guess matches 2 in secret at pos 2)
    expect(computeFeedback([1, 1, 2, 3], [1, 2, 1, 4])).toEqual({ exact: 1, colorOnly: 2 });
  });

  it('handles duplicate colors in guess and secret correctly', () => {
    // Secret: [1, 1, 2, 2], Guess: [1, 2, 1, 2]
    // Position 0: exact (1=1)
    // Position 1: color-only (2 in guess matches 2 in secret at pos 2)
    // Position 2: color-only (1 in guess matches 1 in secret at pos 1)
    // Position 3: exact (2=2)
    expect(computeFeedback([1, 1, 2, 2], [1, 2, 1, 2])).toEqual({ exact: 2, colorOnly: 2 });
  });

  it('handles case where guess has more of a color than secret', () => {
    // Secret: [1, 2, 3, 4], Guess: [1, 1, 1, 1]
    // Position 0: exact (1=1)
    // Position 1: color-only (1 in guess matches 1 in secret at pos ?)
    // But secret only has one 1, so only 1 color-only max
    const result = computeFeedback([1, 2, 3, 4], [1, 1, 1, 1]);
    expect(result.exact).toBe(1);
    expect(result.colorOnly).toBe(0); // No more 1s in secret to match
  });

  it('matches brute-force oracle on random inputs', () => {
    const rng = createRng('oracle-cross-check');
    for (let i = 0; i < 100; i += 1) {
      const len = rng.nextIntRange(2, 6);
      const colorCount = rng.nextIntRange(2, 8);
      const secret = Array.from({ length: len }, () => rng.nextInt(colorCount));
      const guess = Array.from({ length: len }, () => rng.nextInt(colorCount));
      const optimized = computeFeedback(secret, guess);
      const brute = bruteForceFeedback(secret, guess);
      expect(optimized).toEqual(brute);
    }
  });

  it('throws on length mismatch', () => {
    expect(() => computeFeedback([1, 2], [1])).toThrow('secret length 2 !== guess length 1');
  });
});

describe('bruteForceFeedback', () => {
  it('produces same results as optimized oracle', () => {
    expect(bruteForceFeedback([1, 2, 3, 4], [1, 2, 3, 4])).toEqual({ exact: 4, colorOnly: 0 });
    expect(bruteForceFeedback([1, 2, 3, 4], [4, 3, 2, 1])).toEqual({ exact: 0, colorOnly: 4 });
    expect(bruteForceFeedback([1, 1, 2, 2], [1, 2, 1, 2])).toEqual({ exact: 2, colorOnly: 2 });
  });
});

describe('codeDistance / isNearDuplicate', () => {
  it('treats a null previous code as infinitely far', () => {
    expect(codeDistance([1, 2], null)).toBe(Number.POSITIVE_INFINITY);
    expect(isNearDuplicate([1, 2], null)).toBe(false);
  });

  it('measures length difference plus positional differences', () => {
    expect(codeDistance([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(codeDistance([1, 2, 3], [1, 2, 4])).toBe(1);
    expect(codeDistance([1, 2, 3], [1, 2])).toBe(1);
    expect(codeDistance([1, 2, 3], [4, 5, 6])).toBe(3);
    expect(codeDistance([1, 2, 3, 4], [1, 2])).toBe(2);
  });

  it('flags near-duplicates below the threshold', () => {
    expect(isNearDuplicate([1, 2, 3], [1, 2, 4])).toBe(true);
    expect(isNearDuplicate([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isNearDuplicate([1, 2], [1, 3])).toBe(true);
    expect(isNearDuplicate([1, 2, 3], [4, 2, 3])).toBe(true);
    expect(isNearDuplicate([1, 2, 3], [4, 5, 6])).toBe(false);
    // A strict prefix of the previous code is confusable (it repeats verbatim).
    expect(isNearDuplicate([1, 2, 3], [1, 2, 3, 4])).toBe(true);
  });

  it('never flags codes shorter than two colors', () => {
    expect(isNearDuplicate([3], [3])).toBe(false);
  });
});
