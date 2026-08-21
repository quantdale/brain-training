// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  accuracyOf,
  clamp01,
  closenessOf,
  isHit,
  meanClosenessOf,
  normalizeNumberLineResult,
  numberLinePerformanceNormalizer,
  perfectSessionScore,
  roundScore,
  toleranceSpan,
} from '../scoring';
import { NUMBER_LINE_DIFFICULTY_PARAMS } from '../difficulty';
import type { NumberLineRawResult } from '../types';

const NORMAL = NUMBER_LINE_DIFFICULTY_PARAMS.normal;
const NORMAL_SPAN = toleranceSpan(NORMAL); // 6% of 20 = 1.2

describe('toleranceSpan', () => {
  it('converts the percent-of-span tolerance into value units', () => {
    expect(toleranceSpan(NORMAL)).toBeCloseTo(1.2);
    expect(toleranceSpan(NUMBER_LINE_DIFFICULTY_PARAMS.easy)).toBeCloseTo(0.8);
    expect(toleranceSpan(NUMBER_LINE_DIFFICULTY_PARAMS.expert)).toBeCloseTo(25);
  });
});

describe('closenessOf / isHit', () => {
  it('maps exact taps to 1 and band edges to 0', () => {
    expect(closenessOf(0, NORMAL_SPAN)).toBe(1);
    expect(closenessOf(NORMAL_SPAN, NORMAL_SPAN)).toBe(0);
    expect(isHit(0, NORMAL_SPAN)).toBe(true);
    expect(isHit(NORMAL_SPAN, NORMAL_SPAN)).toBe(true); // boundary is a hit
    expect(isHit(NORMAL_SPAN + 0.01, NORMAL_SPAN)).toBe(false);
  });

  it('is symmetric in the error (absolute distance)', () => {
    expect(closenessOf(-0.6, NORMAL_SPAN)).toBe(closenessOf(0.6, NORMAL_SPAN));
    expect(isHit(-NORMAL_SPAN, NORMAL_SPAN)).toBe(true);
  });

  it('rejects non-finite or degenerate spans', () => {
    expect(() => closenessOf(1, 0)).toThrow(RangeError);
    expect(() => closenessOf(1, NaN)).toThrow(RangeError);
    expect(() => clamp01(NaN)).toThrow(RangeError);
    expect(() => clamp01(Infinity)).toThrow(RangeError);
  });
});

describe('roundScore', () => {
  it('rewards exact taps with 150 and decays to 100 at the band edge', () => {
    expect(roundScore(0, NORMAL_SPAN)).toBe(150);
    expect(roundScore(NORMAL_SPAN, NORMAL_SPAN)).toBe(100);
  });

  it('scores misses as zero and never goes negative or above the cap', () => {
    expect(roundScore(NORMAL_SPAN * 2, NORMAL_SPAN)).toBe(0);
    for (let e = 0; e <= 30; e += 1) {
      const score = roundScore(e, NORMAL_SPAN);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(150);
    }
  });
});

describe('accuracyOf / meanClosenessOf / perfectSessionScore', () => {
  it('guards divisions by zero', () => {
    expect(accuracyOf(0, 0)).toBe(0);
    expect(meanClosenessOf(5, 0)).toBe(0);
  });

  it('computes the perfect-session score from the level params', () => {
    expect(perfectSessionScore(NORMAL)).toBe(NORMAL.rounds * 150);
  });
});

describe('normalizeNumberLineResult', () => {
  function raw(overrides: Partial<NumberLineRawResult>): NumberLineRawResult {
    return {
      score: 0,
      roundsTotal: NORMAL.rounds,
      roundsPlayed: NORMAL.rounds,
      roundsHit: NORMAL.rounds,
      meanCloseness: 1,
      avgAbsoluteError: 0,
      finalTolerancePct: NORMAL.tolerancePct,
      challengeRating: 0.5,
      difficulty: 'normal',
      seed: 's',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      forced: false,
      generatorInfo: {} as NumberLineRawResult['generatorInfo'],
      diagnosticMetadata: {} as NumberLineRawResult['diagnosticMetadata'],
      ...overrides,
    };
  }
  const context = { gameId: 'math-number-line-estimation', difficulty: 'normal' as const, durationMs: 1000 };

  it('gives a perfect session 1.0 and an all-miss session 0', () => {
    const perfect = normalizeNumberLineResult(raw({}), context);
    expect(perfect.value).toBe(1);
    expect(perfect.scale).toBe('0..1');

    const allMiss = normalizeNumberLineResult(
      raw({ roundsHit: 0, meanCloseness: 0 }),
      context,
    );
    expect(allMiss.value).toBe(0);
  });

  it('blends accuracy with mean closeness per the documented formula', () => {
    // Half the rounds hit with mean closeness 0.5 overall:
    // value = 0.5 × (0.5 + 0.5 × 0.5) = 0.375.
    const result = normalizeNumberLineResult(
      raw({ roundsHit: Math.ceil(NORMAL.rounds / 2), meanCloseness: 0.5 }),
      context,
    );
    expect(result.value).toBeCloseTo(0.375);
  });

  it('clamps to [0, 1] and carries the raw result through', () => {
    const input = raw({});
    const result = normalizeNumberLineResult(input, context);
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(1);
    expect(result.raw).toEqual(input);
  });

  it('exposes an SDK-conformant normalizer instance', () => {
    expect(numberLinePerformanceNormalizer.gameId).toBe('math-number-line-estimation');
    expect(
      numberLinePerformanceNormalizer.normalize(raw({}), context).value,
    ).toBe(1);
  });
});
