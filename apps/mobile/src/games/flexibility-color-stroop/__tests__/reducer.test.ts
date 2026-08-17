// Jest globals imported explicitly (repo has no @jest/globals).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { colorStroopGameReducer } from '../reducer';
import { createInitialColorStroopState } from '../types';
import type { ColorStroopGameState } from '../types';
import { generateTrials } from '../generator';
import { COLOR_STROOP_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): ColorStroopGameState {
  let state = createInitialColorStroopState();
  state = colorStroopGameReducer(state, { type: 'select-difficulty', level });
  state = colorStroopGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = colorStroopGameReducer(createInitialColorStroopState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = colorStroopGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens the first trial in the stimulus phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('stimulus');
    expect(state.profile?.level).toBe('normal');
    expect(state.trials).toHaveLength(15);
    expect(state.trialIndex).toBe(0);
    expect(state.currentRule).toBe('ink');
    expect(state.stats).toEqual({
      score: 0,
      trialsPlayed: 0,
      correctTrials: 0,
      bestStreak: 0,
      streak: 0,
      postFlipCorrect: 0,
      totalResponseTimeMs: 0,
      fastestResponseMs: Number.POSITIVE_INFINITY,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same trials for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.trials).toEqual(b.trials);
    expect(a.trials).toEqual(
      generateTrials({
        rng: createRng('det'),
        params: COLOR_STROOP_DIFFICULTY_PARAMS.normal,
      }),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.trials).toHaveLength(25);
    expect(expert.profile?.parameters.trials).toBe(25);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.trials).toHaveLength(15);
  });
});

describe('submit-answer', () => {
  it('validates answers and updates stats', () => {
    let state = startSession('answer-test');
    const trial = state.trials[0];
    const correctAnswer = trial.correctAnswer;

    // Submit correct answer.
    state = colorStroopGameReducer(state, { type: 'submit-answer', answer: correctAnswer, responseTimeMs: 500 });
    expect(state.phase).toBe('feedback');
    expect(state.currentCorrect).toBe(true);
    expect(state.stats.correctTrials).toBe(1);
    expect(state.stats.score).toBeGreaterThan(0);
  });

  it('fails on wrong answer', () => {
    let state = startSession('wrong-answer');
    const trial = state.trials[0];
    const wrongAnswer = trial.correctAnswer === 'red' ? 'blue' : 'red';

    state = colorStroopGameReducer(state, { type: 'submit-answer', answer: wrongAnswer, responseTimeMs: 500 });
    expect(state.phase).toBe('feedback');
    expect(state.currentCorrect).toBe(false);
    expect(state.stats.correctTrials).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('is ignored during feedback / results / intro phases', () => {
    // In feedback phase (after answering).
    let state = startSession('x');
    const trial = state.trials[0];
    state = colorStroopGameReducer(state, { type: 'submit-answer', answer: trial.correctAnswer, responseTimeMs: 500 });
    expect(state.phase).toBe('feedback');
    state = colorStroopGameReducer(state, { type: 'submit-answer', answer: 'red', responseTimeMs: 500 });
    expect(state.phase).toBe('feedback'); // Still in feedback, no double counting.

    // In intro phase.
    state = colorStroopGameReducer(createInitialColorStroopState(), { type: 'submit-answer', answer: 'red', responseTimeMs: 500 });
    expect(state.phase).toBe('intro');
  });
});

describe('next-trial', () => {
  it('advances to the next trial', () => {
    let state = startSession('advance');
    const trial = state.trials[0];

    // Answer correctly.
    state = colorStroopGameReducer(state, { type: 'submit-answer', answer: trial.correctAnswer, responseTimeMs: 500 });
    expect(state.phase).toBe('feedback');

    // Move to next trial.
    state = colorStroopGameReducer(state, { type: 'next-trial' });
    expect(state.phase).toBe('stimulus');
    expect(state.trialIndex).toBe(1);
  });

  it('moves to results after the final trial', () => {
    let state = startSession('final', 'easy'); // 10 trials
    for (let i = 0; i < 10; i += 1) {
      // If we're in flipCue phase (from a rule flip), dismiss it first.
      if (state.phase === 'flipCue') {
        state = colorStroopGameReducer(state, { type: 'dismiss-flip-cue' });
      }
      expect(state.phase).toBe('stimulus');
      const trial = state.trials[state.trialIndex];
      state = colorStroopGameReducer(state, { type: 'submit-answer', answer: trial.correctAnswer, responseTimeMs: 500 });
      expect(state.phase).toBe('feedback');
      state = colorStroopGameReducer(state, { type: 'next-trial' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.trialsPlayed).toBe(10);
    expect(state.stats.correctTrials).toBe(10);
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = colorStroopGameReducer(createInitialColorStroopState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = colorStroopGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = colorStroopGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(colorStroopGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = colorStroopGameReducer(startSession('p'), { type: 'pause' });
    state = colorStroopGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = colorStroopGameReducer(createInitialColorStroopState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(colorStroopGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = colorStroopGameReducer(createInitialColorStroopState(), {
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
    let state = colorStroopGameReducer(createInitialColorStroopState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = colorStroopGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      colorStroopGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = colorStroopGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.trialsPlayed).toBe(15);
    expect(state.stats.correctTrials).toBe(15);
  });

  it('force-lose ends the session with the current trial failed', () => {
    const midSession = startSession('qa-lose');
    const state = colorStroopGameReducer(midSession, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.trialsPlayed).toBe(1);
    expect(state.stats.correctTrials).toBe(0);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = colorStroopGameReducer(createInitialColorStroopState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = colorStroopGameReducer(startSession('q'), { type: 'qa/force-win' });
    const after = colorStroopGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = colorStroopGameReducer(createInitialColorStroopState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = colorStroopGameReducer(createInitialColorStroopState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = colorStroopGameReducer(createInitialColorStroopState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = colorStroopGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});