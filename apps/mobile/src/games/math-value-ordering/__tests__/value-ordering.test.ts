// Jest globals imported explicitly (repo has no @types/jest).
// Small determinism suite for the NEW pure logic of math-value-ordering
// (generator invariants, scoring bounds, adaptive mapping, reducer core).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  VALUE_ORDERING_DIFFICULTY_PARAMS,
  nextTileCount,
  sessionChallengeRating,
  resolveValueOrderingDifficulty,
} from '../difficulty';
import {
  EXPRESSION_OPERATORS,
  evaluateExpression,
  generateSessionRounds,
  sortedValuesOf,
  validateRound,
} from '../generator';
import type { ExpressionOperator } from '../generator';
import {
  normalizeValueOrderingResult,
  perfectSessionScore,
  roundScore,
  speedFactorOf,
} from '../scoring';
import { valueOrderingGameReducer } from '../reducer';
import { createInitialValueOrderingState } from '../types';
import type {
  ValueOrderingAction,
  ValueOrderingRawResult,
} from '../types';

const LEVELS = ['easy', 'normal', 'hard', 'expert'] as const;

describe('generator', () => {
  it('is deterministic for a given seed and difficulty', () => {
    for (const level of LEVELS) {
      const params = VALUE_ORDERING_DIFFICULTY_PARAMS[level];
      const a = generateSessionRounds(createRng('det-seed'), params);
      const b = generateSessionRounds(createRng('det-seed'), params);
      expect(a).toEqual(b);
    }
  });

  it('always emits pairwise-distinct integer values with the exact expression mix', () => {
    for (const level of LEVELS) {
      const params = VALUE_ORDERING_DIFFICULTY_PARAMS[level];
      for (let seed = 0; seed < 100; seed += 1) {
        const rounds = generateSessionRounds(createRng(`distinct-${level}-${seed}`), params);
        for (const round of rounds) {
          expect(validateRound(round, params.tiles).ok).toBe(true);
          const expressions = round.tiles.filter((tile) => tile.kind === 'expression');
          expect(expressions).toHaveLength(params.expressionTiles);
          for (const tile of round.tiles) {
            if (tile.kind === 'plain') {
              expect(tile.display).toBe(String(tile.value));
            } else {
              // "a <op> b" must evaluate back to the comparison value.
              const [a, operator, b] = tile.display.split(' ');
              expect(EXPRESSION_OPERATORS).toContain(operator);
              expect(
                evaluateExpression(operator as ExpressionOperator, Number(a), Number(b)),
              ).toBe(tile.value);
              expect(tile.value).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
  });

  it('shuffles display order (never sorted by value across a session)', () => {
    const params = VALUE_ORDERING_DIFFICULTY_PARAMS.normal;
    let unsortedRounds = 0;
    for (let seed = 0; seed < 20; seed += 1) {
      for (const round of generateSessionRounds(createRng(`shuffle-${seed}`), params)) {
        const values = round.tiles.map((tile) => tile.value);
        const sorted = [...values].sort((a, b) => a - b);
        if (values.some((value, i) => value !== sorted[i])) {
          unsortedRounds += 1;
        }
      }
    }
    expect(unsortedRounds).toBeGreaterThan(0);
  });

  it('validateRound rejects an ambiguous duplicate-value round', () => {
    const params = VALUE_ORDERING_DIFFICULTY_PARAMS.easy;
    const [round] = generateSessionRounds(createRng('dup-check'), params);
    const duplicated = {
      tiles: [
        { ...round.tiles[0], id: 't0' },
        { ...round.tiles[0], id: 't1' },
        round.tiles[1],
      ],
    };
    const validation = validateRound(duplicated, params.tiles);
    expect(validation.ok).toBe(false);
    expect(validation.reason).toContain('duplicate value');
  });
});

describe('scoring + normalization', () => {
  it('bounds per-round score to [100, 150] and rewards only speed within it', () => {
    expect(speedFactorOf(0, 10_000)).toBe(1);
    expect(speedFactorOf(10_000, 10_000)).toBe(0);
    expect(roundScore(1)).toBe(150);
    expect(roundScore(0)).toBe(100);
    expect(perfectSessionScore(VALUE_ORDERING_DIFFICULTY_PARAMS.normal)).toBe(10 * 150);
  });

  it('normalizes a perfect session to 1.0 and an all-mistake session to 0', () => {
    const base = {
      roundsTotal: 2,
      roundsPlayed: 2,
      finalTiles: 4,
      challengeRating: 0.5,
      difficulty: 'normal' as const,
      seed: 'norm-seed',
      gameVersion: '1.0.0',
      generatorVersion: '1.0.0',
      scoringVersion: '1.0.0',
      forced: false,
      generatorInfo: {},
      diagnosticMetadata: {},
    };
    const perfect: ValueOrderingRawResult = {
      ...base,
      score: 300,
      roundsHit: 2,
      meanSpeedFactor: 1,
      avgProgress: 1,
      diagnosticMetadata: {
        gameId: 'math-value-ordering',
        sdkVersion: '0.1.0',
        gameVersion: base.gameVersion,
        generatorVersion: base.generatorVersion,
        seed: base.seed,
        difficulty: base.difficulty,
        startedAtMs: 0,
        activeDurationMs: 1,
        pausedDurationMs: 0,
      },
    };
    const allMiss: ValueOrderingRawResult = {
      ...base,
      score: 0,
      roundsHit: 0,
      meanSpeedFactor: 0,
      avgProgress: 0.125,
      diagnosticMetadata: perfect.diagnosticMetadata,
    };
    const context = { gameId: 'math-value-ordering', difficulty: 'normal' as const, durationMs: 1 };
    expect(normalizeValueOrderingResult(perfect, context).value).toBe(1);
    expect(normalizeValueOrderingResult(allMiss, context).value).toBe(0);
  });
});

describe('adaptive difficulty', () => {
  it('moves the tile count ±step within [minTiles, maxTiles] and maps it to [0, 1]', () => {
    const profile = resolveValueOrderingDifficulty('adaptive');
    expect(nextTileCount(4, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(5);
    expect(nextTileCount(4, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(3);
    expect(nextTileCount(6, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(6); // clamped high
    expect(nextTileCount(3, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(3); // clamped low
    expect(sessionChallengeRating('adaptive', profile, 3)).toBe(0);
    expect(sessionChallengeRating('adaptive', profile, 6)).toBe(1);
    expect(sessionChallengeRating('adaptive', profile, 4)).toBeCloseTo(1 / 3, 5);
    expect(sessionChallengeRating('normal', resolveValueOrderingDifficulty('normal'), 4)).toBe(0.5);
  });
});

describe('reducer core', () => {
  it('completes a perfect ascending run and ends on a wrong tap as a mistake', () => {
    const start: ValueOrderingAction = {
      type: 'start-session',
      seed: 'reducer-seed',
      sessionId: 's1',
      startedAtMs: 0,
    };
    let state = valueOrderingGameReducer(
      createInitialValueOrderingState(),
      start,
    );
    expect(state.phase).toBe('ordering');

    const ascending = [...state.round!.tiles].sort((a, b) => a.value - b.value);
    for (let i = 0; i < ascending.length; i += 1) {
      state = valueOrderingGameReducer(state, {
        type: 'tap-tile',
        tileId: ascending[i].id,
        atActiveMs: 1000 + i * 100,
      });
    }
    expect(state.outcome).toBe('perfect');
    expect(state.stats.roundsHit).toBe(1);
    expect(state.stats.score).toBeGreaterThan(100);

    // Next round: one wrong tap (not the minimum remaining) resolves instantly.
    state = valueOrderingGameReducer(state, { type: 'next-round', startActiveMs: 5000 });
    expect(state.phase).toBe('ordering');
    const minimumId = [...state.round!.tiles].sort((a, b) => a.value - b.value)[0].id;
    const wrongTile = state.round!.tiles.find((tile) => tile.id !== minimumId)!;
    state = valueOrderingGameReducer(state, {
      type: 'tap-tile',
      tileId: wrongTile.id,
      atActiveMs: 5200,
    });
    expect(state.outcome).toBe('mistake');
    expect(state.mistakeTileId).toBe(wrongTile.id);
    expect(state.stats.mistakes).toBe(1);
    expect(sortedValuesOf(state.round!)).toHaveLength(state.round!.tiles.length);
  });
});
