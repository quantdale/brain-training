// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  MAX_ATTEMPTS,
  SYMBOLS,
  buildCountOptions,
  countTargets,
  generateRound,
  validateGeneratedRound,
} from '../generator';
import type { TargetCountRound } from '../types';
import { TARGET_COUNT_DIFFICULTY_PARAMS } from '../difficulty';

function fullSession(seed: string, level: keyof typeof TARGET_COUNT_DIFFICULTY_PARAMS = 'normal'): TargetCountRound[] {
  const rng = createRng(seed);
  const params = TARGET_COUNT_DIFFICULTY_PARAMS[level];
  const rounds: TargetCountRound[] = [];
  let prev: TargetCountRound | null = null;
  for (let round = 0; round < params.rounds; round += 1) {
    const roundObj = generateRound({ rng, roundIndex: round, params, prevRound: prev });
    rounds.push(roundObj);
    prev = roundObj;
  }
  return rounds;
}

describe('generateRound', () => {
  it('is deterministic: same seed reproduces the same full session', () => {
    expect(fullSession('seed-42')).toEqual(fullSession('seed-42'));
  });

  it('produces different sessions for different seeds', () => {
    const a = fullSession('seed-a');
    const b = fullSession('seed-b');
    expect(a[0].cells).not.toEqual(b[0].cells);
    expect(a).not.toEqual(b);
  });

  it('generates a grid of correct size with valid glyphs', () => {
    const rng = createRng('cell-check');
    const params = TARGET_COUNT_DIFFICULTY_PARAMS.normal;
    const round = generateRound({ rng, roundIndex: 0, params, prevRound: null });
    expect(round.cells).toHaveLength(params.rows * params.cols);
    for (const cell of round.cells) {
      expect(SYMBOLS).toContain(cell);
    }
  });

  it('places exactly targetCount copies of the target glyph', () => {
    const rng = createRng('count-check');
    const params = TARGET_COUNT_DIFFICULTY_PARAMS.normal;
    const round = generateRound({ rng, roundIndex: 0, params, prevRound: null });
    expect(countTargets(round.cells, round.targetGlyph)).toBe(round.targetCount);
    expect(round.targetGlyph).toBe(SYMBOLS[round.targetGlyphIndex]);
  });

  it('avoids near-duplicates between consecutive rounds for many seeds', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const session = fullSession(String(seed));
      for (let round = 1; round < session.length; round += 1) {
        const prev = session[round - 1];
        const current = session[round];
        // Consecutive rounds must not reuse BOTH the same glyph and same count.
        const sameGlyph = prev.targetGlyphIndex === current.targetGlyphIndex;
        const sameCount = prev.targetCount === current.targetCount;
        expect(sameGlyph && sameCount).toBe(false);
      }
    }
  });

  it('is bounded: generation always terminates deterministically', () => {
    const rng = createRng('budget');
    const params = TARGET_COUNT_DIFFICULTY_PARAMS.normal;
    const round = generateRound({ rng, roundIndex: 1, params, prevRound: null });
    expect(round.cells).toHaveLength(params.rows * params.cols);
    expect(MAX_ATTEMPTS).toBeGreaterThan(0);
  });

  it('validateGeneratedRound passes for generated rounds', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      for (const round of fullSession(String(seed))) {
        expect(validateGeneratedRound(round)).toBe(true);
      }
    }
  });
});

describe('buildCountOptions', () => {
  const rng = createRng('options');

  it('always includes the target count and stays in bounds', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const fork = rng.fork(`opts:${seed}`);
      const targetCount = (seed % 12) + 1; // 1..12
      const gridSize = 36;
      const options = buildCountOptions(fork, targetCount, gridSize);
      expect(options).toContain(targetCount);
      for (const option of options) {
        expect(option).toBeGreaterThanOrEqual(0);
        expect(option).toBeLessThanOrEqual(gridSize);
      }
      // Options length is 4 or 5 (clamped by available neighbors).
      expect(options.length).toBeGreaterThanOrEqual(4);
      expect(options.length).toBeLessThanOrEqual(5);
    }
  });

  it('produces distinct options (no duplicates)', () => {
    const options = buildCountOptions(rng.fork('distinct'), 5, 36);
    expect(new Set(options).size).toBe(options.length);
  });
});

describe('countTargets', () => {
  it('counts occurrences of the target glyph', () => {
    expect(countTargets(['★', '●', '★', '★'], '★')).toBe(3);
    expect(countTargets(['●', '▲', '■'], '★')).toBe(0);
  });
});
