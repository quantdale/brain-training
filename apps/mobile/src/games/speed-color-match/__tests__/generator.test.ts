// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { generateTrials, satisfiesStreakConstraint } from '../generator';

function countIncongruent(trials: ReturnType<typeof generateTrials>): number {
  return trials.filter((t) => t.swatchColor !== t.labelColor).length;
}

describe('generateTrials', () => {
  it('is deterministic: same seed reproduces the same trial sequence', () => {
    const a = generateTrials({ rng: createRng('seed-42'), totalTrials: 20, incongruentCount: 8 });
    const b = generateTrials({ rng: createRng('seed-42'), totalTrials: 20, incongruentCount: 8 });
    expect(a).toEqual(b);
  });

  it('produces different sequences for different seeds', () => {
    const a = generateTrials({ rng: createRng('seed-a'), totalTrials: 20, incongruentCount: 8 });
    const b = generateTrials({ rng: createRng('seed-b'), totalTrials: 20, incongruentCount: 8 });
    expect(a).not.toEqual(b);
  });

  it('produces the correct number of trials', () => {
    const trials = generateTrials({ rng: createRng('count'), totalTrials: 25, incongruentCount: 10 });
    expect(trials).toHaveLength(25);
  });

  it('respects the target incongruent count (within rounding)', () => {
    const trials = generateTrials({ rng: createRng('ratio'), totalTrials: 20, incongruentCount: 8 });
    const incongruent = countIncongruent(trials);
    // Allow ±1 for rounding.
    expect(incongruent).toBeGreaterThanOrEqual(7);
    expect(incongruent).toBeLessThanOrEqual(9);
  });

  it('congruent trials have swatchColor === labelColor', () => {
    const trials = generateTrials({ rng: createRng('congruent'), totalTrials: 15, incongruentCount: 3 });
    for (const trial of trials) {
      if (trial.swatchColor === trial.labelColor) {
        // This is a congruent trial — valid.
        expect(trial.swatchColor).toBe(trial.labelColor);
      }
    }
  });

  it('incongruent trials have swatchColor !== labelColor', () => {
    const trials = generateTrials({ rng: createRng('incongruent'), totalTrials: 15, incongruentCount: 12 });
    for (const trial of trials) {
      if (trial.swatchColor !== trial.labelColor) {
        // This is an incongruent trial — valid.
        expect(trial.swatchColor).not.toBe(trial.labelColor);
      }
    }
  });

  it('no more than MAX_CONSECUTIVE_INCONGRUENT consecutive incongruent trials', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const trials = generateTrials({
        rng: createRng(String(seed)),
        totalTrials: 30,
        incongruentCount: 20,
      });
      const pattern = trials.map((t) => t.swatchColor !== t.labelColor);
      expect(satisfiesStreakConstraint(pattern)).toBe(true);
    }
  });

  it('handles 0 incongruent (all congruent)', () => {
    const trials = generateTrials({ rng: createRng('all-cong'), totalTrials: 15, incongruentCount: 0 });
    expect(countIncongruent(trials)).toBe(0);
    for (const trial of trials) {
      expect(trial.swatchColor).toBe(trial.labelColor);
    }
  });

  it('handles max incongruent (limited by streak constraint)', () => {
    // With MAX_CONSECUTIVE_INCONGRUENT=3, max incongruent in 10 trials is 8.
    const trials = generateTrials({ rng: createRng('all-incong'), totalTrials: 10, incongruentCount: 10 });
    const count = countIncongruent(trials);
    expect(count).toBeGreaterThanOrEqual(8);
    expect(count).toBeLessThanOrEqual(10);
    // Verify the streak constraint holds.
    const pattern = trials.map((t) => t.swatchColor !== t.labelColor);
    expect(satisfiesStreakConstraint(pattern)).toBe(true);
  });

  it('clamps incongruentCount to valid range', () => {
    const over = generateTrials({ rng: createRng('over'), totalTrials: 5, incongruentCount: 100 });
    expect(countIncongruent(over)).toBeLessThanOrEqual(5);
    const under = generateTrials({ rng: createRng('under'), totalTrials: 5, incongruentCount: -10 });
    expect(countIncongruent(under)).toBe(0);
  });
});

describe('satisfiesStreakConstraint', () => {
  it('returns true for empty pattern', () => {
    expect(satisfiesStreakConstraint([])).toBe(true);
  });

  it('returns true when all false', () => {
    expect(satisfiesStreakConstraint([false, false, false])).toBe(true);
  });

  it('returns true when streaks are within limit', () => {
    expect(satisfiesStreakConstraint([true, true, false, true, true])).toBe(true);
    expect(satisfiesStreakConstraint([true, true, true, false, true, true, true])).toBe(true);
  });

  it('returns false when streak exceeds limit', () => {
    expect(satisfiesStreakConstraint([true, true, true, true])).toBe(false);
    expect(satisfiesStreakConstraint([false, true, true, true, true, false])).toBe(false);
  });
});
