// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { generateRoundDelay } from '../generator';

describe('generateRoundDelay', () => {
  it('is deterministic: same inputs produce the same delay', () => {
    const a = generateRoundDelay({ rng: createRng('seed-42'), roundIndex: 0, minDelayMs: 1000, maxDelayMs: 3000 });
    const b = generateRoundDelay({ rng: createRng('seed-42'), roundIndex: 0, minDelayMs: 1000, maxDelayMs: 3000 });
    expect(a).toBe(b);
  });

  it('draws integer milliseconds inside the inclusive range for many seeds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (let round = 0; round < 10; round += 1) {
        const delay = generateRoundDelay({
          rng: createRng(String(seed)),
          roundIndex: round,
          minDelayMs: 800,
          maxDelayMs: 2500,
        });
        expect(Number.isInteger(delay)).toBe(true);
        expect(delay).toBeGreaterThanOrEqual(800);
        expect(delay).toBeLessThanOrEqual(2500);
      }
    }
  });

  it('covers the boundaries for an exact range', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const delay = generateRoundDelay({
        rng: createRng(String(seed)),
        roundIndex: 0,
        minDelayMs: 500,
        maxDelayMs: 500,
      });
      expect(delay).toBe(500);
    }
  });

  it('varies across rounds within one session stream (forked salts)', () => {
    const rng = createRng('session-a');
    const delays = new Set<number>();
    for (let round = 0; round < 10; round += 1) {
      delays.add(
        generateRoundDelay({ rng, roundIndex: round, minDelayMs: 1000, maxDelayMs: 3000 }),
      );
    }
    // The range is 2001 values; drawing 10 values all identical would be a
    // broken stream — require at least two distinct waits per session.
    expect(delays.size).toBeGreaterThan(1);
  });

  it('rejects invalid bounds loudly', () => {
    const rng = createRng('bad');
    expect(() =>
      generateRoundDelay({ rng, roundIndex: 0, minDelayMs: -1, maxDelayMs: 100 }),
    ).toThrow(RangeError);
    expect(() =>
      generateRoundDelay({ rng, roundIndex: 0, minDelayMs: 1000, maxDelayMs: 100 }),
    ).toThrow(RangeError);
    expect(() =>
      generateRoundDelay({ rng, roundIndex: 0, minDelayMs: Number.NaN, maxDelayMs: 100 }),
    ).toThrow(RangeError);
  });
});
