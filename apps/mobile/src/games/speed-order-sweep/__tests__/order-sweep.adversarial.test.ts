// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  ORDER_SWEEP_DIFFICULTY_PARAMS,
  nextWindowMs,
} from '../difficulty';
import { generateRound, validateRound } from '../generator';
import { createInitialOrderSweepState, orderSweepGameReducer } from '../reducer';
import { correctPoints, normalizeOrderSweepResult, paceMs, perfectRoundBonus } from '../scoring';
import { buildOrderSweepRawResult } from '../session';
import { GAME_ID, INITIAL_STATS } from '../types';
import type {
  OrderSweepGameState,
  OrderSweepRawResult,
  OrderSweepRound,
  OrderSweepStats,
} from '../types';

/**
 * Adversarial validation for Campaign 010's Order Sweep game (packet W02).
 *
 * Property sweeps over the generator, boundary probes over the reducer
 * (deadline edge, pause freeze, post-expiry input), normalization bounds, and
 * the adaptive window band. Expectations encode the *documented* contracts in
 * each module's header docs; where the campaign brief differs from the
 * implemented contract the test pins the implementation and the divergence is
 * reported in `.agent/_tasks/campaign011/W02.md`.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All five tunings: the four fixed levels plus the adaptive band profile. */
const ALL_TUNINGS = [
  ...Object.entries(ORDER_SWEEP_DIFFICULTY_PARAMS).map(([level, params]) => ({
    level: level as DifficultyLevel,
    params,
  })),
  { level: 'adaptive' as DifficultyLevel, params: ADAPTIVE_PARAMS },
];

/** Monotonic clock value round 1 opens at (arbitrary synthetic epoch). */
const T0 = 10_000;

function startSession(level: DifficultyLevel, seed = 'w02-seed'): OrderSweepGameState {
  let state = orderSweepGameReducer(createInitialOrderSweepState(), {
    type: 'select-difficulty',
    level,
  });
  return orderSweepGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId: `${GAME_ID}-w02`,
    startedAtMs: T0 - 1_000,
    roundStartedAtMs: T0,
  });
}

function tokenByValue(round: OrderSweepRound, value: number): { id: number; value: number } {
  const token = round.tokens.find((candidate) => candidate.value === value);
  if (token === undefined) {
    throw new Error(`W02 fixture error: no token with value ${value}`);
  }
  return token;
}

function tap(state: OrderSweepGameState, tokenId: number, nowMs: number): OrderSweepGameState {
  return orderSweepGameReducer(state, { type: 'tap', tokenId, nowMs });
}

/** Full session board set for one tuning (same fork discipline as gameplay). */
function fullSession(
  seed: string,
  count: number,
  rounds: number,
  columns: number,
  maxValue: number,
): OrderSweepRound[] {
  const rng = createRng(seed);
  const boards: OrderSweepRound[] = [];
  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    boards.push(generateRound({ rng, roundIndex, count, columns, maxValue }));
  }
  return boards;
}

/** Row-major visible reading of a board (tokens arrive sorted by cell id). */
function rowMajorReading(round: OrderSweepRound): number[] {
  return [...round.tokens].sort((a, b) => a.id - b.id).map((token) => token.value);
}

