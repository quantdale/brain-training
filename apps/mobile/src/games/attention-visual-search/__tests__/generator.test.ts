// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { gridSizeFor, VISUAL_SEARCH_DIFFICULTY_PARAMS } from '../difficulty';
import {
  MAX_TARGET_ATTEMPTS,
  generateRoundTarget,
  generateSessionTargets,
  isNearDuplicateTarget,
  isValidLayout,
  targetDistance,
} from '../generator';
import type { VisualSearchDifficultyParams } from '../types';

function fullSession(
  seed: string,
  params: VisualSearchDifficultyParams = VISUAL_SEARCH_DIFFICULTY_PARAMS.normal,
): number[] {
  return generateSessionTargets(seed, params);
}

describe('generateSessionTargets / generateRoundTarget', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42')).toEqual(fullSession('seed-42'));
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a');
    const b = fullSession('seed-b');
    expect(a).not.toEqual(b);
  });

  it('yields exactly one valid target per round (in range, on the round grid)', () => {
    const params = VISUAL_SEARCH_DIFFICULTY_PARAMS.normal;
    const targets = fullSession('layout-check', params);
    expect(targets).toHaveLength(params.rounds);
    for (let round = 0; round < targets.length; round += 1) {
      const gridSize = gridSizeFor(params, round);
      // One target, distinct from every distractor: a valid index on the grid.
      expect(isValidLayout(gridSize, targets[round])).toBe(true);
      expect(targets[round]).toBeGreaterThanOrEqual(0);
      expect(targets[round]).toBeLessThan(gridSize);
    }
  });

  it('avoids near-duplicate layouts (same odd-tile index) between consecutive rounds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const targets = fullSession(String(seed));
      for (let round = 1; round < targets.length; round += 1) {
        expect(targetDistance(targets[round], targets[round - 1])).toBe(1);
        expect(isNearDuplicateTarget(targets[round], targets[round - 1])).toBe(false);
      }
    }
  });

  it('works on the 25-tile grid', () => {
    const params = VISUAL_SEARCH_DIFFICULTY_PARAMS.expert;
    const targets = fullSession('grid-25', params);
    for (let round = 0; round < targets.length; round += 1) {
      expect(targets[round]).toBeLessThan(gridSizeFor(params, round));
    }
  });

  it('is bounded: generation always terminates deterministically', () => {
    // Even with an adversarial previous target, generation stays in budget.
    const rng = createRng('budget');
    const target = generateRoundTarget({
      rng,
      roundIndex: 1,
      gridSize: 4,
      prevTargetIndex: 0,
    });
    expect(isValidLayout(4, target)).toBe(true);
    expect(MAX_TARGET_ATTEMPTS).toBeGreaterThan(0);
  });

  it('rejects a non-positive grid size', () => {
    const rng = createRng('bad-grid');
    expect(() =>
      generateRoundTarget({ rng, roundIndex: 0, gridSize: 0, prevTargetIndex: null }),
    ).toThrow(RangeError);
  });
});

describe('targetDistance / isNearDuplicateTarget / isValidLayout', () => {
  it('treats a null previous target as distinct', () => {
    expect(targetDistance(2, null)).toBe(1);
    expect(isNearDuplicateTarget(2, null)).toBe(false);
  });

  it('flags only the identical odd-tile position as a near-duplicate', () => {
    expect(targetDistance(2, 2)).toBe(0);
    expect(targetDistance(2, 3)).toBe(1);
    expect(isNearDuplicateTarget(2, 2)).toBe(true);
    expect(isNearDuplicateTarget(2, 3)).toBe(false);
  });

  it('validates layouts: exactly one target, distinct from distractors', () => {
    expect(isValidLayout(9, 4)).toBe(true);
    expect(isValidLayout(9, 0)).toBe(true);
    expect(isValidLayout(9, 8)).toBe(true);
    expect(isValidLayout(9, 9)).toBe(false);
    expect(isValidLayout(9, -1)).toBe(false);
    expect(isValidLayout(0, 0)).toBe(false);
    expect(isValidLayout(4.5, 1)).toBe(false);
    expect(isValidLayout(4, 1.5)).toBe(false);
  });
});
