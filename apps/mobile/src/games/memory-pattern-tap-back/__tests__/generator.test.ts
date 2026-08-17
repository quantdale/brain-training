// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_SEQUENCE_ATTEMPTS,
  MIN_SEQUENCE_HAMMING_DISTANCE,
  generateRoundSequence,
  isNearDuplicate,
  sequenceDistance,
} from '../generator';

function fullSession(seed: string, gridSize = 9, startLength = 4, rounds = 5): number[][] {
  const rng = createRng(seed);
  const sequences: number[][] = [];
  let prev: number[] | null = null;
  let length = startLength;
  for (let round = 0; round < rounds; round += 1) {
    const sequence = generateRoundSequence({
      rng,
      roundIndex: round,
      length,
      gridSize,
      prevSequence: prev,
    });
    sequences.push(sequence);
    prev = sequence;
    length = Math.min(gridSize, length + 1);
  }
  return sequences;
}

describe('generateRoundSequence', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42')).toEqual(fullSession('seed-42'));
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a');
    const b = fullSession('seed-b');
    expect(a[0]).not.toEqual(b[0]);
    expect(a).not.toEqual(b);
  });

  it('draws a sequence: correct length, distinct tiles, in range', () => {
    const rng = createRng('perm-check');
    const sequence = generateRoundSequence({
      rng,
      roundIndex: 0,
      length: 5,
      gridSize: 9,
      prevSequence: null,
    });
    expect(sequence).toHaveLength(5);
    expect(new Set(sequence).size).toBe(5);
    for (const tile of sequence) {
      expect(tile).toBeGreaterThanOrEqual(0);
      expect(tile).toBeLessThan(9);
    }
  });

  it('no tile appears twice in the same sequence', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sequences = fullSession(String(seed));
      for (const seq of sequences) {
        expect(new Set(seq).size).toBe(seq.length);
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

  it('works on the 16-tile grid too', () => {
    const rng = createRng('grid-16');
    const sequence = generateRoundSequence({
      rng,
      roundIndex: 0,
      length: 6,
      gridSize: 16,
      prevSequence: null,
    });
    expect(sequence).toHaveLength(6);
    expect(Math.max(...sequence)).toBeLessThan(16);
  });

  it('is bounded: generation always terminates deterministically', () => {
    const rng = createRng('budget');
    const previous = [0, 1, 2, 3];
    const sequence = generateRoundSequence({
      rng,
      roundIndex: 1,
      length: 4,
      gridSize: 9,
      prevSequence: previous,
    });
    expect(sequence).toHaveLength(4);
    expect(MAX_SEQUENCE_ATTEMPTS).toBeGreaterThan(0);
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
    expect(isNearDuplicate([1, 2, 3], [1, 2, 3, 4])).toBe(true);
  });

  it('never flags sequences shorter than two tiles', () => {
    expect(isNearDuplicate([3], [3])).toBe(false);
  });
});
