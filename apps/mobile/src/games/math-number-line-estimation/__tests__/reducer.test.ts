// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import { ADAPTIVE_PARAMS, NUMBER_LINE_DIFFICULTY_PARAMS } from '../difficulty';
import {
  createInitialNumberLineState,
  numberLineGameReducer,
} from '../reducer';
import type { NumberLineGameState } from '../types';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): NumberLineGameState {
  let state = createInitialNumberLineState();
  state = numberLineGameReducer(state, { type: 'select-difficulty', level });
  state = numberLineGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
  });
  return state;
}

describe('select-difficulty / start-session', () => {
  it('selects a level in the intro and ignores selection mid-session', () => {
    const initial = createInitialNumberLineState();
    expect(initial.difficulty).toBe('normal');
    const picked = numberLineGameReducer(initial, { type: 'select-difficulty', level: 'hard' });
    expect(picked.difficulty).toBe('hard');
    const mid = startSession('x');
    const ignored = numberLineGameReducer(mid, { type: 'select-difficulty', level: 'easy' });
    expect(ignored.difficulty).toBe('normal');
  });

  it('opens the first round with the level tuning and a valid target', () => {
    const state = startSession('seed-1', 'hard');
    expect(state.phase).toBe('estimating');
    expect(state.profile?.level).toBe('hard');
    expect(state.round).not.toBeNull();
    expect(state.roundBudgetMs).toBe(NUMBER_LINE_DIFFICULTY_PARAMS.hard.budgetMs);
    expect(state.tolerancePct).toBe(NUMBER_LINE_DIFFICULTY_PARAMS.hard.tolerancePct);
    expect(state.round?.target).toBeGreaterThan(0);
    expect(state.round?.target).toBeLessThan(NUMBER_LINE_DIFFICULTY_PARAMS.hard.lineMax);
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('is deterministic for the same seed', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.round).toEqual(b.round);
  });
});

describe('estimate', () => {
  it('resolves an exact tap as a hit with full closeness and 150 points', () => {
    let state = startSession('exact');
    const target = state.round!.target;
    state = numberLineGameReducer(state, { type: 'estimate', value: target, atActiveMs: 500 });
    expect(state.phase).toBe('feedback');
    expect(state.outcome).toBe('hit');
    expect(state.estimateValue).toBe(target);
    expect(state.stats.score).toBe(150);
    expect(state.stats.roundsHit).toBe(1);
    expect(state.stats.totalCloseness).toBeCloseTo(1);
  });

  it('scores a far tap as a miss with zero points but records the error', () => {
    let state = startSession('miss');
    const round = state.round!;
    const span = round.lineMax - round.lineMin;
    // Tap the endpoint farther from the target: the distance is at least
    // half the span, far beyond the 6%-of-span normal tolerance.
    const farValue =
      round.target - round.lineMin > round.lineMax - round.target ? round.lineMin : round.lineMax;
    state = numberLineGameReducer(state, { type: 'estimate', value: farValue, atActiveMs: 100 });
    expect(Math.abs(farValue - round.target)).toBeGreaterThan(span * 0.06);
    expect(state.outcome).toBe('miss');
    expect(state.stats.score).toBe(0);
    expect(state.stats.roundsHit).toBe(0);
    expect(state.stats.totalAbsoluteError).toBeGreaterThan(0);
  });

  it('ignores duplicate estimates after the round resolves (double-submit protection)', () => {
    let state = startSession('double');
    const target = state.round!.target;
    state = numberLineGameReducer(state, { type: 'estimate', value: target, atActiveMs: 200 });
    const afterFirst = state;
    state = numberLineGameReducer(state, { type: 'estimate', value: target, atActiveMs: 300 });
    expect(state).toBe(afterFirst); // no second resolution
    expect(state.stats.roundsPlayed).toBe(1);
  });

  it('rejects out-of-range and non-integer values instead of guessing', () => {
    let state = startSession('range');
    const before = state;
    state = numberLineGameReducer(state, { type: 'estimate', value: -5, atActiveMs: 10 });
    state = numberLineGameReducer(state, {
      type: 'estimate',
      value: (state.round?.lineMax ?? 0) + 1000,
      atActiveMs: 10,
    });
    state = numberLineGameReducer(state, { type: 'estimate', value: 2.5, atActiveMs: 10 });
    state = numberLineGameReducer(state, { type: 'estimate', value: NaN, atActiveMs: 10 });
    expect(state).toBe(before);
  });

  it('scores a past-budget submit as a timeout even before the next tick', () => {
    let state = startSession('late-submit');
    const budget = state.roundBudgetMs;
    const target = state.round!.target;
    state = numberLineGameReducer(state, {
      type: 'estimate',
      value: target,
      atActiveMs: budget + 1,
    });
    expect(state.phase).toBe('feedback');
    expect(state.outcome).toBe('timeout');
    expect(state.estimateValue).toBeNull();
    expect(state.stats.score).toBe(0);
    expect(state.stats.timeouts).toBe(1);
  });

  it('ignores estimates while paused', () => {
    let state = startSession('paused-tap');
    state = numberLineGameReducer(state, { type: 'pause' });
    const before = state;
    state = numberLineGameReducer(state, {
      type: 'estimate',
      value: state.round!.target,
      atActiveMs: 100,
    });
    expect(state).toBe(before);
  });
});

