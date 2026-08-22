// Difficulty-layer adversarial suite for math-value-ordering (campaign 011
// W03): corrupt-profile rejection matrix, encode/decode round-trips, adaptive
// tile-count dynamics driven through the real reducer, and challenge-rating
// mapping. Regressions for the campaign's decode-validation hardening live
// here (rounds ≥ 1, budgetMs > 0, operand-range sanity).
import { describe, expect, it } from '@jest/globals';

import { ADAPTIVE_PARAMS, VALUE_ORDERING_DIFFICULTY_PARAMS } from '../difficulty';
import type { DifficultyProfile } from '@/sdk';

import {
  nextTileCount,
  resolveValueOrderingDifficulty,
  sessionChallengeRating,
  valueOrderingParamsForLevel,
  valueOrderingParamsFromProfile,
  valueOrderingParamsToRecord,
} from '../difficulty';
import { valueOrderingGameReducer } from '../reducer';
import { createInitialValueOrderingState } from '../types';
import type { ValueOrderingGameState } from '../types';

const LEVELS = ['easy', 'normal', 'hard', 'expert'] as const;

/** Wrap raw parameters into a profile the way a persisted record would. */
function makeProfile(parameters: Record<string, number>): DifficultyProfile {
  return { level: 'normal', challengeRating: 0.5, parameters };
}

/** A fully valid parameter set (normal-level values) to mutate per case. */
function validParams(): Record<string, number> {
  return { ...VALUE_ORDERING_DIFFICULTY_PARAMS.normal };
}

describe('corrupt-profile rejection (valueOrderingParamsFromProfile)', () => {
  const REQUIRED_KEYS = [
    'rounds',
    'budgetMs',
    'tiles',
    'minValue',
    'maxValue',
    'expressionTiles',
    'exprOperandMin',
    'exprOperandMax',
  ] as const;

  it.each([...REQUIRED_KEYS])('rejects a profile missing "%s"', (key) => {
    const params = validParams();
    delete params[key];
    expect(() => valueOrderingParamsFromProfile(makeProfile(params))).toThrow(
      `missing numeric parameter "${key}"`,
    );
  });

  it.each([...REQUIRED_KEYS])('rejects non-finite "%s"', (key) => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const params = validParams();
      params[key] = bad;
      expect(() => valueOrderingParamsFromProfile(makeProfile(params))).toThrow(
        `missing numeric parameter "${key}"`,
      );
    }
  });

  it('rejects degenerate tile counts', () => {
    for (const tiles of [1, 0, -3, 2.5]) {
      const params = validParams();
      params.tiles = tiles;
      expect(() => valueOrderingParamsFromProfile(makeProfile(params))).toThrow(
        /tiles must be an integer ≥ 2/,
      );
    }
  });

  it('rejects empty or inverted value ranges and ranges too small for the tiles', () => {
    const inverted = validParams();
    inverted.maxValue = inverted.minValue;
    expect(() => valueOrderingParamsFromProfile(makeProfile(inverted))).toThrow(
      /degenerate value range/,
    );

    const tiny = validParams();
    tiny.minValue = 0;
    tiny.maxValue = 2; // hosts 3 integers < tiles(4)
    expect(() => valueOrderingParamsFromProfile(makeProfile(tiny))).toThrow(/cannot host 4/);
  });

  it('rejects expressionTiles outside [0, tiles]', () => {
    for (const expressionTiles of [-1, 5, 2.5]) {
      const params = validParams(); // tiles: 4
      params.expressionTiles = expressionTiles;
      expect(() => valueOrderingParamsFromProfile(makeProfile(params))).toThrow(
        /expressionTiles must be an integer in \[0, tiles\]/,
      );
    }
  });

  // --- Campaign-011 hardening regressions (previously accepted silently). ---

  it('rejects rounds < 1 or fractional rounds (session would silently shrink)', () => {
    for (const rounds of [0, -3, 2.5]) {
      const params = validParams();
      params.rounds = rounds;
      expect(() => valueOrderingParamsFromProfile(makeProfile(params))).toThrow(
        /rounds must be an integer ≥ 1/,
      );
    }
  });

  it('rejects non-positive budgets (they silently disable timeouts)', () => {
    for (const budgetMs of [0, -1000]) {
      const params = validParams();
      params.budgetMs = budgetMs;
      expect(() => valueOrderingParamsFromProfile(makeProfile(params))).toThrow(
        /budgetMs must be positive/,
      );
    }
  });

  it('rejects an inverted operand range only when expressions are actually used', () => {
    const broken = validParams();
    broken.exprOperandMin = 9;
    broken.exprOperandMax = 2; // max < min ⇒ generator would throw mid-draw
    expect(() => valueOrderingParamsFromProfile(makeProfile(broken))).toThrow(
      /degenerate expression operand range/,
    );

    // With expressionTiles === 0 the operands are never drawn: garbage there
    // is inert, so the decode still succeeds.
    const inert = validParams();
    inert.expressionTiles = 0;
    inert.exprOperandMin = 9;
    inert.exprOperandMax = 2;
    expect(valueOrderingParamsFromProfile(makeProfile(inert)).expressionTiles).toBe(0);
  });

  it('accepts boundary-valid profiles (tiles=2, expressionTiles=tiles, single-value operand range)', () => {
    const minimal = validParams();
    minimal.tiles = 2;
    minimal.expressionTiles = 2;
    minimal.exprOperandMin = 7;
    minimal.exprOperandMax = 7;
    const decoded = valueOrderingParamsFromProfile(makeProfile(minimal));
    expect(decoded.tiles).toBe(2);
    expect(decoded.expressionTiles).toBe(2);
  });
});

