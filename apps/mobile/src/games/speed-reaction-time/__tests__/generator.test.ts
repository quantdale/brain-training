// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { generateRoundDelay, isNoGoRound } from '../generator';
import { SPEED_DIFFICULTY_PARAMS } from '../difficulty';

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

describe('isNoGoRound', () => {
  it('is deterministic: same inputs produce the same decision', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const a = isNoGoRound({ rng: createRng(String(seed)), roundIndex: 3, noGoProbability: 0.25 });
      const b = isNoGoRound({ rng: createRng(String(seed)), roundIndex: 3, noGoProbability: 0.25 });
      expect(a).toBe(b);
    }
  });

  it('never marks a no-go at probability 0 (easy stays pure simple-RT)', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      for (let round = 0; round < 10; round += 1) {
        const noGo = isNoGoRound({
          rng: createRng(String(seed)),
          roundIndex: round,
          noGoProbability: SPEED_DIFFICULTY_PARAMS.easy.noGoProbability,
        });
        expect(noGo).toBe(false);
      }
    }
  });

  it('produces both outcomes across many seeds at a mid probability', () => {
    let hits = 0;
    const trials = 400;
    for (let seed = 1; seed <= trials; seed += 1) {
      if (isNoGoRound({ rng: createRng(String(seed)), roundIndex: 0, noGoProbability: 0.3 })) {
        hits += 1;
      }
    }
    // Deterministic but seeded broadly: neither outcome may be unreachable.
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(trials);
  });

  it('yields roughly the configured rate (within ±10pp over a wide sweep)', () => {
    const probability = SPEED_DIFFICULTY_PARAMS.expert.noGoProbability; // 0.35
    let hits = 0;
    const trials = 1000;
    for (let seed = 1; seed <= trials; seed += 1) {
      if (isNoGoRound({ rng: createRng(`rate-${seed}`), roundIndex: 7, noGoProbability: probability })) {
        hits += 1;
      }
    }
    const rate = hits / trials;
    expect(rate).toBeGreaterThan(probability - 0.1);
    expect(rate).toBeLessThan(probability + 0.1);
  });

  it('rejects probabilities outside [0, 1] loudly', () => {
    const rng = createRng('bad');
    expect(() => isNoGoRound({ rng, roundIndex: 0, noGoProbability: -0.1 })).toThrow(RangeError);
    expect(() => isNoGoRound({ rng, roundIndex: 0, noGoProbability: 1.1 })).toThrow(RangeError);
    expect(() => isNoGoRound({ rng, roundIndex: 0, noGoProbability: Number.NaN })).toThrow(
      RangeError,
    );
  });

  it('uses an independent fork so delays are unchanged by the no-go draw', () => {
    // The delay fork salt is untouched by the no-go classification: the delay
    // for a round must equal the pure-delay draw for the same inputs.
    for (const round of [0, 5, 9]) {
      const delay = generateRoundDelay({
        rng: createRng('fork-stability'),
        roundIndex: round,
        minDelayMs: 800,
        maxDelayMs: 2500,
      });
      const expected = createRng('fork-stability').fork(`round:${round}:delay`).nextIntRange(800, 2501);
      expect(delay).toBe(expected);
    }
  });
});
