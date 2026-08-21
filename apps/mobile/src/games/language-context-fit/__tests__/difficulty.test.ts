import { describe, expect, it } from '@jest/globals';

import {
  CONTEXT_FIT_DIFFICULTY_PARAMS,
  ADAPTIVE_PARAMS,
  contextFitParamsFromProfile,
  contextFitParamsForLevel,
  nextRoundParams,
  resolveContextFitDifficulty,
  tierNumber,
  tierOfNumber,
  tiersFromMask,
} from '../difficulty';
import { createRng } from '@/sdk';

describe('difficulty mapping', () => {
  it('tiersFromMask decodes the bitmask', () => {
    expect(tiersFromMask(1)).toEqual(['t1']);
    expect(tiersFromMask(3)).toEqual(['t1', 't2']);
    expect(tiersFromMask(7)).toEqual(['t1', 't2', 't3']);
    expect(() => tiersFromMask(0)).toThrow();
    expect(() => tiersFromMask(8)).toThrow();
  });

  it('tierNumber/tierOfNumber round-trip', () => {
    expect(tierNumber('t2')).toBe(2);
    expect(tierOfNumber(3)).toBe('t3');
    expect(() => tierOfNumber(0)).toThrow();
  });

  it('fixed levels map to expected tiers/rounds/budgets', () => {
    expect(contextFitParamsForLevel('easy').tierMask).toBe(1);
    expect(contextFitParamsForLevel('expert').tierMask).toBe(4);
    expect(contextFitParamsForLevel('normal').rounds).toBe(CONTEXT_FIT_DIFFICULTY_PARAMS.normal.rounds);
    expect(contextFitParamsForLevel('hard').timePerRoundMs).toBeLessThan(contextFitParamsForLevel('easy').timePerRoundMs);
  });

  it('resolveContextFitDifficulty carries SDK challenge ratings', () => {
    const easy = resolveContextFitDifficulty('easy');
    expect(easy.level).toBe('easy');
    expect(easy.challengeRating).toBeCloseTo(0.2);
    const adaptive = resolveContextFitDifficulty('adaptive');
    expect(adaptive.challengeRating).toBeCloseTo(0.5);
    expect(adaptive.parameters.initialTier).toBe(1);
  });

  it('contextFitParamsFromProfile recovers the same params it wrote', () => {
    for (const level of ['easy', 'normal', 'hard', 'expert'] as const) {
      const params = contextFitParamsForLevel(level);
      const profile = resolveContextFitDifficulty(level);
      const recovered = contextFitParamsFromProfile(profile);
      expect(recovered.tierMask).toBe(params.tierMask);
      expect(recovered.rounds).toBe(params.rounds);
      expect(recovered.timePerRoundMs).toBe(params.timePerRoundMs);
    }
  });

  it('contextFitParamsFromProfile throws on invalid profiles', () => {
    expect(() => contextFitParamsFromProfile({ level: 'normal', challengeRating: 0.5, parameters: {} })).toThrow();
    expect(() =>
      contextFitParamsFromProfile({ level: 'normal', challengeRating: 0.5, parameters: { tierMask: 1, rounds: 0, timePerRoundMs: 1000 } }),
    ).toThrow();
  });

  it('adaptive nextRoundParams steps tier and budget and clamps', () => {
    const lvl = 'adaptive' as const;
    const params = { ...ADAPTIVE_PARAMS };
    const harder = nextRoundParams(lvl, params, 't1', params.timePerRoundMs, true);
    expect(harder.currentTier).toBe('t2');
    expect(harder.timePerRoundMs).toBeLessThan(params.timePerRoundMs);
    const easier = nextRoundParams(lvl, params, 't3', params.timePerRoundMs, false);
    expect(easier.currentTier).toBe('t2');
    expect(easier.timePerRoundMs).toBeGreaterThan(params.timePerRoundMs);
    // clamp at t3 upper bound
    const top = nextRoundParams(lvl, params, 't3', params.timePerRoundMs, true);
    expect(top.currentTier).toBe('t3');
  });

  it('fixed-level nextRoundParams keep their pool and budget', () => {
    const params = contextFitParamsForLevel('normal');
    const tuning = nextRoundParams('normal', params, null, params.timePerRoundMs, true);
    expect(tuning.currentTier).toBeNull();
    expect(tuning.tiers).toEqual(['t1', 't2']);
  });

  it('deterministic across forks: budgets/params are reproducible', () => {
    const a = contextFitParamsForLevel('hard');
    const b = contextFitParamsForLevel('hard');
    expect(createRng('x').next()).toBe(createRng('x').next());
    expect(a).toEqual(b);
  });
});