describe('round-tick / timeout', () => {
  it('advances roundElapsedMs and times out exactly at the budget', () => {
    let state = startSession('tick');
    const budget = state.roundBudgetMs;
    state = numberLineGameReducer(state, { type: 'round-tick', atActiveMs: budget - 1 });
    expect(state.phase).toBe('estimating');
    expect(state.roundElapsedMs).toBe(budget - 1);
    state = numberLineGameReducer(state, { type: 'round-tick', atActiveMs: budget });
    expect(state.phase).toBe('feedback');
    expect(state.outcome).toBe('timeout');
    expect(state.stats.timeouts).toBe(1);
  });

  it('ignores ticks while paused or outside estimating', () => {
    let state = startSession('paused-tick');
    state = numberLineGameReducer(state, { type: 'pause' });
    const before = state;
    state = numberLineGameReducer(state, { type: 'round-tick', atActiveMs: 60_000 });
    expect(state).toBe(before);
  });
});

describe('next-round / session end', () => {
  it('walks every round then finishes with results', () => {
    const rounds = NUMBER_LINE_DIFFICULTY_PARAMS.normal.rounds;
    let state = startSession('full');
    for (let i = 0; i < rounds; i += 1) {
      expect(state.phase).toBe('estimating');
      const target = state.round!.target;
      state = numberLineGameReducer(state, { type: 'estimate', value: target, atActiveMs: (i + 1) * 1000 });
      expect(state.outcome).toBe('hit');
      state = numberLineGameReducer(state, {
        type: 'next-round',
        startActiveMs: (i + 1) * 1000,
      });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(rounds);
    expect(state.stats.roundsHit).toBe(rounds);
    expect(state.stats.streak).toBe(rounds);
  });

  it('moves the adaptive tolerance per outcome within bounds', () => {
    let state = startSession('adaptive', 'adaptive');
    const startPct = state.tolerancePct;
    const target = state.round!.target;
    state = numberLineGameReducer(state, { type: 'estimate', value: target, atActiveMs: 100 });
    state = numberLineGameReducer(state, { type: 'next-round', startActiveMs: 100 });
    expect(state.tolerancePct).toBeCloseTo(startPct - (ADAPTIVE_PARAMS.stepTolerancePct ?? 1));
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = numberLineGameReducer(createInitialNumberLineState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = numberLineGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = numberLineGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(numberLineGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });
});

describe('qa force paths', () => {
  it('force-win ends with a perfect deterministic run flagged forced', () => {
    let state = startSession('qa-win');
    state = numberLineGameReducer(state, { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsHit).toBe(NUMBER_LINE_DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats.timeouts).toBe(0);
    // Normalizer over these stats must produce exactly 1.
    expect(state.stats.totalCloseness).toBe(state.stats.roundsPlayed);
  });

  it('force-lose ends with all misses and zero score', () => {
    let state = startSession('qa-lose');
    state = numberLineGameReducer(state, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.score).toBe(0);
    expect(state.stats.roundsHit).toBe(0);
  });

  it('force paths are no-ops in intro/results', () => {
    const intro = createInitialNumberLineState();
    expect(numberLineGameReducer(intro, { type: 'qa/force-win' })).toBe(intro);
    const done = numberLineGameReducer(startSession('q'), { type: 'qa/force-win' });
    expect(numberLineGameReducer(done, { type: 'qa/force-win' })).toBe(done);
  });

  it('force-state patches difficulty/seed only in the intro', () => {
    const initial = createInitialNumberLineState();
    const patched = numberLineGameReducer(initial, {
      type: 'qa/force-state',
      patch: { seed: 'abc', difficulty: 'expert' },
    });
    expect(patched.difficulty).toBe('expert');
    expect(patched.seedOverride).toBe('abc');
    const mid = startSession('q');
    expect(
      numberLineGameReducer(mid, { type: 'qa/force-state', patch: { seed: 'x' } }),
    ).toBe(mid);
  });
});
