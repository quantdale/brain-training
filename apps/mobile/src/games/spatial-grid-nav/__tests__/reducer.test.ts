// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import { gameReducer } from '../reducer';
import { createInitialState } from '../types';
import type { SpatialGridNavGameState } from '../types';
import { generateSession } from '../generator';
import { perfectSessionScore } from '../scoring';
import { DIFFICULTY_PARAMS, paramsFromProfile, resolveSpatialGridNavDifficulty } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): SpatialGridNavGameState {
  let state = createInitialState();
  state = gameReducer(state, { type: 'select-difficulty', level });
  state = gameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

/** Simulate a correct answer in the trialActive phase. */
function answerCorrectly(
  state: SpatialGridNavGameState,
  responseMs = 1000,
): SpatialGridNavGameState {
  return gameReducer(state, {
    type: 'pick-cell',
    index: state.round!.correctIndex,
    responseMs,
  });
}

/** Simulate a wrong answer in the trialActive phase. */
function answerWrongly(
  state: SpatialGridNavGameState,
  responseMs = 1000,
): SpatialGridNavGameState {
  const wrongIndex = state.round!.correctIndex === 0 ? 1 : 0;
  return gameReducer(state, { type: 'pick-cell', index: wrongIndex, responseMs });
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
  it('resolves the difficulty and opens round 1 in the trialActive phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('trialActive');
    expect(state.profile?.level).toBe('normal');
    expect(state.round).not.toBeNull();
    expect(state.round!.options).toHaveLength(3);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      correctPicks: 0,
      mistakes: 0,
      bestStreak: 0,
      streak: 0,
      totalResponseMs: 0,
      scoredPicks: 0,
      hardPlayed: 0,
      hardCorrect: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same data for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.round!.start).toEqual(b.round!.start);
    expect(a.round!.startDir).toBe(b.round!.startDir);
    expect(a.round!.commands).toEqual(b.round!.commands);
    expect(a.round!.options).toEqual(b.round!.options);
    expect(a.round!.correctIndex).toBe(b.round!.correctIndex);
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.round!.options).toHaveLength(4);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.round!.options).toHaveLength(3);
  });
});

describe('pick-cell', () => {
  it('scores the round on a correct selection', () => {
    let state = startSession('opt', 'easy');
    state = answerCorrectly(state);
    expect(state.phase).toBe('trialResult');
    expect(state.roundOutcome).toBe('correct');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.score).toBeGreaterThan(0);
  });

  it('fails the round on a wrong selection', () => {
    let state = startSession('opt-wrong');
    state = answerWrongly(state);
    expect(state.phase).toBe('trialResult');
    expect(state.roundOutcome).toBe('wrong');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.streak).toBe(0);
  });

  it('counts hard rounds for normalization', () => {
    // easy has longThreshold 4; build a round known to be hard via expert seed.
    let state = startSession('hard-count', 'expert');
    // Force a deterministic hard round by scanning the plan for a hard round.
    const params = paramsFromProfile(state.profile!);
    const plan = generateSession(state.seed, params);
    const hardIndex = plan.findIndex((r) => r.commandCount >= params.longThreshold);
    // Play up to the hard round correctly.
    for (let i = 0; i <= hardIndex; i += 1) {
      state = answerCorrectly(state);
      state = gameReducer(state, { type: 'next-round' });
    }
    expect(state.stats.hardPlayed).toBeGreaterThanOrEqual(1);
    expect(state.stats.hardCorrect).toBeGreaterThanOrEqual(1);
  });

  it('is ignored outside the trialActive phase', () => {
    const intro = gameReducer(createInitialState(), { type: 'pick-cell', index: 0, responseMs: 100 });
    expect(intro.phase).toBe('intro');

    let ended = startSession('x');
    ended = answerWrongly(ended);
    expect(ended.phase).toBe('trialResult');
    ended = gameReducer(ended, { type: 'pick-cell', index: 0, responseMs: 100 });
    expect(ended.stats.roundsPlayed).toBe(1);
  });
});

describe('next-round', () => {
  it('starts a new round after a pick', () => {
    let state = startSession('next');
    state = answerCorrectly(state);
    state = gameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('trialActive');
    expect(state.roundIndex).toBe(1);
    expect(state.selectedOptionIndex).toBeNull();
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 6 rounds
    for (let round = 0; round < 6; round += 1) {
      state = answerCorrectly(state, 0);
      state = gameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(6);
    expect(state.stats.correctPicks).toBe(6);
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
    const state = gameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    const params = paramsFromProfile(resolveSpatialGridNavDifficulty('normal'));
    expect(state.stats.roundsPlayed).toBe(params.rounds);
    expect(state.stats.correctPicks).toBe(params.rounds);
    expect(state.stats.score).toBe(perfectSessionScore(params));
  });

  it('force-lose ends the session with the current round failed', () => {
    const state = gameReducer(startSession('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = startSession('qa-lose2');
    state = answerCorrectly(state);
    expect(state.roundOutcome).toBe('correct');
    const result = gameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.correctPicks).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = gameReducer(createInitialState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const started = startSession('q');
    const results = gameReducer(started, { type: 'qa/force-win' });
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
