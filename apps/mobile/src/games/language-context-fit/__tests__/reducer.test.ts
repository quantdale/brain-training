import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { loadContentPack } from '../content-validation';
import { filterByTiers, selectRound } from '../generator';
import { contextFitGameReducer , createInitialContextFitState } from '../reducer';
import type { ContextFitGameState } from '../types';

const POOL = filterByTiers(loadContentPack().items, ['t1', 't2', 't3']);

function started(overrides: Partial<ContextFitGameState> = {}): ContextFitGameState {
  let state = createInitialContextFitState();
  state = contextFitGameReducer(state, { type: 'select-difficulty', level: 'normal' });
  state = contextFitGameReducer(state, {
    type: 'start-session',
    seed: 'reducer-seed',
    sessionId: 's1',
    startedAtMs: 0,
    nowMs: 0,
  });
  return { ...state, ...overrides };
}

describe('context-fit reducer', () => {
  it('select-difficulty only in intro and start-session builds a round', () => {
    const s0 = createInitialContextFitState();
    const s1 = contextFitGameReducer(s0, { type: 'select-difficulty', level: 'hard' });
    expect(s1.difficulty).toBe('hard');
    const s2 = contextFitGameReducer(s1, {
      type: 'start-session',
      seed: 'x',
      sessionId: 's',
      startedAtMs: 0,
      nowMs: 0,
    });
    expect(s2.phase).toBe('question');
    expect(s2.round).not.toBeNull();
    expect(s2.roundBudgetMs).toBeGreaterThan(0);
    expect(s2.roundDeadlineMs).toBe(s2.roundBudgetMs);
  });

  it('answer-option correct updates score and streak; wrong resets streak', () => {
    const s = started();
    const correctIndex = s.round!.correctIndex;
    const s2 = contextFitGameReducer(s, { type: 'answer-option', index: correctIndex, nowMs: 500 });
    expect(s2.phase).toBe('roundResult');
    expect(s2.roundOutcome).toBe('correct');
    expect(s2.stats.roundsCorrect).toBe(1);
    expect(s2.stats.score).toBeGreaterThan(0);

    // wrong answer
    const s3 = started();
    const wrong = (s3.round!.correctIndex + 1) % 4;
    const s4 = contextFitGameReducer(s3, { type: 'answer-option', index: wrong, nowMs: 500 });
    expect(s4.roundOutcome).toBe('wrong');
    expect(s4.stats.roundsCorrect).toBe(0);
    expect(s4.stats.streak).toBe(0);
  });

  it('answer after deadline is ignored', () => {
    const s = started();
    const s2 = contextFitGameReducer(s, { type: 'answer-option', index: 0, nowMs: s.roundBudgetMs + 1000 });
    expect(s2.phase).toBe('question');
    expect(s2.roundOutcome).toBeNull();
  });

  it('expire-round times out the round at the deadline', () => {
    const s = started();
    const s2 = contextFitGameReducer(s, { type: 'expire-round', nowMs: s.roundBudgetMs });
    expect(s2.phase).toBe('roundResult');
    expect(s2.roundOutcome).toBe('timeout');
    expect(s2.lastAnswerMs).toBe(s.roundBudgetMs);
  });

  it('next-round advances; final round transitions to results', () => {
    const s = started();
    // answer the first round to reach roundResult, then advance.
    const answered = contextFitGameReducer(s, { type: 'answer-option', index: s.round!.correctIndex, nowMs: 100 });
    const s2 = contextFitGameReducer(answered, { type: 'next-round', nowMs: 1000 });
    expect(s2.phase).toBe('question');
    expect(s2.roundIndex).toBe(1);
    // play through the remaining rounds to the end.
    let last = s2;
    for (let i = 1; i < 6; i += 1) {
      const c = last.round!.correctIndex;
      last = contextFitGameReducer(last, { type: 'answer-option', index: c, nowMs: 100 + i });
      last = contextFitGameReducer(last, { type: 'next-round', nowMs: 2000 + i });
    }
    expect(last.phase).toBe('results');
  });

  it('pause freezes remaining budget; resume rebuilds the deadline', () => {
    const s = started();
    const s2 = contextFitGameReducer(s, { type: 'pause', nowMs: 1000 });
    expect(s2.paused).toBe(true);
    expect(s2.roundDeadlineMs).toBeNull();
    expect(s2.roundRemainingMs).toBe(s.roundBudgetMs - 1000);
    const s3 = contextFitGameReducer(s2, { type: 'resume', nowMs: 2000 });
    expect(s3.paused).toBe(false);
    expect(s3.roundDeadlineMs).toBe(2000 + (s.roundBudgetMs - 1000));
    expect(s3.roundStartedAtMs).toBe(2000 - 1000);
  });

  it('qa/force-win produces a perfect results state', () => {
    const s = started();
    const s2 = contextFitGameReducer(s, { type: 'qa/force-win' });
    expect(s2.phase).toBe('results');
    expect(s2.forced).toBe(true);
    expect(s2.stats.roundsCorrect).toBe(6);
    expect(s2.stats.score).toBe(900);
  });

  it('qa/force-lose produces a failed results state', () => {
    const s = started();
    const s2 = contextFitGameReducer(s, { type: 'qa/force-lose' });
    expect(s2.phase).toBe('results');
    expect(s2.forced).toBe(true);
  });

  it('qa/force-timeout expires the current round without forcing the session', () => {
    const s = started();
    const s2 = contextFitGameReducer(s, { type: 'qa/force-timeout' });
    expect(s2.phase).toBe('roundResult');
    expect(s2.roundOutcome).toBe('timeout');
    expect(s2.forced).toBe(false);
  });

  it('session-finalized stores xp/normalized/durations', () => {
    const s = started();
    const s2 = contextFitGameReducer(s, {
      type: 'session-finalized',
      xp: 42,
      normalized: 0.7,
      activeDurationMs: 100,
      pausedDurationMs: 0,
      completedAtMs: 500,
    });
    expect(s2.xp).toBe(42);
    expect(s2.normalized).toBe(0.7);
    expect(s2.activeDurationMs).toBe(100);
  });
});

/** Guard against accidental drift in the generated round shape used by tests. */
describe('round generation helper', () => {
  it('selectRound returns a valid round for the seeded session', () => {
    const round = selectRound({
      rng: createRng('reducer-seed'),
      roundIndex: 0,
      pool: POOL,
      usedItemIds: new Set(),
      previousRound: null,
    });
    expect(round.options).toHaveLength(4);
    expect(round.options[round.correctIndex]).toBe(round.correctWord);
  });
});
