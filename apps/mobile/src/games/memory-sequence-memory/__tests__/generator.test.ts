// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_ADJACENT_ATTEMPTS,
  MAX_SEQUENCE_ATTEMPTS,
  MIN_SEQUENCE_HAMMING_DISTANCE,
  generateSequence,
  isNearDuplicate,
  isValidSequence,
  sequenceDistance,
} from '../generator';

/**
 * Simulate a full pass-everything session: each round escalates the length
 * (capped at maxLength) and the next sequence must avoid a near-duplicate of
 * the previous one — the same bookkeeping the reducer performs.
 */
function fullSession(
  seed: string,
  tileCount = 4,
  startLength = 3,
  maxLength = 8,
  rounds = 8,
): number[][] {
  const rng = createRng(seed);
  const sequences: number[][] = [];
  let prev: number[] | null = null;
  let length = startLength;
  for (let round = 0; round < rounds; round += 1) {
    const sequence = generateSequence({ rng, sequenceIndex: round, length, tileCount, prevSequence: prev });
    sequences.push(sequence);
    prev = sequence;
    length = Math.min(maxLength, length + 1);
  }
  return sequences;
}

describe('generateSequence', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42')).toEqual(fullSession('seed-42'));
    expect(fullSession('seed-42', 9, 4, 12)).toEqual(fullSession('seed-42', 9, 4, 12));
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a');
    const b = fullSession('seed-b');
    expect(a[0]).not.toEqual(b[0]);
    expect(a).not.toEqual(b);
  });

  it('emits valid sequences for many seeds and both pad sizes', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const fourTile = fullSession(String(seed), 4, 3, 8);
      for (let round = 0; round < fourTile.length; round += 1) {
        expect(isValidSequence(fourTile[round], 4, fourTile[round].length)).toBe(true);
      }
      const nineTile = fullSession(String(seed), 9, 4, 12);
      for (let round = 0; round < nineTile.length; round += 1) {
        expect(isValidSequence(nineTile[round], 9, nineTile[round].length)).toBe(true);
      }
    }
  });

  it('suppresses adjacent duplicates but allows intentional repeats', () => {
    // 8 taps over 4 tiles must repeat a tile somewhere (pigeonhole) — the
    // generator must allow those repeats while never flashing the same tile
    // twice in a row.
    for (let seed = 1; seed <= 40; seed += 1) {
      const sequence = fullSession(String(seed), 4, 3, 8, 6)[5]; // length 8
      expect(new Set(sequence).size).toBeLessThan(sequence.length);
      for (let i = 1; i < sequence.length; i += 1) {
        expect(sequence[i]).not.toBe(sequence[i - 1]);
      }
    }
  });

  it('avoids near-duplicates between consecutive rounds for many seeds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sessions = fullSession(String(seed));
      for (let round = 1; round < sessions.length; round += 1) {
        const prev = sessions[round - 1];
        const current = sessions[round];
        if (prev.length >= 2) {
          expect(sequenceDistance(current, prev)).toBeGreaterThanOrEqual(
            MIN_SEQUENCE_HAMMING_DISTANCE,
          );
        }
      }
    }
  });

  it('is bounded: generation always terminates deterministically', () => {
    // Even with an adversarial previous sequence, generation stays in budget.
    const rng = createRng('budget');
    const previous = [0, 1];
    const sequence = generateSequence({ rng, sequenceIndex: 1, length: 2, tileCount: 4, prevSequence: previous });
    expect(sequence).toHaveLength(2);
    expect(isValidSequence(sequence, 4, 2)).toBe(true);
    expect(MAX_SEQUENCE_ATTEMPTS).toBeGreaterThan(0);
    expect(MAX_ADJACENT_ATTEMPTS).toBeGreaterThan(0);
  });

  it('does not depend on how earlier forks were consumed', () => {
    // The sequence for an ordinal is a function of (seed, ordinal, length,
    // prevSequence) only: consuming the rng in between must not change it.
    const direct = generateSequence({
      rng: createRng('independence'),
      sequenceIndex: 2,
      length: 4,
      tileCount: 4,
      prevSequence: [1, 2, 3],
    });
    const rng = createRng('independence');
    rng.next();
    rng.nextInt(4);
    const afterConsumption = generateSequence({
      rng,
      sequenceIndex: 2,
      length: 4,
      tileCount: 4,
      prevSequence: [1, 2, 3],
    });
    expect(afterConsumption).toEqual(direct);
  });
});

describe('sequenceDistance / isNearDuplicate', () => {
  it('treats a null previous sequence as infinitely far', () => {
    expect(sequenceDistance([1, 2], null)).toBe(Number.POSITIVE_INFINITY);
    expect(isNearDuplicate([1, 2], null)).toBe(false);
  });

  it('measures length difference plus positional differences', () => {
    expect(sequenceDistance([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(sequenceDistance([1, 2, 3], [1, 2, 4])).toBe(1);
    expect(sequenceDistance([1, 2, 3], [1, 2])).toBe(1);
    expect(sequenceDistance([1, 2, 3], [4, 5, 6])).toBe(3);
    expect(sequenceDistance([1, 2, 3, 4], [1, 2])).toBe(2);
  });

  it('flags near-duplicates below the threshold', () => {
    expect(isNearDuplicate([1, 2, 3], [1, 2, 4])).toBe(true);
    expect(isNearDuplicate([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isNearDuplicate([1, 2], [1, 3])).toBe(true);
    expect(isNearDuplicate([1, 2, 3], [4, 2, 3])).toBe(true);
    expect(isNearDuplicate([1, 2, 3], [4, 5, 6])).toBe(false);
    // A strict prefix of the previous round is confusable (it repeats verbatim).
    expect(isNearDuplicate([1, 2, 3], [1, 2, 3, 4])).toBe(true);
  });

  it('never flags sequences shorter than two tiles', () => {
    expect(isNearDuplicate([3], [3])).toBe(false);
  });
});

describe('isValidSequence', () => {
  it('accepts well-formed sequences', () => {
    expect(isValidSequence([1, 2, 1, 3], 4, 4)).toBe(true);
    expect(isValidSequence([0], 4, 1)).toBe(true);
  });

  it('rejects wrong lengths, out-of-range tiles, and adjacent duplicates', () => {
    expect(isValidSequence([1, 2], 4, 3)).toBe(false); // wrong length
    expect(isValidSequence([], 4, 0)).toBe(false); // empty
    expect(isValidSequence([4, 0], 4, 2)).toBe(false); // tile out of range
    expect(isValidSequence([-1, 0], 4, 2)).toBe(false); // negative tile
    expect(isValidSequence([1.5, 0], 4, 2)).toBe(false); // non-integer tile
    expect(isValidSequence([1, 1, 2], 4, 3)).toBe(false); // adjacent duplicate
    expect(isValidSequence([1, 2, 2], 4, 3)).toBe(false); // adjacent duplicate
  });
});
