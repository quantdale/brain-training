// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { resolveDifficulty } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  NUMBER_LINE_DIFFICULTY_PARAMS,
  nextTolerancePct,
  numberLineParamsForLevel,
  numberLineParamsFromProfile,
  numberLineParamsToRecord,
  resolveNumberLineDifficulty,
  sessionChallengeRating,
} from '../difficulty';

const LEVELS = ['easy', 'normal', 'hard', 'expert'] as const;

describe('NUMBER_LINE_DIFFICULTY_PARAMS', () => {
  it('calibrates monotonically: range grows and tolerance tightens with level', () => {
    expect(NUMBER_LINE_DIFFICULTY_PARAMS.easy.lineMax).toBeLessThan(
      NUMBER_LINE_DIFFICULTY_PARAMS.normal.lineMax,
    );
    expect(NUMBER_LINE_DIFFICULTY_PARAMS.normal.lineMax).toBeLessThan(
      NUMBER_LINE_DIFFICULTY_PARAMS.hard.lineMax,
    );
    expect(NUMBER_LINE_DIFFICULTY_PARAMS.hard.lineMax).toBeLessThan(
      NUMBER_LINE_DIFFICULTY_PARAMS.expert.lineMax,
    );
    expect(NUMBER_LINE_DIFFICULTY_PARAMS.easy.tolerancePct).toBeGreaterThan(
      NUMBER_LINE_DIFFICULTY_PARAMS.normal.tolerancePct,
    );
    expect(NUMBER_LINE_DIFFICULTY_PARAMS.normal.tolerancePct).toBeGreaterThan(
      NUMBER_LINE_DIFFICULTY_PARAMS.hard.tolerancePct,
    );
    expect(NUMBER_LINE_DIFFICULTY_PARAMS.hard.tolerancePct).toBeGreaterThan(
      NUMBER_LINE_DIFFICULTY_PARAMS.expert.tolerancePct,
    );
  });

  it('gives every level a positive budget and sane round count', () => {
    for (const level of LEVELS) {
      const params = NUMBER_LINE_DIFFICULTY_PARAMS[level];
      expect(params.rounds).toBeGreaterThan(0);
      expect(params.budgetMs).toBeGreaterThan(0);
      expect(params.lineMax).toBeGreaterThan(params.lineMin);
      expect(params.tolerancePct).toBeGreaterThan(0);
      expect(params.tolerancePct).toBeLessThanOrEqual(100);
    }
  });
});

describe('resolveNumberLineDifficulty / params round-trip', () => {
  it('resolves every level and survives the record → profile → params round-trip', () => {
    for (const level of [...LEVELS, 'adaptive' as DifficultyLevel]) {
      const profile = resolveNumberLineDifficulty(level);
      expect(profile.level).toBe(level);
      const params = numberLineParamsFromProfile(profile);
      expect(params).toEqual(numberLineParamsForLevel(level));
    }
  });

  it('carries the SDK default challenge ratings for fixed levels', () => {
    for (const level of LEVELS) {
      const direct = resolveDifficulty(level, {});
      const resolved = resolveNumberLineDifficulty(level);
      expect(resolved.challengeRating).toBe(direct.challengeRating);
    }
  });

  it('throws on missing or degenerate parameters instead of guessing', () => {
    const base = numberLineParamsToRecord(NUMBER_LINE_DIFFICULTY_PARAMS.normal);
    expect(() =>
      numberLineParamsFromProfile(resolveDifficulty('normal', {})),
    ).toThrow(/missing numeric parameter/);
    expect(() =>
      numberLineParamsFromProfile(resolveDifficulty('normal', { ...base, lineMin: 10, lineMax: 10 })),
    ).toThrow(/degenerate line range/);
    expect(() =>
      numberLineParamsFromProfile(resolveDifficulty('normal', { ...base, tolerancePct: 0 })),
    ).toThrow(/tolerancePct/);
  });
});

describe('nextTolerancePct (adaptive)', () => {
  it('tightens after a hit and relaxes after a miss within bounds', () => {
    const start = ADAPTIVE_PARAMS.tolerancePct;
    const afterHit = nextTolerancePct(start, true, 'adaptive', ADAPTIVE_PARAMS);
    const afterMiss = nextTolerancePct(start, false, 'adaptive', ADAPTIVE_PARAMS);
    expect(afterHit).toBeCloseTo(start - (ADAPTIVE_PARAMS.stepTolerancePct ?? 0));
    expect(afterMiss).toBeCloseTo(start + (ADAPTIVE_PARAMS.stepTolerancePct ?? 0));

    // Bounds hold under extreme runs.
    let pct = start;
    for (let i = 0; i < 50; i += 1) {
      pct = nextTolerancePct(pct, true, 'adaptive', ADAPTIVE_PARAMS);
    }
    expect(pct).toBe(ADAPTIVE_PARAMS.minTolerancePct);
    for (let i = 0; i < 50; i += 1) {
      pct = nextTolerancePct(pct, false, 'adaptive', ADAPTIVE_PARAMS);
    }
    expect(pct).toBe(ADAPTIVE_PARAMS.maxTolerancePct);
  });

  it('keeps fixed levels constant', () => {
    for (const level of LEVELS) {
      const params = NUMBER_LINE_DIFFICULTY_PARAMS[level];
      expect(nextTolerancePct(params.tolerancePct, true, level, params)).toBe(params.tolerancePct);
      expect(nextTolerancePct(params.tolerancePct, false, level, params)).toBe(params.tolerancePct);
    }
  });
});

describe('sessionChallengeRating (adaptive)', () => {
  it('maps the neutral start to the adaptive baseline and inverts direction', () => {
    const profile = resolveNumberLineDifficulty('adaptive');
    const neutral = sessionChallengeRating('adaptive', profile, ADAPTIVE_PARAMS.tolerancePct);
    expect(neutral).toBeCloseTo(profile.challengeRating);

    // A tighter tolerance is a higher challenge.
    const tight = sessionChallengeRating('adaptive', profile, ADAPTIVE_PARAMS.minTolerancePct ?? 2);
    const loose = sessionChallengeRating('adaptive', profile, ADAPTIVE_PARAMS.maxTolerancePct ?? 8);
    expect(tight).toBeGreaterThan(loose);
    expect(tight).toBeCloseTo(1);
    expect(loose).toBeCloseTo(0);
  });

  it('reports the SDK default rating for fixed levels', () => {
    for (const level of LEVELS) {
      const profile = resolveNumberLineDifficulty(level);
      expect(sessionChallengeRating(level, profile, 999)).toBe(profile.challengeRating);
    }
  });
});
