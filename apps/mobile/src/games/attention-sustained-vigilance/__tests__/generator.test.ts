// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  VIGILANCE_DIFFICULTY_PARAMS,
  expectedTargetCount,
  targetLayoutFeasible,
} from '../difficulty';
import {
  fallbackTargetIndices,
  gapsRespected,
  generateStream,
  validateStream,
} from '../generator';

const LEVELS = ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const;

describe('generateStream', () => {
  it('is deterministic for a given seed and difficulty', () => {
    for (const level of LEVELS) {
      const params = VIGILANCE_DIFFICULTY_PARAMS[level === 'adaptive' ? 'normal' : level];
      const a = generateStream(createRng('det-seed'), params);
      const b = generateStream(createRng('det-seed'), params);
      expect(a).toEqual(b);
    }
  });

  it('satisfies all stream invariants across seeds and difficulties', () => {
    for (const level of LEVELS) {
      const params = VIGILANCE_DIFFICULTY_PARAMS[level === 'adaptive' ? 'normal' : level];
      expect(targetLayoutFeasible(params)).toBe(true);
      for (let seed = 0; seed < 50; seed += 1) {
        const { trials, stopDigit } = generateStream(createRng(`inv-${level}-${seed}`), params);
        const validation = validateStream(trials, params, stopDigit);
        expect(validation.ok).toBe(true);
        expect(trials).toHaveLength(params.trials);
        // Exactly the expected number of targets exercised the withhold demand.
        expect(trials.filter((t) => t.isTarget)).toHaveLength(expectedTargetCount(params));
      }
    }
  });

  it('never shows the stop digit on a go trial (unambiguous stream)', () => {
    const params = VIGILANCE_DIFFICULTY_PARAMS.expert;
    for (let seed = 0; seed < 100; seed += 1) {
      const { trials, stopDigit } = generateStream(createRng(`stop-${seed}`), params);
      expect(stopDigit).toBeGreaterThanOrEqual(1);
      expect(stopDigit).toBeLessThanOrEqual(9);
      for (const trial of trials) {
        if (!trial.isTarget) {
          expect(trial.digit).not.toBe(stopDigit);
        }
      }
    }
  });
});

describe('fallbackTargetIndices', () => {
  it('produces gap-valid, in-range positions for the shipped params', () => {
    for (const level of LEVELS) {
      const params = VIGILANCE_DIFFICULTY_PARAMS[level === 'adaptive' ? 'normal' : level];
      const count = expectedTargetCount(params);
      const indices = fallbackTargetIndices(params.trials, count);
      expect(indices).toHaveLength(count);
      expect(gapsRespected(indices, params.minTargetGap)).toBe(true);
      for (const index of indices) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(params.trials);
      }
    }
  });
});
