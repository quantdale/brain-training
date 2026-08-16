// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { ADAPTIVE_PARAMS, SPATIAL_DIFFICULTY_PARAMS, paramsForPosition } from '../difficulty';
import { generateRound } from '../generator';
import { perfectSessionScore } from '../scoring';
import { spatialGameReducer } from '../reducer';
import { createInitialSpatialState } from '../types';
import type { SpatialGameState } from '../types';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): SpatialGameState {
  let state = createInitialSpatialState();
  state = spatialGameReducer(state, { type: 'select-difficulty', level });
  state = spatialGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = spatialGameReducer(createInitialSpatialState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = spatialGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the play phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('play');
    expect(state.profile?.level).toBe('normal');
    expect(state.rounds).toBe(5);
    expect(state.blocks).toBe(4);
    expect(state.angleMask).toBe(10);
    expect(state.timeBudgetMs).toBe(16_000);
    expect(state.timeRemainingMs).toBe(16_000);
    expect(state.roundStartedElapsedMs).toBe(0);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsPassed: 0,
      bestStreak: 0,
      streak: 0,
      totalAnswers: 0,
      correctAnswers: 0,
      timeouts: 0,
      totalRemainingMs: 0,
      totalBudgetMs: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
    expect(state.kind).not.toBeNull();
    expect(state.candidateDegrees).not.toBeNull();
  });

  it('generates the same round for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.target).toEqual(b.target);
    expect(a.candidate).toEqual(b.candidate);
    expect(a.kind).toEqual(b.kind);
    expect(a.target).toEqual(
      generateRound({
        rng: createRng('det'),
        roundIndex: 0,
        params: SPATIAL_DIFFICULTY_PARAMS.normal,
        prevTarget: null,
      }).target,
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.blocks).toBe(6);
    expect(expert.timeBudgetMs).toBe(9_000);
    expect(expert.rounds).toBe(7);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.blocks).toBe(4);
    expect(adaptive.angleMask).toBe(14);
    expect(adaptive.adaptivePosition).toBe(0.5);
  });
});

describe('clock-tick', () => {
  it('records the remaining budget', () => {
    let state = startSession('tick');
    state = spatialGameReducer(state, { type: 'clock-tick', remainingMs: 12_500 });
    expect(state.timeRemainingMs).toBe(12_500);
    expect(state.phase).toBe('play');
  });

  it('ends the round as a timeout at zero remaining', () => {
    let state = startSession('timeout');
    state = spatialGameReducer(state, { type: 'clock-tick', remainingMs: 250 });
    expect(state.phase).toBe('play');
    state = spatialGameReducer(state, { type: 'clock-tick', remainingMs: 0 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('timeout');
    expect(state.timeRemainingMs).toBe(0);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.timeouts).toBe(1);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.totalAnswers).toBe(0);
    expect(state.stats.totalBudgetMs).toBe(16_000);
    expect(state.stats.totalRemainingMs).toBe(0);
  });

  it('is ignored while paused or outside the play phase', () => {
    let state = startSession('tick');
    state = spatialGameReducer(state, { type: 'pause' });
    state = spatialGameReducer(state, { type: 'clock-tick', remainingMs: 0 });
    expect(state.phase).toBe('play'); // frozen: no timeout while paused
    const inResults = spatialGameReducer(state, { type: 'resume' });
    const afterTimeout = spatialGameReducer(inResults, { type: 'clock-tick', remainingMs: 0 });
    expect(afterTimeout.phase).toBe('roundResult');
    const again = spatialGameReducer(afterTimeout, { type: 'clock-tick', remainingMs: 5_000 });
    expect(again.timeRemainingMs).toBe(0); // ignored outside play
  });
});

describe('answer', () => {
  it('passes the round on a correct answer and scores base + speed bonus', () => {
    let state = startSession('ans');
    state = spatialGameReducer(state, { type: 'clock-tick', remainingMs: 16_000 });
    const kind = state.kind;
    state = spatialGameReducer(state, { type: 'answer', answer: kind as 'same' | 'different' });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.totalAnswers).toBe(1);
    expect(state.stats.correctAnswers).toBe(1);
    expect(state.stats.score).toBe(150);
    expect(state.stats.totalRemainingMs).toBe(16_000);
    expect(state.stats.totalBudgetMs).toBe(16_000);
  });

  it('fails the round on a wrong answer', () => {
    let state = startSession('wrong');
    state = spatialGameReducer(state, { type: 'clock-tick', remainingMs: 10_000 });
    const wrong = state.kind === 'same' ? 'different' : 'same';
    state = spatialGameReducer(state, { type: 'answer', answer: wrong });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.totalAnswers).toBe(1);
    expect(state.stats.correctAnswers).toBe(0);
    expect(state.stats.score).toBe(0);
    expect(state.stats.totalRemainingMs).toBe(10_000);
  });

  it('is ignored during reveal/roundResult and while paused', () => {
    const state = startSession('x');
    const paused = spatialGameReducer(state, { type: 'pause' });
    const afterPausedAnswer = spatialGameReducer(paused, { type: 'answer', answer: 'same' });
    expect(afterPausedAnswer.phase).toBe('play');
    let ended = spatialGameReducer(state, { type: 'clock-tick', remainingMs: 0 });
    ended = spatialGameReducer(ended, { type: 'answer', answer: 'same' });
    expect(ended.stats.roundsPlayed).toBe(1); // no double count
  });
});