describe('encode/decode round-trip', () => {
  it('resolves every fixed level to exactly its tuned table entry', () => {
    for (const level of LEVELS) {
      const profile = resolveValueOrderingDifficulty(level);
      expect(profile.level).toBe(level);
      expect(profile.challengeRating).toBeGreaterThan(0);
      expect(valueOrderingParamsFromProfile(profile)).toEqual(
        VALUE_ORDERING_DIFFICULTY_PARAMS[level],
      );
    }
  });

  it('resolves adaptive to the frozen tuning including the tile-count bounds', () => {
    const profile = resolveValueOrderingDifficulty('adaptive');
    expect(profile.challengeRating).toBe(0.5);
    expect(valueOrderingParamsFromProfile(profile)).toEqual({ ...ADAPTIVE_PARAMS });
  });

  it('survives record → profile → params round-trips with optional fields', () => {
    const custom = { ...ADAPTIVE_PARAMS, tiles: 5, maxValue: 300 };
    const parameters = valueOrderingParamsToRecord(custom);
    // Records are numbers-only by SDK contract.
    for (const value of Object.values(parameters)) {
      expect(typeof value).toBe('number');
    }
    expect(valueOrderingParamsFromProfile(makeProfile(parameters))).toEqual(custom);
    expect(valueOrderingParamsForLevel('adaptive')).not.toBe(ADAPTIVE_PARAMS); // fresh object
  });
});

describe('nextTileCount + sessionChallengeRating edges', () => {
  it('keeps fixed levels constant regardless of outcome', () => {
    for (const level of LEVELS) {
      expect(nextTileCount(6, true, level, VALUE_ORDERING_DIFFICULTY_PARAMS[level])).toBe(6);
      expect(nextTileCount(6, false, level, VALUE_ORDERING_DIFFICULTY_PARAMS[level])).toBe(6);
    }
  });

  it('defaults stepTiles to 0 when bounds exist without a step', () => {
    const noStep = { ...ADAPTIVE_PARAMS, stepTiles: undefined };
    expect(nextTileCount(4, true, 'adaptive', noStep)).toBe(4);
  });

  it('clamps out-of-bound final tile counts into [0, 1] ratings', () => {
    const profile = resolveValueOrderingDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 99)).toBe(1);
    expect(sessionChallengeRating('adaptive', profile, -5)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 4)).toBeCloseTo(1 / 3, 10);
  });

  it('returns the baseline rating when the adaptive span is zero', () => {
    const flat = { ...ADAPTIVE_PARAMS, minTiles: 4, maxTiles: 4 };
    const profile = resolveValueOrderingDifficulty('adaptive');
    const flatRecord = valueOrderingParamsToRecord(flat);
    const flatProfile: DifficultyProfile = { ...profile, parameters: flatRecord };
    expect(sessionChallengeRating('adaptive', flatProfile, 4)).toBe(0.5);
  });
});

