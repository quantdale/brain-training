// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_POSITION_ATTEMPTS,
  MIN_SEPARATION_MULTIPLIER,
  PLACEMENT_EPSILON,
  distanceSq,
  generateRoundTargets,
  isInsideField,
  minSeparation,
  validateTargetPlacement,
} from '../generator';
import type { TargetPosition } from '../types';

/** Full session placement: all rounds for the given tuning. */
function fullSession(seed: string, count = 10, rounds = 4, radius = 0.075): TargetPosition[][] {
  const rng = createRng(seed);
  const roundsOut: TargetPosition[][] = [];
  for (let round = 0; round < rounds; round += 1) {
    roundsOut.push(generateRoundTargets({ rng, roundIndex: round, count, radius }));
  }
  return roundsOut;
}

describe('generateRoundTargets', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42')).toEqual(fullSession('seed-42'));
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a');
    const b = fullSession('seed-b');
    expect(a[0]).not.toEqual(b[0]);
    expect(a).not.toEqual(b);
  });

  it('emits the requested number of targets per round', () => {
    const rng = createRng('count-check');
    expect(generateRoundTargets({ rng, roundIndex: 0, count: 10, radius: 0.075 })).toHaveLength(10);
    expect(generateRoundTargets({ rng, roundIndex: 0, count: 8, radius: 0.09 })).toHaveLength(8);
  });

  it('keeps every target fully inside the field for many seeds and radii', () => {
    for (const radius of [0.05, 0.075, 0.09]) {
      for (let seed = 1; seed <= 40; seed += 1) {
        for (const round of fullSession(String(seed), 10, 4, radius)) {
          for (const target of round) {
            expect(isInsideField(target, radius)).toBe(true);
          }
        }
      }
    }
  });

  it('keeps consecutive targets separated by at least minSeparation for many seeds', () => {
    for (const radius of [0.05, 0.075, 0.09]) {
      const separation = minSeparation(radius);
      for (let seed = 1; seed <= 40; seed += 1) {
        for (const round of fullSession(String(seed), 10, 4, radius)) {
          for (let i = 1; i < round.length; i += 1) {
            expect(Math.sqrt(distanceSq(round[i], round[i - 1]))).toBeGreaterThanOrEqual(
              separation - PLACEMENT_EPSILON,
            );
          }
        }
      }
    }
  });

  it('passes the full placement validation across many seeds', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      for (const round of fullSession(String(seed))) {
        expect(validateTargetPlacement(round, 0.075).ok).toBe(true);
      }
    }
  });

  it('works with a single-target round (no separation constraint to satisfy)', () => {
    const rng = createRng('single');
    const [target] = generateRoundTargets({ rng, roundIndex: 0, count: 1, radius: 0.075 });
    expect(isInsideField(target, 0.075)).toBe(true);
  });

  it('is bounded: generation always terminates deterministically', () => {
    expect(MAX_POSITION_ATTEMPTS).toBeGreaterThan(0);
    const a = generateRoundTargets({ rng: createRng('budget'), roundIndex: 3, count: 14, radius: 0.05 });
    const b = generateRoundTargets({ rng: createRng('budget'), roundIndex: 3, count: 14, radius: 0.05 });
    expect(a).toEqual(b);
    expect(a).toHaveLength(14);
  });

  it('separates rounds via the round-index salt (different round, different placement)', () => {
    const rng = createRng('salts');
    const a = generateRoundTargets({ rng, roundIndex: 0, count: 10, radius: 0.075 });
    const b = generateRoundTargets({ rng, roundIndex: 1, count: 10, radius: 0.075 });
    expect(a).not.toEqual(b);
  });
});

describe('placement helpers', () => {
  it('minSeparation is the radius multiplier constant', () => {
    expect(minSeparation(0.075)).toBeCloseTo(MIN_SEPARATION_MULTIPLIER * 0.075);
  });

  it('isInsideField checks full-circle clearance', () => {
    expect(isInsideField({ x: 0.075, y: 0.075 }, 0.075)).toBe(true);
    expect(isInsideField({ x: 0.925, y: 0.5 }, 0.075)).toBe(true);
    expect(isInsideField({ x: 0.07, y: 0.5 }, 0.075)).toBe(false);
    expect(isInsideField({ x: 0.5, y: 0.93 }, 0.075)).toBe(false);
  });

  it('validateTargetPlacement reports out-of-bounds and over-close placements', () => {
    const bounds: TargetPosition[] = [{ x: 0.5, y: 0.5 }, { x: 0.99, y: 0.5 }];
    expect(validateTargetPlacement(bounds, 0.075).ok).toBe(false);

    const close: TargetPosition[] = [
      { x: 0.5, y: 0.5 },
      { x: 0.5 + minSeparation(0.075) / 2, y: 0.5 },
    ];
    expect(validateTargetPlacement(close, 0.075).ok).toBe(false);

    const fine: TargetPosition[] = [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.8 },
    ];
    expect(validateTargetPlacement(fine, 0.075)).toEqual({ ok: true, reason: null });
  });
});