describe('next-round', () => {
  it('regenerates a distinct round and keeps fixed-level params', () => {
    let state = startSession('next');
    const firstTarget = state.target;
    const kind = state.kind;
    state = spatialGameReducer(state, { type: 'answer', answer: kind as 'same' | 'different' });
    state = spatialGameReducer(state, { type: 'next-round', roundStartedElapsedMs: 5_000 });
    expect(state.phase).toBe('play');
    expect(state.roundIndex).toBe(1);
    expect(state.roundStartedElapsedMs).toBe(5_000);
    expect(state.blocks).toBe(4); // fixed levels keep their params
    expect(state.timeBudgetMs).toBe(16_000);
    expect(state.target).not.toEqual(firstTarget);
    expect(state.roundOutcome).toBeNull();
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 4 rounds
    for (let round = 0; round < 4; round += 1) {
      const kind = state.kind;
      state = spatialGameReducer(state, { type: 'answer', answer: kind as 'same' | 'different' });
      state = spatialGameReducer(state, { type: 'next-round', roundStartedElapsedMs: 0 });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
    expect(state.stats.score).toBe(perfectSessionScore(SPATIAL_DIFFICULTY_PARAMS.easy));
  });

  it('escalates adaptive difficulty on a pass and de-escalates on a failure', () => {
    let state = startSession('adaptive', 'adaptive');
    const kind = state.kind;
    state = spatialGameReducer(state, { type: 'answer', answer: kind as 'same' | 'different' });
    state = spatialGameReducer(state, { type: 'next-round', roundStartedElapsedMs: 1_000 });
    expect(state.adaptivePosition).toBe(0.75);
    expect(state.blocks).toBe(paramsForPosition(0.75, ADAPTIVE_PARAMS).blocks);
    expect(state.angleMask).toBe(paramsForPosition(0.75, ADAPTIVE_PARAMS).angleMask);
    expect(state.timeBudgetMs).toBe(paramsForPosition(0.75, ADAPTIVE_PARAMS).timeBudgetMs);

    // Fail the next round: position drops back toward 0.5.
    const kind2 = state.kind;
    state = spatialGameReducer(state, {
      type: 'answer',
      answer: kind2 === 'same' ? 'different' : 'same',
    });
    state = spatialGameReducer(state, { type: 'next-round', roundStartedElapsedMs: 2_000 });
    expect(state.adaptivePosition).toBe(0.5);
    expect(state.blocks).toBe(paramsForPosition(0.5, ADAPTIVE_PARAMS).blocks);
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = spatialGameReducer(createInitialSpatialState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = spatialGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = spatialGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(spatialGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = spatialGameReducer(createInitialSpatialState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(spatialGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = spatialGameReducer(createInitialSpatialState(), {
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
    let state = spatialGameReducer(createInitialSpatialState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = spatialGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(spatialGameReducer(state, { type: 'persistence-succeeded' }).persistState).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = spatialGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.totalAnswers).toBe(5);
    expect(state.stats.correctAnswers).toBe(5);
    expect(state.stats.score).toBe(perfectSessionScore(SPATIAL_DIFFICULTY_PARAMS.normal));
    expect(state.stats.totalRemainingMs).toBe(5 * 16_000);
    expect(state.stats.totalBudgetMs).toBe(5 * 16_000);
  });

  it('force-lose ends the session with the current round failed', () => {
    let state = startSession('qa-lose');
    state = spatialGameReducer(state, { type: 'clock-tick', remainingMs: 12_000 });
    state = spatialGameReducer(state, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.totalAnswers).toBe(1);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.totalRemainingMs).toBe(12_000);
    expect(state.stats.totalBudgetMs).toBe(16_000);
  });

  it('force-timeout ends the session with the current round timed out', () => {
    let state = startSession('qa-timeout');
    state = spatialGameReducer(state, { type: 'clock-tick', remainingMs: 4_000 });
    state = spatialGameReducer(state, { type: 'qa/force-timeout' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.timeouts).toBe(1);
    expect(state.stats.totalAnswers).toBe(0);
    expect(state.stats.totalRemainingMs).toBe(0);
    expect(state.stats.totalBudgetMs).toBe(16_000);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = startSession('qa-lose2');
    const kind = state.kind;
    state = spatialGameReducer(state, { type: 'answer', answer: kind as 'same' | 'different' });
    expect(state.roundOutcome).toBe('passed');
    const result = spatialGameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsPassed).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = spatialGameReducer(createInitialSpatialState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    let results = spatialGameReducer(startSession('q'), { type: 'qa/force-win' });
    const after = spatialGameReducer(results, { type: 'qa/force-timeout' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
    results = spatialGameReducer(after, { type: 'qa/force-lose' });
    expect(results.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = spatialGameReducer(createInitialSpatialState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = spatialGameReducer(createInitialSpatialState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = spatialGameReducer(createInitialSpatialState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = spatialGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
