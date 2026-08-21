// Adversarial property/boundary suite for math-value-ordering generation
// (campaign 011 W03). Complements value-ordering.test.ts: collision-forced
// fallbacks, fork isolation, display uniqueness, validator rejection matrix,
// and expression semantics. All seeds are fixed — failures reproduce exactly.
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { ADAPTIVE_PARAMS, VALUE_ORDERING_DIFFICULTY_PARAMS } from '../difficulty';
import {
  EXPRESSION_OPERATORS,
  evaluateExpression,
  formatExpression,
  generateRound,
  generateSessionRounds,
  sortedValuesOf,
  validateRound,
} from '../generator';
import type { ExpressionOperator } from '../generator';
import type { ValueOrderingDifficultyParams, ValueOrderingRound } from '../types';

const LEVELS = ['easy', 'normal', 'hard', 'expert'] as const;
const SWEEP_SEEDS = 40;

/** Every level's params plus the adaptive tuning, for uniform sweeps. */
function allParams(): { label: string; params: ValueOrderingDifficultyParams }[] {
  return [
    ...LEVELS.map((level) => ({ label: level, params: VALUE_ORDERING_DIFFICULTY_PARAMS[level] })),
    { label: 'adaptive', params: ADAPTIVE_PARAMS },
  ];
}

/** Parse an expression display back into (a, operator, b). */
function parseExpression(display: string): { a: number; op: ExpressionOperator; b: number } {
  const [a, op, b] = display.split(' ');
  return { a: Number(a), op: op as ExpressionOperator, b: Number(b) };
}

