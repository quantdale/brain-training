// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '../rng';

const SAMPLE_COUNT = 10_000;

describe('createRng determinism', () => {
  it('produces identical sequences for the same seed', () => {
    const a = createRng('demo-seed');
    const b = createRng('demo-seed');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng('seed-a');
    const b = createRng('seed-b');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('treats a number seed and its string form as identical (canonical seeds)', () => {
    const a = createRng(42);
    const b = createRng('42');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(a.seed).toBe('42');
    expect(b.seed).toBe('42');
  });

  it('reports the algorithm version for reproducibility bookkeeping', () => {
    const rng = createRng('x');
    expect(rng.algorithmVersion).toBe('mulberry32-v1');
  });
});

describe('createRng distribution sanity', () => {
  it('has a mean near 0.5 over 10k samples', () => {
    const rng = createRng('distribution');
    let sum = 0;
    for (let i = 0; i < SAMPLE_COUNT; i += 1) sum += rng.next();
    const mean = sum / SAMPLE_COUNT;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.02);
  });

  it('spreads samples roughly evenly across deciles', () => {
    const rng = createRng('distribution');
    const deciles = new Array(10).fill(0) as number[];
    for (let i = 0; i < SAMPLE_COUNT; i += 1) {
      deciles[Math.min(9, Math.floor(rng.next() * 10))] += 1;
    }
    // 10k / 10 = 1000 expected; ±5σ ≈ ±150. Allow 850..1150 (loose, deterministic).
    for (const count of deciles) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it('keeps next() in [0, 1)', () => {
    const rng = createRng('bounds');
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('createRng helpers', () => {
  it('nextInt stays within [0, maxExclusive) and hits both extremes', () => {
    const rng = createRng('ints');
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 2000; i += 1) {
      const v = rng.nextInt(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBe(0);
    expect(max).toBe(5);
  });

  it('nextIntRange honors min/max, including negative ranges', () => {
    const rng = createRng('ranges');
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 2000; i += 1) {
      const v = rng.nextIntRange(-3, 4);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(4);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBe(-3);
    expect(max).toBe(3);
  });

  it('nextIntRange rejects fractional or unsafe bounds', () => {
    const rng = createRng('fractional-range');
    expect(() => rng.nextIntRange(0.5, 3)).toThrow(RangeError);
    expect(() => rng.nextIntRange(0, 3.5)).toThrow(RangeError);
    expect(() => rng.nextIntRange(0, Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it('nextInt rejects non-positive maxExclusive', () => {
    expect(() => createRng('x').nextInt(0)).toThrow(RangeError);
    expect(() => createRng('x').nextInt(-1)).toThrow(RangeError);
    expect(() => createRng('x').nextInt(1.5)).toThrow(RangeError);
  });

  it('pick returns members of the input', () => {
    const rng = createRng('pick');
    const items = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 200; i += 1) {
      expect(items).toContain(rng.pick(items));
    }
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('shuffle is a deterministic permutation and does not mutate input', () => {
    const rng = createRng('shuffle');
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const first = rng.shuffle(input);
    const second = createRng('shuffle').shuffle(input);
    expect(first).toEqual(second); // deterministic
    expect([...first].sort((a, b) => a - b)).toEqual(input); // permutation
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // input untouched
  });

  it('fork derives deterministic, salt-distinct child streams', () => {
    const a1 = createRng('parent').fork('layout');
    const a2 = createRng('parent').fork('layout');
    const b = createRng('parent').fork('distractors');
    const seqA1 = Array.from({ length: 10 }, () => a1.next());
    const seqA2 = Array.from({ length: 10 }, () => a2.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA1).toEqual(seqA2);
    expect(seqA1).not.toEqual(seqB);
    // Forked stream differs from the parent's own stream.
    const parent = createRng('parent');
    expect(seqA1).not.toEqual(Array.from({ length: 10 }, () => parent.next()));
  });
});
