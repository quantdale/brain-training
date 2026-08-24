// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import { gameReducer } from '../reducer';
import { createInitialState } from '../types';
import type { SpatialTransformMatchGameState } from '../types';
import { perfectSessionScore } from '../scoring';
import { DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): SpatialTransformMatchGameState {
  let state = createInitialState();
  state = gameReducer(state, { type: 'select-difficulty', level });
  state = gameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

/** Advance the source phase to the choice phase. */
function advanceSource(state: SpatialTransformMatchGameState): SpatialTransformMatchGameState {
  return gameReducer(state, { type: 'source-tick' });
}

/** Simulate a correct answer in the choice phase. */
function answerCorrectly(
  state: SpatialTransformMatchGameState,
  answerMs = 1000,
): SpatialTransformMatchGameState {
  return gameReducer(state, {
    type: 'select-option',
    index: state.correctOptionIndex,
    answerMs,
  });
}

/** Simulate a wrong answer in the choice phase. */
function answerWrongly(
  state: SpatialTransformMatchGameState,
  answerMs = 1000,
): SpatialTransformMatchGameState {
  const wrongIndex = state.correctOptionIndex === 0 ? 1 : 0;
  return gameReducer(state, { type: 'select-option', index: wrongIndex, answerMs });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = gameReducer(createInitialState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = gameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the source phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('source');
    expect(state.profile?.level).toBe('normal');
    expect(state.sourcePattern).toHaveLength(4);
    expect(state.options).toHaveLength(3);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsPassed: 0,
      bestStreak: 0,
      streak: 0,
      totalAnswerMs: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same data for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.sourcePattern).toEqual(b.sourcePattern);
    expect(a.transformType).toBe(b.transformType);
    expect(a.options).toEqual(b.options);
    expect(a.correctOptionIndex).toBe(b.correctOptionIndex);
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.sourcePattern).toHaveLength(5);
    expect(expert.options).toHaveLength(4);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.sourcePattern).toHaveLength(3);
  });
});

describe('source-tick', () => {
  it('transitions from source to choice', () => {
    const state = startSession('r');
    const choice = advanceSource(state);
    expect(choice.phase).toBe('choice');
    expect(choice.correctOptionIndex).toBeGreaterThanOrEqual(0);
    expect(choice.correctOptionIndex).toBeLessThan(choice.options.length);
  });

  it('is ignored outside the source phase or while paused', () => {
    const inChoice = advanceSource(startSession('r'));
    expect(gameReducer(inChoice, { type: 'source-tick' }).phase).toBe('choice');
    const paused = gameReducer(startSession('r'), { type: 'pause' });
    expect(gameReducer(paused, { type: 'source-tick' }).phase).toBe('source');
  });
});

describe('select-option', () => {
  it('passes the round on a correct selection', () => {
    let state = advanceSource(startSession('opt', 'easy'));
    state = answerCorrectly(state);
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.score).toBe(100);
  });

  it('fails the round on a wrong selection', () => {
    let state = advanceSource(startSession('opt-wrong'));
    state = answerWrongly(state);
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('is ignored during source / after the round ended', () => {
    let state = startSession('x');
    state = gameReducer(state, { type: 'select-option', index: 0, answerMs: 100 });
    expect(state.phase).toBe('source');

    let ended = advanceSource(startSession('x'));
    ended = answerWrongly(ended);
    expect(ended.phase).toBe('roundResult');
    ended = gameReducer(ended, { type: 'select-option', index: 0, answerMs: 100 });
    expect(ended.stats.roundsPlayed).toBe(1);
  });
});

describe('next-round', () => {
  it('starts a new round after a pass', () => {
    let state = advanceSource(startSession('next'));
    state = answerCorrectly(state);
    state = gameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('source');
    expect(state.roundIndex).toBe(1);
    expect(state.sourcePattern).toHaveLength(4);
    expect(state.selectedOptionIndex).toBeNull();
  });

  it('holds params after a failure', () => {
    let state = advanceSource(startSession('next-fail'));
    state = answerWrongly(state);
    state = gameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('source');
    expect(state.roundIndex).toBe(1);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 4 rounds
    for (let round = 0; round < 4; round += 1) {
      state = advanceSource(state);
      state = answerCorrectly(state);
      state = gameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
    expect(state.stats.score).toBe(perfectSessionScore(DIFFICULTY_PARAMS.easy));
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes', () => {
    const inIntro = gameReducer(createInitialState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = gameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = gameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(gameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = gameReducer(startSession('p'), { type: 'pause' });
    state = gameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = gameReducer(createInitialState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(gameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = gameReducer(createInitialState(), {
      type: 'session-finalized',
      xp: 12,
      normalized: 0.75,
      activeDurationMs: 30_000,
      pausedDurationMs: 2_000,
      completedAtMs: 30_100,
    });
    expect(state.xp).toBe(12);
    expect(state.normalized).toBe(0.75);
    expect(state.activeDurationMs).toBe(30_000);
  });

  it('tracks persistence progress', () => {
    let state = gameReducer(createInitialState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = gameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      gameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = gameReducer(advanceSource(startSession('qa-win')), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.score).toBe(perfectSessionScore(DIFFICULTY_PARAMS.normal));
  });

  it('force-lose ends the session with the current round failed', () => {
    const midSource = startSession('qa-lose');
    const state = gameReducer(midSource, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = advanceSource(startSession('qa-lose2'));
    state = answerCorrectly(state);
    expect(state.roundOutcome).toBe('passed');
    const result = gameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsPassed).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = gameReducer(createInitialState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = gameReducer(advanceSource(startSession('q')), { type: 'qa/force-win' });
    const after = gameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = gameReducer(createInitialState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    state = gameReducer(createInitialState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    state = gameReducer(createInitialState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    const mid = gameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