describe('generator property sweep (seeds × difficulties)', () => {
  it('always yields solvable, unambiguous rounds with unique ids and unique displays', () => {
    for (const { label, params } of allParams()) {
      const expectedExpressions = Math.min(params.expressionTiles, params.tiles);
      for (let seed = 0; seed < SWEEP_SEEDS; seed += 1) {
        const rounds = generateSessionRounds(createRng(`adv-${label}-${seed}`), params);
        expect(rounds).toHaveLength(params.rounds);
        for (const round of rounds) {
          expect(validateRound(round, params.tiles)).toEqual({ ok: true, reason: null });

          // Pairwise-distinct integer values ⇒ the ascending order is the
          // UNIQUE solution; verify strict increase after sorting.
          const ascending = sortedValuesOf(round);
          for (let i = 1; i < ascending.length; i += 1) {
            expect(ascending[i]).toBeGreaterThan(ascending[i - 1]);
          }

          const displays = round.tiles.map((tile) => tile.display);
          expect(new Set(displays).size).toBe(params.tiles);

          // Ids are positional (`t<displayIndex>`), sequential and unique.
          expect(round.tiles.map((tile) => tile.id)).toEqual(
            Array.from({ length: params.tiles }, (_, i) => `t${i}`),
          );

          const expressions = round.tiles.filter((tile) => tile.kind === 'expression');
          expect(expressions).toHaveLength(expectedExpressions);
        }
      }
    }
  });

  it('keeps expression values non-negative and equal to their parsed operands', () => {
    for (const { label, params } of allParams()) {
      if (params.expressionTiles === 0) {
        continue;
      }
      for (let seed = 0; seed < SWEEP_SEEDS; seed += 1) {
        for (const round of generateSessionRounds(createRng(`expr-${label}-${seed}`), params)) {
          for (const tile of round.tiles) {
            if (tile.kind !== 'expression') {
              continue;
            }
            const { a, op, b } = parseExpression(tile.display);
            expect(EXPRESSION_OPERATORS).toContain(op);
            expect(evaluateExpression(op, a, b)).toBe(tile.value);
            // The subtraction swap guarantees non-negative results.
            expect(tile.value).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('reproduces byte-identical sessions per seed and diverges across seeds', () => {
    for (const { label, params } of allParams()) {
      const a = generateSessionRounds(createRng(`repr-${label}`), params);
      const b = generateSessionRounds(createRng(`repr-${label}`), params);
      expect(a).toEqual(b);
    }
    // Cross-seed divergence: identical full sessions across distinct seeds are
    // astronomically unlikely; deterministic given fixed inputs either way.
    const x = JSON.stringify(generateSessionRounds(createRng('repr-x'), VALUE_ORDERING_DIFFICULTY_PARAMS.normal));
    const y = JSON.stringify(generateSessionRounds(createRng('repr-y'), VALUE_ORDERING_DIFFICULTY_PARAMS.normal));
    expect(x).not.toBe(y);
  });

  it('isolates rounds via RNG forks — prior parent-stream draws never change later rounds', () => {
    // Regression pin for the fork design (`round:<index>:attempt:<n>` derives
    // from the canonical seed): consuming the parent stream must not shift
    // any future round's content, or recorded seeds stop reproducing results.
    const params = VALUE_ORDERING_DIFFICULTY_PARAMS.normal;
    const consumed = createRng('fork-iso');
    for (let i = 0; i < 500; i += 1) {
      consumed.next();
    }
    const fresh = createRng('fork-iso');
    for (let index = 0; index < params.rounds; index += 1) {
      expect(generateRound(consumed, index, params, params.tiles, null)).toEqual(
        generateRound(fresh, index, params, params.tiles, null),
      );
    }
  });

  it('varies consecutive rounds (variety re-draw holds for shipped tuning)', () => {
    // Deterministic seed set: if this passes once it passes forever; a failure
    // means MAX_ROUND_ATTEMPTS no longer suffices for the tuned ranges.
    for (const { label, params } of allParams()) {
      for (let seed = 0; seed < SWEEP_SEEDS; seed += 1) {
        const rounds = generateSessionRounds(createRng(`variety-${label}-${seed}`), params);
        for (let i = 1; i < rounds.length; i += 1) {
          const prev = sortedValuesOf(rounds[i - 1]);
          const current = sortedValuesOf(rounds[i]);
          const differs = current.some((value, j) => j >= prev.length || value !== prev[j]);
          expect(differs).toBe(true);
        }
      }
    }
  });
});

describe('collision-forced generation (fallback paths)', () => {
  it('fills an exact-fit range via redraws + sequential probe, staying distinct', () => {
    // span === tiles: every draw collides until the probe fills the remainder.
    const tight: ValueOrderingDifficultyParams = {
      rounds: 6,
      budgetMs: 10_000,
      tiles: 4,
      minValue: 10,
      maxValue: 13,
      expressionTiles: 0,
      exprOperandMin: 2,
      exprOperandMax: 9,
    };
    for (let seed = 0; seed < 25; seed += 1) {
      const round = generateRound(createRng(`tight-${seed}`), 0, tight, tight.tiles, null);
      expect(validateRound(round, 4).ok).toBe(true);
      expect(sortedValuesOf(round)).toEqual([10, 11, 12, 13]);
    }
  });

  it('degrades colliding expression tiles to plain values without ambiguity', () => {
    // Operands [2,3] can only produce {0,4,5,6,9}; with tiles=5 over a 4-wide
    // plain range the expression streams collide constantly and the probe
    // degrades some tiles to plain integers. Distinctness must survive.
    const cramped: ValueOrderingDifficultyParams = {
      rounds: 6,
      budgetMs: 10_000,
      tiles: 5,
      minValue: 0,
      maxValue: 8,
      expressionTiles: 4,
      exprOperandMin: 2,
      exprOperandMax: 3,
    };
    for (let seed = 0; seed < 25; seed += 1) {
      const round = generateRound(createRng(`cramped-${seed}`), 0, cramped, cramped.tiles, null);
      const validation = validateRound(round, 5);
      expect(validation.ok).toBe(true);
      for (const tile of round.tiles) {
        if (tile.kind === 'expression') {
          const { a, op, b } = parseExpression(tile.display);
          expect(evaluateExpression(op, a, b)).toBe(tile.value);
        } else {
          expect(tile.display).toBe(String(tile.value));
        }
      }
    }
  });

  it('caps expressions at the tile count when tileCount drops below expressionTiles', () => {
    const params = VALUE_ORDERING_DIFFICULTY_PARAMS.normal; // expressionTiles 1
    const round = generateRound(createRng('cap'), 0, params, 2, null);
    expect(validateRound(round, 2).ok).toBe(true);
    expect(round.tiles.filter((tile) => tile.kind === 'expression')).toHaveLength(1);
  });
});

describe('expression primitives', () => {
  it('evaluates and formats every operator as displayed on tiles', () => {
    expect(evaluateExpression('+', 2, 3)).toBe(5);
    expect(evaluateExpression('−', 9, 4)).toBe(5);
    expect(evaluateExpression('×', 6, 4)).toBe(24);
    expect(formatExpression('×', 6, 4)).toBe('6 × 4');
    expect(formatExpression('+', 12, 7)).toBe('12 + 7');
    expect(formatExpression('−', 15, 8)).toBe('15 − 8');
  });
});

describe('validateRound rejection matrix', () => {
  const base: ValueOrderingRound = {
    tiles: [
      { id: 't0', kind: 'plain', display: '3', value: 3 },
      { id: 't1', kind: 'plain', display: '11', value: 11 },
      { id: 't2', kind: 'plain', display: '27', value: 27 },
    ],
  };

  it('accepts a well-formed round', () => {
    expect(validateRound(base)).toEqual({ ok: true, reason: null });
  });

  it('rejects fewer than two tiles', () => {
    expect(validateRound({ tiles: [base.tiles[0]] }).ok).toBe(false);
  });

  it('rejects a tile-count mismatch against the expectation', () => {
    const validation = validateRound(base, 5);
    expect(validation.ok).toBe(false);
    expect(validation.reason).toContain('expected 5 tiles');
  });

  it.each([
    ['NaN value', { ...base.tiles[0], value: NaN }],
    ['non-integer value', { ...base.tiles[0], value: 3.5 }],
    ['infinite value', { ...base.tiles[0], value: Infinity }],
  ])('rejects %s', (_name, badTile) => {
    const validation = validateRound({ tiles: [badTile, base.tiles[1], base.tiles[2]] });
    expect(validation.ok).toBe(false);
    expect(validation.reason).toContain('finite integer');
  });

  it('rejects empty displays and duplicate ids', () => {
    const emptyDisplay = validateRound({
      tiles: [{ ...base.tiles[0], display: '' }, base.tiles[1]],
    });
    expect(emptyDisplay.reason).toContain('empty display');

    const duplicateId = validateRound({
      tiles: [base.tiles[0], { ...base.tiles[1], id: 't0' }],
    });
    expect(duplicateId.reason).toContain('duplicate tile id t0');
  });

  it('rejects ambiguous duplicate-value rounds', () => {
    const validation = validateRound({
      tiles: [base.tiles[0], { ...base.tiles[1], value: 3, display: '3' }],
    });
    expect(validation.ok).toBe(false);
    expect(validation.reason).toContain('duplicate value 3');
  });
});
