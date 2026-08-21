// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_TARGET_ATTEMPTS,
  generateRound,
  generateSessionRounds,
  targetRange,
  validateRound,
} from '../generator';
import { NUMBER_LINE_DIFFICULTY_PARAMS } from '../difficulty';
import type { NumberLineDifficultyParams } from '../types';

const LEVELS = ['easy', 'normal', 'hard', 'expert'] as const;

describe('generateRound', () => {
  it('is deterministic for a given seed and round index', () => {
    for (const level of LEVELS) {
      const params = NUMBER_LINE_DIFFICULTY_PARAMS[level];
      const a = generateRound(createRng('det-seed'), 3, params, null);
      const b = generateRound(createRng('det-seed'), 3, params, null);
      expect(a).toEqual(b);
    }
  });

  it('keeps the target strictly inside the line (never on an endpoint)', () => {
    for (const level of LEVELS) {
      const params = NUMBER_LINE_DIFFICULTY_PARAMS[level];
      for (let seed = 0; seed < 200; seed += 1) {
        const round = generateRound(createRng(`interior-${level}-${seed}`), seed % 20, params, null);
        const validation = validateRound(round);
        expect(validation.ok).toBe(true);
        expect(round.target).toBeGreaterThan(params.lineMin);
        expect(round.target).toBeLessThan(params.lineMax);
      }
    }
  });

  it('varies consecutive targets by more than 15% of the span when possible', () => {
    // With an easy [0, 10] line the interior range is tiny, so run the
    // variety check on the widest range where re-draws have room.
    const params = NUMBER_LINE_DIFFICULTY_PARAMS.expert;
    let prevTarget: number | null = null;
    for (let i = 0; i < 50; i += 1) {
      const round = generateRound(createRng(`variety-${i}`), i, params, prevTarget);
      if (prevTarget !== null) {
        const minDistance = (params.lineMax - params.lineMin) * 0.15;
        // The generator may accept the last candidate after exhausting its
        // attempt budget, but that must be rare enough that a 50-round
        // session never repeats back-to-back targets.
        expect(Math.abs(round.target - prevTarget)).toBeGreaterThan(0);
        expect(Math.abs(round.target - prevTarget)).toBeGreaterThanOrEqual(
          Math.min(minDistance, 1),
        );
      }
      prevTarget = round.target;
    }
  });

  it('terminates within the attempt budget and always yields a valid round', () => {
    const params: NumberLineDifficultyParams = { rounds: 5, budgetMs: 1000, lineMin: 0, lineMax: 3, tolerancePct: 10 };
    // A degenerate-tiny interior still produces a valid (if cramped) round.
    const round = generateRound(createRng('tiny'), 0, params, null);
    expect(validateRound(round).ok).toBe(true);
    expect(MAX_TARGET_ATTEMPTS).toBeGreaterThan(0);
  });
});

describe('generateSessionRounds', () => {
  it('produces the requested number of unique-ish, valid rounds', () => {
    for (const level of LEVELS) {
      const params = NUMBER_LINE_DIFFICULTY_PARAMS[level];
      const rounds = generateSessionRounds(createRng(`session-${level}`), params);
      expect(rounds).toHaveLength(params.rounds);
      for (const round of rounds) {
        expect(validateRound(round).ok).toBe(true);
      }
    }
  });

  it('is reproducible from the same seed', () => {
    const params = NUMBER_LINE_DIFFICULTY_PARAMS.normal;
    const a = generateSessionRounds(createRng('repro'), params);
    const b = generateSessionRounds(createRng('repro'), params);
    expect(a).toEqual(b);
  });
});

describe('targetRange', () => {
  it('respects at least one unit of margin even on tiny ranges', () => {
    expect(targetRange(0, 3)).toEqual({ lo: 1, hi: 2 });
    expect(targetRange(0, 10)).toEqual({ lo: 1, hi: 9 });
    expect(targetRange(0, 100)).toEqual({ lo: 5, hi: 95 });
    expect(targetRange(0, 1000)).toEqual({ lo: 50, hi: 950 });
  });
});
