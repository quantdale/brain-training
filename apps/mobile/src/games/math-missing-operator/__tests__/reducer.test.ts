// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import {
  budgetForRound,
  mathMissingOperatorParamsForLevel,
} from '../difficulty';
import { generateEquation } from '../generator';
import { mathMissingOperatorGameReducer } from '../reducer';
import { createInitialMathMissingOperatorState } from '../types';
import type { MathMissingOperatorAction, MathMissingOperatorGameState } from '../types';

const SEED = 'reducer-seed';
const LEVEL: DifficultyLevel = 'normal';
const PARAMS = mathMissingOperatorParamsForLevel(LEVEL);

function initialState(level: DifficultyLevel = LEVEL): MathMissingOperatorGameState {
  const state = createInitialMathMissingOperatorState();
  return mathMissingOperatorGameReducer(state, { type: 'select-difficulty', level });
}

function startedState(level: DifficultyLevel = LEVEL, seed = SEED): MathMissingOperatorGameState {
  let state = initialState(level);
  state = mathMissingOperatorGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId: 's1',
    startedAtMs: 1_000_000,
    roundStartedAtMs: 100,
  });
  return state;
}

function expectedEquation(roundIndex: number, rating = 0.5) {
  return generateEquation({
    rng: createRng(SEED),
    roundIndex,
    params: PARAMS,
    level: LEVEL,
    rating,
  });
}

