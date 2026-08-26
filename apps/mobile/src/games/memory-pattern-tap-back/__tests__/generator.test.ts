// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_SEQUENCE_ATTEMPTS,
  MIN_SEQUENCE_HAMMING_DISTANCE,
  generateRoundSequence,
  isNearDuplicate,
  sequenceDistance,
  tilesAreAdjacent,
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

  it('forms a connected path: every step moves to an adjacent tile', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sequences = fullSession(String(seed));
      for (const seq of sequences) {
        for (let step = 1; step < seq.length; step += 1) {
          expect(tilesAreAdjacent(seq[step - 1], seq[step], 9)).toBe(true);
        }
      }
    }
  });

  it('never revisits any earlier tile, including the start tile', () => {
    // Stronger phrasing of the distinctness invariant: with no repeats, the
    // walk can never step straight back onto its start.
    for (let seed = 100; seed <= 140; seed += 1) {
      const sequences = fullSession(String(seed));
      for (const seq of sequences) {
        for (let step = 1; step < seq.length; step += 1) {
          expect(seq.slice(0, step)).not.toContain(seq[step]);
        }
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

  it('holds adjacency on the 16-tile grid at expert depth too', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const sequence = generateRoundSequence({
        rng: createRng(`grid-16-${seed}`),
        roundIndex: 0,
        // Expert caps at maxSequenceLength 12 — the deepest walk we ship.
        length: 12,
        gridSize: 16,
        prevSequence: null,
      });
      expect(sequence).toHaveLength(12);
      expect(new Set(sequence).size).toBe(12);
      expect(Math.max(...sequence)).toBeLessThan(16);
      for (let step = 1; step < sequence.length; step += 1) {
        expect(tilesAreAdjacent(sequence[step - 1], sequence[step], 16)).toBe(true);
      }
    }
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