function rawResult(stats: OrderSweepStats, overrides: Partial<OrderSweepRawResult> = {}) {
  return buildOrderSweepRawResult({
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    scoringVersion: '1.0.0',
    difficulty: 'normal',
    params: ORDER_SWEEP_DIFFICULTY_PARAMS.normal,
    challengeRating: 0.5,
    seed: 'w02',
    stats,
    finalWindowMs: ORDER_SWEEP_DIFFICULTY_PARAMS.normal.initialWindowMs,
    forced: false,
    startedAtMs: 0,
    activeDurationMs: 0,
    pausedDurationMs: 0,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// (a) Generator property sweep: 5 difficulties × 30 seeds
// ---------------------------------------------------------------------------

describe('generator property sweep (5 difficulties × 30 seeds)', () => {
  const SEEDS = Array.from({ length: 30 }, (_, i) => `w02-${i + 1}`);

  it('every board of every session passes validateRound: unique in-range values, ascending order', () => {
    for (const { params } of ALL_TUNINGS) {
      for (const seed of SEEDS) {
        for (const board of fullSession(
          seed,
          params.count,
          params.rounds,
          params.columns,
          params.maxValue,
        )) {
          const verdict = validateRound(board, params.count, params.maxValue);
          expect(verdict.ok).toBe(true);

          // Pairwise-distinct values, all inside [1, maxValue].
          expect(new Set(board.tokens.map((t) => t.value)).size).toBe(params.count);
          for (const token of board.tokens) {
            expect(token.value).toBeGreaterThanOrEqual(1);
            expect(token.value).toBeLessThanOrEqual(params.maxValue);
          }

          // The row-major visible reading must never already be the ascending
          // sequence — a sorted board removes the scan task entirely.
          const ascending = [...board.order];
          expect(rowMajorReading(board)).not.toEqual(ascending);
        }
      }
    }
  });

  it('replays identically from the same seed across every difficulty', () => {
    for (const { params } of ALL_TUNINGS) {
      for (const seed of SEEDS) {
        const first = fullSession(seed, params.count, params.rounds, params.columns, params.maxValue);
        const replay = fullSession(seed, params.count, params.rounds, params.columns, params.maxValue);
        expect(replay).toEqual(first);
      }
    }
  });

  it('different seeds produce different sessions (seed is load-bearing)', () => {
    const params = ORDER_SWEEP_DIFFICULTY_PARAMS.normal;
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const boards = fullSession(seed, params.count, params.rounds, params.columns, params.maxValue);
      seen.add(JSON.stringify(boards[0]));
    }
    expect(seen.size).toBe(SEEDS.length);
  });
});

// ---------------------------------------------------------------------------
// (b) Reducer: tap sequencing, wrong/duplicate/expired input, deadline edge
// ---------------------------------------------------------------------------

describe('reducer: tap handling', () => {
  it('scores a correct ascending tap sequence and finishes the round as perfect', () => {
    let state = startSession('normal');
    const round = state.round as OrderSweepRound;
    const windowMs = state.windowMs;
    const pace = paceMs(windowMs, round.order.length);
    let now = T0;

    for (const value of round.order) {
      now += 100;
      state = tap(state, tokenByValue(round, value).id, now);
      if (value !== round.order[round.order.length - 1]) {
        expect(state.phase).toBe('active');
      }
    }

    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('perfect'); // zero wrong taps
    expect(state.stats.tokensCleared).toBe(round.order.length);
    expect(state.stats.gaps).toEqual(Array.from({ length: round.order.length }, () => 100));
    // Exact documented formula: 100 base + 50·speedFactor per token + 40/token bonus.
    const expectedPoints = round.order.reduce(
      (sum) => sum + correctPoints(pace, 100),
      perfectRoundBonus(round.order.length),
    );
    expect(state.stats.score).toBeCloseTo(expectedPoints, 9);
    expect(state.stats.bestStreak).toBe(round.order.length);
  });

  it('a wrong tap counts the mistake and breaks the streak but does NOT end the round (documented contract)', () => {
    let state = startSession('normal');
    const round = state.round as OrderSweepRound;
    const wrongToken = round.tokens.find((t) => t.value === round.order[round.order.length - 1]);
    if (wrongToken === undefined) throw new Error('fixture error');

    state = tap(state, wrongToken.id, T0 + 100);
    // Round continues: still active, nothing cleared, mistake recorded.
    expect(state.phase).toBe('active');
    expect(state.clearedCount).toBe(0);
    expect(state.lastVerdict).toBe('wrong');
    expect(state.stats.wrongTaps).toBe(1);
    expect(state.roundWrongTaps).toBe(1);
    expect(state.stats.streak).toBe(0);

    // Sweeping correctly afterwards still clears the round — as 'cleared',
    // never 'perfect', because roundWrongTaps != 0.
    let now = T0 + 200;
    for (const value of round.order) {
      state = tap(state, tokenByValue(round, value).id, (now += 100));
    }
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('cleared');
    expect(state.stats.perfectRounds).toBe(0);
    expect(state.stats.wrongTaps).toBe(1);
  });

  it('ignores taps on cells with no token (state object unchanged)', () => {
    let state = startSession('normal');
    const before = state;
    state = tap(state, 999, T0 + 100);
    expect(state).toBe(before);
  });

  it('counts a duplicate tap on an already-cleared token as wrong (defense-in-depth; UI disables cleared tokens)', () => {
    let state = startSession('easy'); // 6 tokens / 2 rows — small board
    const round = state.round as OrderSweepRound;
    const firstId = tokenByValue(round, round.order[0]).id;

    state = tap(state, firstId, T0 + 100);
    expect(state.clearedCount).toBe(1);
    expect(state.lastVerdict).toBe('correct');

    // Same cell tapped again while still in 'active': values are unique so it
    // can never be the required minimum — the reducer records a wrong tap.
    state = tap(state, firstId, T0 + 200);
    expect(state.clearedCount).toBe(1);
    expect(state.lastVerdict).toBe('wrong');
    expect(state.stats.wrongTaps).toBe(1);
    expect(state.stats.streak).toBe(0);
  });

  it('ignores input after the window expires but accepts a tap at exactly the deadline', () => {
    let state = startSession('hard');
    const deadline = state.deadlineMs as number;
    const round = state.round as OrderSweepRound;

    // Boundary: nowMs == deadlineMs is still inside the window (guard is strict >).
    const boundary = tap(state, tokenByValue(round, round.order[0]).id, deadline);
    expect(boundary).not.toBe(state);
    expect(boundary.clearedCount).toBe(1);
    expect(boundary.lastVerdict).toBe('correct');

    // One ms later: ignored entirely (identity-preserving).
    const late = tap(boundary, tokenByValue(round, round.order[1]).id, deadline + 1);
    expect(late).toBe(boundary);
    expect(late.stats.tokensCleared).toBe(1);
  });

  it('resolves the round as expired at the deadline boundary, charging the unswept tokens', () => {
    let state = startSession('expert');
    const deadline = state.deadlineMs as number;
    const round = state.round as OrderSweepRound;
    const totalTokens = round.order.length;

    // Clear one token instantly, then let the window run out exactly.
    state = tap(state, tokenByValue(round, round.order[0]).id, T0 + 10);
    state = orderSweepGameReducer(state, { type: 'round-expired', nowMs: deadline });

    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('expired');
    expect(state.deadlineMs).toBeNull();
    expect(state.lastClearAtMs).toBeNull();
    expect(state.stats.tokensExpired).toBe(totalTokens - 1);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.streak).toBe(0);

    // Post-expiry taps are inert (round-result phase owns the board now).
    const straggler = tokenByValue(round, round.order[1]).id;
    expect(tap(state, straggler, deadline + 500)).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// (c) Pause freeze: resume shifts open anchors by exactly the paused delta
// ---------------------------------------------------------------------------

describe('pause freeze semantics', () => {
  it('shifts deadline/roundStart/lastClear by exactly the paused delta and excludes pause from measured gaps', () => {
    let state = startSession('normal'); // window 8000 → deadline T0+8000 = 18000
    const round = state.round as OrderSweepRound;

    // Two quick clears before pausing: lastClear anchor lands at 10900.
    state = tap(state, tokenByValue(round, round.order[0]).id, T0 + 500);
    state = tap(state, tokenByValue(round, round.order[1]).id, T0 + 900);
    expect(state.lastClearAtMs).toBe(T0 + 900);

    // Pause at wall clock 12000; the screen freezes remaining = 18000 − 12000.
    state = orderSweepGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
    const frozen = state;

    // Input during the pause is ignored outright.
    expect(tap(frozen, tokenByValue(round, round.order[2]).id, 13_000)).toBe(frozen);

    // Resume after Δ = 5000 ms of pause (now 17000, remainingMs 6000).
    state = orderSweepGameReducer(state, {
      type: 'resume',
      nowMs: 17_000,
      remainingMs: 6_000,
    });

    const delta = 5_000;
    expect(state.paused).toBe(false);
    expect(state.deadlineMs).toBe(18_000 + delta);
    expect(state.roundStartedAtMs).toBe(T0 + delta);
    expect(state.lastClearAtMs).toBe(T0 + 900 + delta);

    // A clear right after resume measures only active-play time: wall gap from
    // the pre-pause clear would be 17500 − 10900 = 6600; the shifted anchor
    // yields 1600 instead — pause time excluded from the speed factor.
    state = tap(state, tokenByValue(round, round.order[2]).id, 17_500);
    expect(state.stats.gaps[2]).toBe(1600);
  });

  it('clamps resume overshoot: remainingMs above the window caps at the window, below zero floors at zero', () => {
    let state = startSession('normal');
    const windowMs = state.windowMs; // 8000

    // Malicious/stale screen hands back more than the whole window: capped.
    state = orderSweepGameReducer(state, { type: 'pause' });
    state = orderSweepGameReducer(state, { type: 'resume', nowMs: 50_000, remainingMs: 99_999 });
    expect(state.deadlineMs).toBe(50_000 + windowMs);
    expect(state.roundStartedAtMs).toBe(T0 + ((50_000 + windowMs) - (T0 + windowMs)));

    // Zero remaining resumes into an immediately-expired window position.
    state = orderSweepGameReducer(state, { type: 'pause' });
    state = orderSweepGameReducer(state, { type: 'resume', nowMs: 60_000, remainingMs: -5 });
    expect(state.deadlineMs).toBe(60_000);
  });

  it('pausing on the round-result card just unpauses (nothing to re-anchor)', () => {
    let state = startSession('normal');
    const round = state.round as OrderSweepRound;
    let now = T0;
    for (const value of round.order) {
      state = tap(state, tokenByValue(round, value).id, (now += 100));
    }
    expect(state.phase).toBe('roundResult');
    state = orderSweepGameReducer(state, { type: 'pause' });
    state = orderSweepGameReducer(state, { type: 'resume', nowMs: 99_999, remainingMs: 0 });
    expect(state.paused).toBe(false);
    expect(state.deadlineMs).toBeNull();
    expect(state.roundStartedAtMs).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// (d) Normalization bounds: empty → 0, perfect-instant → 1, ratio dominates
// ---------------------------------------------------------------------------

describe('normalizeOrderSweepResult bounds', () => {
  const context = { gameId: GAME_ID, difficulty: 'normal' as const, durationMs: 0 };

  it('an empty session normalizes to exactly 0', () => {
    const raw = rawResult(INITIAL_STATS);
    expect(normalizeOrderSweepResult(raw, context).value).toBe(0);
  });

  it('a perfect instant-clear session normalizes to exactly 1', () => {
    const total = ORDER_SWEEP_DIFFICULTY_PARAMS.normal.count * ORDER_SWEEP_DIFFICULTY_PARAMS.normal.rounds;
    const perfectStats: OrderSweepStats = {
      score: total * 190,
      tokensCleared: total,
      tokensExpired: 0,
      wrongTaps: 0,
      gaps: Array.from({ length: total }, () => 0),
      speedFactors: Array.from({ length: total }, () => 1),
      bestStreak: total,
      streak: total,
      roundsPlayed: ORDER_SWEEP_DIFFICULTY_PARAMS.normal.rounds,
      roundsCleared: ORDER_SWEEP_DIFFICULTY_PARAMS.normal.rounds,
      perfectRounds: ORDER_SWEEP_DIFFICULTY_PARAMS.normal.rounds,
    };
    const result = normalizeOrderSweepResult(rawResult(perfectStats), context);
    expect(result.scale).toBe('0..1');
    expect(result.value).toBe(1);
  });

  it('clearRatio dominates meanSpeed per the documented 0.6·clear + 0.4·speed blend', () => {
    // Half the board cleared instantly beats the whole board cleared at zero
    // speed margin — completion weight (0.6) outweighs speed weight (0.4).
    const halfInstant = normalizeOrderSweepResult(
      rawResult({
        ...INITIAL_STATS,
        tokensCleared: 23,
        tokensExpired: 22,
        // meanSpeed is derived from speedFactors (all 1 → mean 1).
        speedFactors: Array.from({ length: 23 }, () => 1),
      }),
      context,
    );
    const allSlow = normalizeOrderSweepResult(
      rawResult({
        ...INITIAL_STATS,
        tokensCleared: 45,
        // meanSpeed is derived from speedFactors (all 0 → mean 0).
        speedFactors: Array.from({ length: 45 }, () => 0),
      }),
      context,
    );
    expect(halfInstant.value).toBeCloseTo(0.6 * (23 / 45) + 0.4 * 1, 12);
    expect(allSlow.value).toBeCloseTo(0.6, 12);
    expect(halfInstant.value).toBeGreaterThan(allSlow.value);

    // Formula exactness across a grid of (cleared, meanSpeed) combos.
    for (const cleared of [0, 9, 18, 27, 36, 45]) {
      for (const meanSpeed of [0, 0.25, 0.5, 0.75, 1]) {
        const expected = 0.6 * (cleared / 45) + 0.4 * meanSpeed;
        const result = normalizeOrderSweepResult(
          rawResult({
            ...INITIAL_STATS,
            tokensCleared: cleared,
            tokensExpired: 45 - cleared,
            // meanSpeed is derived from speedFactors (single-element array).
            speedFactors: [meanSpeed],
          }),
          context,
        );
        expect(result.value).toBeCloseTo(expected, 12);
      }
    }

    // Monotone in clearRatio at fixed speed.
    let previous = -1;
    for (let cleared = 0; cleared <= 45; cleared += 5) {
      const value = normalizeOrderSweepResult(
        rawResult({
          ...INITIAL_STATS,
          tokensCleared: cleared,
          tokensExpired: 45 - cleared,
          // meanSpeed is derived from speedFactors (all 0.4 → mean 0.4).
          speedFactors: [0.4],
        }),
        context,
      ).value;
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

// ---------------------------------------------------------------------------
// (e) Adaptive window round-trip stays inside its band
// ---------------------------------------------------------------------------

describe('adaptive window band round-trip', () => {
  it('walks ±windowStepMs and clamps inside [minWindowMs, maxWindowBoundMs] over a long deterministic walk', () => {
    const minMs = ADAPTIVE_PARAMS.minWindowMs;
    const maxMs = ADAPTIVE_PARAMS.maxWindowBoundMs as number;
    // Deterministic walk pattern: long perfect streak drives to the floor,
    // then failing rounds drive to the cap, then mixed play.
    const pattern: boolean[] = [
      ...Array.from({ length: 20 }, () => true), // shrink toward the floor
      ...Array.from({ length: 20 }, () => false), // grow toward the cap
      true, false, true, false, false, true, // mixed
    ];
    let windowMs = ADAPTIVE_PARAMS.initialWindowMs;
    let hitFloor = false;
    let hitCap = false;
    for (const perfect of pattern) {
      windowMs = nextWindowMs(windowMs, perfect, 'adaptive', ADAPTIVE_PARAMS);
      expect(windowMs).toBeGreaterThanOrEqual(minMs);
      expect(windowMs).toBeLessThanOrEqual(maxMs);
      if (windowMs === minMs) hitFloor = true;
      if (windowMs === maxMs) hitCap = true;
    }
    expect(hitFloor).toBe(true);
    expect(hitCap).toBe(true);
    // Both bounds are actually reachable (clamped, not stuck short of them).
    expect(nextWindowMs(minMs, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(minMs);
    expect(nextWindowMs(maxMs, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(maxMs);
  });

  it('round-trips through the reducer: perfect shrinks, imperfect grows back, always in band', () => {
    let state = startSession('adaptive', 'w02-adaptive');
    expect(state.windowMs).toBe(ADAPTIVE_PARAMS.initialWindowMs);

    const sweepCurrentRound = (startNow: number): number => {
      const round = state.round as OrderSweepRound;
      let now = startNow;
      for (const value of round.order) {
        state = tap(state, tokenByValue(round, value).id, (now += 150));
      }
      return now;
    };

    // Round 0 swept perfectly → window shrinks by one step.
    let now = sweepCurrentRound(T0);
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('perfect');
    state = orderSweepGameReducer(state, { type: 'next-round', roundStartedAtMs: (now += 500) });
    expect(state.phase).toBe('active');
    expect(state.windowMs).toBe(ADAPTIVE_PARAMS.initialWindowMs - ADAPTIVE_PARAMS.windowStepMs);
    expect(state.windowMs).toBeGreaterThanOrEqual(ADAPTIVE_PARAMS.minWindowMs);
    expect(state.windowMs).toBeLessThanOrEqual(ADAPTIVE_PARAMS.maxWindowBoundMs as number);

    // Round 1 spoiled with a wrong tap → window grows back one step.
    const round1 = state.round as OrderSweepRound;
    const spoiler = round1.tokens.find((t) => t.value === round1.order[round1.order.length - 1]);
    if (spoiler === undefined) throw new Error('fixture error');
    state = tap(state, spoiler.id, (now += 100)); // wrong tap, round survives
    for (const value of round1.order) {
      state = tap(state, tokenByValue(round1, value).id, (now += 150));
    }
    expect(state.roundOutcome).toBe('cleared');
    state = orderSweepGameReducer(state, { type: 'next-round', roundStartedAtMs: (now += 500) });
    expect(state.windowMs).toBe(ADAPTIVE_PARAMS.initialWindowMs);
    expect(state.windowMs).toBeGreaterThanOrEqual(ADAPTIVE_PARAMS.minWindowMs);
    expect(state.windowMs).toBeLessThanOrEqual(ADAPTIVE_PARAMS.maxWindowBoundMs as number);
  });
});
