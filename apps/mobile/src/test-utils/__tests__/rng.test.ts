/** Tests for the seeded sampling helpers in `src/test-utils/rng.ts`. */
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { drawUniqueInts, seededFloats } from '../rng';
import { seededFloats as barrelSeededFloats } from '../index';

describe('drawUniqueInts', () => {
  it('returns exactly `count` distinct integers within bounds', () => {
    const ints = drawUniqueInts(createRng('unique'), 5, 16);
    expect(ints).toHaveLength(5);
    expect(new Set(ints).size).toBe(5);
    for (const value of ints) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(16);
    }
  });

  it('is deterministic for identical rng state', () => {
    const a = drawUniqueInts(createRng('seed-x'), 7, 20);
    const b = drawUniqueInts(createRng('seed-x'), 7, 20);
    expect(a).toEqual(b);
  });

  it('differs across seeds (sanity, not a guarantee)', () => {
    const a = drawUniqueInts(createRng('seed-a'), 7, 20);
    const b = drawUniqueInts(createRng('seed-b'), 7, 20);
    expect(a).not.toEqual(b);
  });

  it('can exhaust the full pool', () => {
    const all = drawUniqueInts(createRng('exhaust'), 6, 6);
    expect([...all].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('rejects impossible or malformed requests', () => {
    const rng = createRng('errors');
    expect(() => drawUniqueInts(rng, 4, 3)).toThrow(RangeError);
    expect(() => drawUniqueInts(rng, -1, 5)).toThrow(RangeError);
    expect(() => drawUniqueInts(rng, 1.5, 5)).toThrow(RangeError);
    expect(() => drawUniqueInts(rng, 1, 0)).toThrow(RangeError);
  });

  it('supports count = 0', () => {
    expect(drawUniqueInts(createRng('zero'), 0, 5)).toEqual([]);
  });
});

describe('seededFloats', () => {
  it('reproduces identical sequences for the same seed', () => {
    const a = seededFloats('float-seed', 32);
    const b = seededFloats('float-seed', 32);
    expect(a).toEqual(b);
  });

  it('produces values in [0, 1) and respects the requested length', () => {
    const floats = seededFloats('bounds', 100);
    expect(floats).toHaveLength(100);
    for (const value of floats) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is re-exported identically through the barrel and matches a fresh SDK stream', () => {
    // The helper is a thin convenience over createRng; pin that relationship
    // so it can never silently drift from the canonical RNG.
    expect(seededFloats(42, 8)).toEqual(barrelSeededFloats(42, 8));
    const rng = createRng(42);
    expect(seededFloats(42, 8)).toEqual([
      rng.next(),
      rng.next(),
      rng.next(),
      rng.next(),
      rng.next(),
      rng.next(),
      rng.next(),
      rng.next(),
    ]);
  });

  it('handles number and string forms of the same seed identically', () => {
    expect(seededFloats(42, 4)).toEqual(seededFloats('42', 4));
  });

  it('returns an empty array for count = 0', () => {
    expect(seededFloats('empty', 0)).toEqual([]);
  });
});