describe('adaptive round-trip through the reducer', () => {
  /** Play a full adaptive session where every round ends as `outcome`. */
  function playAdaptive(outcome: 'perfect' | 'mistake'): {
    state: ValueOrderingGameState;
    tilesSeen: number[];
  } {
    let state = valueOrderingGameReducer(createInitialValueOrderingState(), {
      type: 'select-difficulty',
      level: 'adaptive',
    });
    state = valueOrderingGameReducer(state, {
      type: 'start-session',
      seed: 'adapt-roundtrip',
      sessionId: 's-adapt',
      startedAtMs: 0,
    });
    const tilesSeen: number[] = [];
    for (let round = 0; round < ADAPTIVE_PARAMS.rounds; round += 1) {
      if (state.round === null) {
        throw new Error(`round ${round} missing`);
      }
      tilesSeen.push(state.tiles);
      const ascending = [...state.round.tiles].sort((a, b) => a.value - b.value);
      if (outcome === 'perfect') {
        ascending.forEach((tile, i) => {
          state = valueOrderingGameReducer(state, {
            type: 'tap-tile',
            tileId: tile.id,
            atActiveMs: round * 100_000 + 200 + i * 50,
          });
        });
      } else {
        const wrongId = ascending[ascending.length - 1].id; // largest first: instant mistake
        state = valueOrderingGameReducer(state, {
          type: 'tap-tile',
          tileId: wrongId,
          atActiveMs: round * 100_000 + 200,
        });
      }
      if (round < ADAPTIVE_PARAMS.rounds - 1) {
        // The next round begins at a fresh round-start offset; its taps below
        // must land AFTER this (active-ms monotonicity) and inside the budget.
        state = valueOrderingGameReducer(state, {
          type: 'next-round',
          startActiveMs: (round + 1) * 100_000,
        });
      }
    }
    return { state, tilesSeen };
  }

  it('grows tiles 4 → 6 on all-perfect play and lands rating 1.0', () => {
    const { state, tilesSeen } = playAdaptive('perfect');
    expect(tilesSeen[0]).toBe(4);
    expect(tilesSeen).toContain(5);
    for (const count of tilesSeen) {
      expect(count).toBeLessThanOrEqual(6);
      expect(count).toBeGreaterThanOrEqual(3);
    }
    expect(tilesSeen[tilesSeen.length - 1]).toBe(6); // clamped at max
    expect(state.stats.roundsHit).toBe(ADAPTIVE_PARAMS.rounds);
    const profile = resolveValueOrderingDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, state.tiles)).toBe(1);
  });

  it('shrinks tiles 4 → 3 on all-mistake play and lands rating 0.0', () => {
    const { state, tilesSeen } = playAdaptive('mistake');
    expect(tilesSeen[0]).toBe(4);
    expect(tilesSeen[tilesSeen.length - 1]).toBe(3); // clamped at min
    expect(state.stats.mistakes).toBe(ADAPTIVE_PARAMS.rounds);
    const profile = resolveValueOrderingDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, state.tiles)).toBe(0);
  });
});

describe('tier consistency audit (campaign 012)', () => {
  it('escalates tile count, range and expression mix monotonically while tightening time', () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      const lo = VALUE_ORDERING_DIFFICULTY_PARAMS[LEVELS[i - 1]];
      const hi = VALUE_ORDERING_DIFFICULTY_PARAMS[LEVELS[i]];
      expect(hi.tiles).toBeGreaterThan(lo.tiles);
      expect(hi.maxValue).toBeGreaterThan(lo.maxValue);
      expect(hi.expressionTiles).toBeGreaterThanOrEqual(lo.expressionTiles);
      expect(hi.budgetMs).toBeLessThan(lo.budgetMs);
      expect(hi.rounds).toBeGreaterThan(lo.rounds);
    }
  });

  it('keeps easy genuinely easy: few tiles, tiny range, no expressions', () => {
    const easy = VALUE_ORDERING_DIFFICULTY_PARAMS.easy;
    expect(easy.tiles).toBe(3);
    expect(easy.maxValue).toBeLessThanOrEqual(20);
    expect(easy.expressionTiles).toBe(0);
  });

  it('keeps expert meaningful without degenerate items', () => {
    const expert = VALUE_ORDERING_DIFFICULTY_PARAMS.expert;
    expect(expert.tiles).toBe(6);
    expect(expert.budgetMs).toBeGreaterThan(0);
    // The range hosts its tiles even in the worst case where every expression
    // collapses onto plain-range values (distinctness is still guaranteed by
    // the generator's collision resolution).
    expect(expert.maxValue - expert.minValue + 1).toBeGreaterThanOrEqual(expert.tiles);
    // Expression operands stay sane at every level that uses them.
    for (const level of LEVELS) {
      const params = VALUE_ORDERING_DIFFICULTY_PARAMS[level];
      if (params.expressionTiles === 0) continue;
      expect(params.exprOperandMax).toBeGreaterThanOrEqual(params.exprOperandMin);
      expect(params.exprOperandMin).toBeGreaterThanOrEqual(2); // no ×1/−0 triviality
    }
  });
});