describe('mathMissingOperatorGameReducer', () => {
  it('selects difficulty only in the intro phase', () => {
    const state = initialState();
    expect(state.difficulty).toBe('normal');
    const selected = mathMissingOperatorGameReducer(state, { type: 'select-difficulty', level: 'expert' });
    expect(selected.difficulty).toBe('expert');
    // No-op once a session is running.
    const inSession = startedState();
    expect(mathMissingOperatorGameReducer(inSession, { type: 'select-difficulty', level: 'easy' })).toBe(inSession);
  });

  it('starts a session with a deterministic round-0 equation and reset stats', () => {
    const state = startedState();
    expect(state.phase).toBe('answer');
    expect(state.profile?.level).toBe('normal');
    expect(state.equation).toEqual(expectedEquation(0));
    expect(state.stats).toEqual(expect.objectContaining({ score: 0, roundsPlayed: 0, timeouts: 0 }));
    expect(state.roundStartedAtMs).toBe(100);
    expect(state.roundElapsedMs).toBe(0);
  });

  it('is fully deterministic: identical action streams produce identical sessions', () => {
    const run = (): MathMissingOperatorGameState[] => {
      let state = startedState();
      const trail: MathMissingOperatorGameState[] = [state];
      for (let round = 0; round < PARAMS.rounds; round += 1) {
        const equation = state.equation!;
        state = mathMissingOperatorGameReducer(state, {
          type: 'answer-round',
          operator: equation.answerOperator,
          responseMs: 500,
        });
        trail.push(state);
        state = mathMissingOperatorGameReducer(state, { type: 'next-round', roundStartedAtMs: 500 });
        trail.push(state);
      }
      return trail;
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    // The final state reached the results phase.
    expect(a[a.length - 1].phase).toBe('results');
    // Equations escalate through the round: expect the round-4 equation too.
    expect(a[6].equation).toEqual(expectedEquation(3, 0.5));
  });

  it('scores a correct answer with the response-time bonus', () => {
    const budget = budgetForRound(PARAMS, 0);
    const state = startedState();
    const next = mathMissingOperatorGameReducer(state, {
      type: 'answer-round',
      operator: state.equation!.answerOperator,
      responseMs: 0,
    });
    expect(next.phase).toBe('roundResult');
    expect(next.roundOutcome).toBe('correct');
    expect(next.stats.roundsCorrect).toBe(1);
    expect(next.stats.roundsPlayed).toBe(1);
    expect(next.stats.score).toBe(150); // instant → full bonus
    expect(next.lastAnsweredOperator).toBe(state.equation!.answerOperator);
    expect(next.stats.totalResponseMs).toBe(0);

    const slow = mathMissingOperatorGameReducer(state, {
      type: 'answer-round',
      operator: state.equation!.answerOperator,
      responseMs: budget,
    });
    expect(slow.stats.score).toBe(100); // at budget → base only
  });

  it('records a wrong answer without a score and breaks the streak', () => {
    const state = startedState();
    const wrongOp =
      state.equation!.answerOperator === '+' ? '-' : '+';
    const next = mathMissingOperatorGameReducer(state, {
      type: 'answer-round',
      operator: wrongOp,
      responseMs: 100,
    });
    expect(next.roundOutcome).toBe('wrong');
    expect(next.stats.roundsCorrect).toBe(0);
    expect(next.stats.score).toBe(0);
    expect(next.stats.streak).toBe(0);
    expect(next.stats.totalResponseMs).toBe(100);
  });

  it('ignores answers while paused or outside the answer phase', () => {
    const state = startedState();
    const paused = mathMissingOperatorGameReducer(state, { type: 'pause', pausedAtMs: 200 });
    expect(paused.paused).toBe(true);
    expect(
      mathMissingOperatorGameReducer(paused, {
        type: 'answer-round',
        operator: state.equation!.answerOperator,
        responseMs: 50,
      }),
    ).toBe(paused);
    const resolved = mathMissingOperatorGameReducer(state, {
      type: 'answer-round',
      operator: state.equation!.answerOperator,
      responseMs: 50,
    });
    expect(
      mathMissingOperatorGameReducer(resolved, {
        type: 'answer-round',
        operator: state.equation!.answerOperator,
        responseMs: 50,
      }),
    ).toBe(resolved);
  });

  it('times out a round: outcome timeout, timeouts+1, streak reset', () => {
    const state = startedState();
    const next = mathMissingOperatorGameReducer(state, { type: 'round-timeout' });
    expect(next.phase).toBe('roundResult');
    expect(next.roundOutcome).toBe('timeout');
    expect(next.stats.roundsPlayed).toBe(1);
    expect(next.stats.roundsCorrect).toBe(0);
    expect(next.stats.timeouts).toBe(1);
    expect(next.lastAnsweredOperator).toBeNull();
    // No-op outside the answer phase.
    expect(mathMissingOperatorGameReducer(next, { type: 'round-timeout' })).toBe(next);
  });

  it('advances rounds deterministically and finishes after the last round', () => {
    let state = startedState();
    for (let round = 0; round < PARAMS.rounds; round += 1) {
      state = mathMissingOperatorGameReducer(state, {
        type: 'answer-round',
        operator: state.equation!.answerOperator,
        responseMs: 100,
      });
      const next = mathMissingOperatorGameReducer(state, { type: 'next-round', roundStartedAtMs: 100 });
      if (round < PARAMS.rounds - 1) {
        expect(next.phase).toBe('answer');
        expect(next.roundIndex).toBe(round + 1);
        expect(next.equation).toEqual(expectedEquation(round + 1));
      } else {
        expect(next.phase).toBe('results');
        expect(next.roundOutcome).toBeNull();
      }
      state = next;
    }
    expect(state.stats.roundsPlayed).toBe(PARAMS.rounds);
    expect(state.stats.roundsCorrect).toBe(PARAMS.rounds);
  });

  it('banks paused time without letting it touch the round elapsed time', () => {
    const state = startedState();
    const paused = mathMissingOperatorGameReducer(state, { type: 'pause', pausedAtMs: 400 });
    expect(paused.roundElapsedMs).toBe(300); // 400 − 100
    expect(paused.roundStartedAtMs).toBe(400);
    const resumed = mathMissingOperatorGameReducer(paused, { type: 'resume', resumedAtMs: 900 });
    expect(resumed.paused).toBe(false);
    expect(resumed.roundStartedAtMs).toBe(900);
    expect(resumed.roundElapsedMs).toBe(300);
    // A later answer measures only active time: 300 banked + (1000 − 900).
    const answered = mathMissingOperatorGameReducer(resumed, {
      type: 'answer-round',
      operator: resumed.equation!.answerOperator,
      responseMs: 400,
    });
    expect(answered.stats.totalResponseMs).toBe(400);
  });

  it('moves the adaptive rating per outcome', () => {
    let state = startedState('adaptive', SEED);
    expect(state.adaptiveRating).toBe(0.5);
    // Fast correct: +0.10.
    state = mathMissingOperatorGameReducer(state, {
      type: 'answer-round',
      operator: state.equation!.answerOperator,
      responseMs: 1,
    });
    expect(state.adaptiveRating).toBeCloseTo(0.6);
    // Timeout: −0.12.
    state = mathMissingOperatorGameReducer(state, { type: 'next-round', roundStartedAtMs: 0 });
    state = mathMissingOperatorGameReducer(state, { type: 'round-timeout' });
    expect(state.adaptiveRating).toBeCloseTo(0.48);
  });

  it('finalizes the session and tracks persistence outcomes', () => {
    let state = startedState();
    state = mathMissingOperatorGameReducer(state, {
      type: 'session-finalized',
      xp: 12,
      normalized: 0.85,
      activeDurationMs: 30_000,
      pausedDurationMs: 1_000,
      completedAtMs: 2_000_000,
    });
    expect(state.xp).toBe(12);
    expect(state.normalized).toBe(0.85);
    expect(state.activeDurationMs).toBe(30_000);
    state = mathMissingOperatorGameReducer(state, { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = mathMissingOperatorGameReducer(state, { type: 'persistence-failed', message: 'disk full' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('disk full');
  });

  it('force-win ends the session as a perfect run and marks it forced', () => {
    const state = startedState();
    const next = mathMissingOperatorGameReducer(state, { type: 'qa/force-win' });
    expect(next.phase).toBe('results');
    expect(next.forced).toBe(true);
    expect(next.stats.roundsCorrect).toBe(PARAMS.rounds);
    expect(next.stats.score).toBe(150 * PARAMS.rounds);
    expect(next.stats.timeouts).toBe(0);
  });

  it('force-lose counts the in-flight round as failed', () => {
    const state = startedState();
    const next = mathMissingOperatorGameReducer(state, { type: 'qa/force-lose' });
    expect(next.phase).toBe('results');
    expect(next.forced).toBe(true);
    expect(next.stats.roundsPlayed).toBe(1);
    expect(next.stats.roundsCorrect).toBe(0);
    expect(next.stats.score).toBe(0);
    // A resolved round stays as-is when losing from roundResult.
    const resolved = mathMissingOperatorGameReducer(state, {
      type: 'answer-round',
      operator: state.equation!.answerOperator,
      responseMs: 100,
    });
    const lost = mathMissingOperatorGameReducer(resolved, { type: 'qa/force-lose' });
    expect(lost.stats.roundsPlayed).toBe(1);
    expect(lost.stats.roundsCorrect).toBe(1);
  });

  it('force-state applies seed and difficulty only in the intro phase', () => {
    const state = initialState();
    const patched = mathMissingOperatorGameReducer(state, {
      type: 'qa/force-state',
      patch: { seed: 'qa-42', difficulty: 'expert' },
    });
    expect(patched.seedOverride).toBe('qa-42');
    expect(patched.difficulty).toBe('expert');
    const inSession = startedState();
    expect(
      mathMissingOperatorGameReducer(inSession, {
        type: 'qa/force-state',
        patch: { seed: 'x' },
      }),
    ).toBe(inSession);
  });

  it('toggles the tutorial flag', () => {
    let state = initialState();
    state = mathMissingOperatorGameReducer(state, { type: 'tutorial-open' });
    expect(state.tutorialOpen).toBe(true);
    state = mathMissingOperatorGameReducer(state, { type: 'tutorial-close' });
    expect(state.tutorialOpen).toBe(false);
  });

  it('leaves unknown actions untouched (exhaustiveness guard)', () => {
    const state = startedState();
    const unknown = { type: 'not-an-action' } as unknown as MathMissingOperatorAction;
    expect(mathMissingOperatorGameReducer(state, unknown)).toBe(state);
  });
});
