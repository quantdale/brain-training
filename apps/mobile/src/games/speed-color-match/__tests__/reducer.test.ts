// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { speedColorMatchReducer } from '../reducer';
import { createInitialSpeedColorMatchState } from '../types';
import type { SpeedColorMatchGameState } from '../types';
import { generateTrials } from '../generator';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): SpeedColorMatchGameState {
  let state = createInitialSpeedColorMatchState();
  state = speedColorMatchReducer(state, { type: 'select-difficulty', level });
  state = speedColorMatchReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = speedColorMatchReducer(createInitialSpeedColorMatchState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = speedColorMatchReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens the first trial', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('trial');
    expect(state.profile?.level).toBe('normal');
    expect(state.trials).toHaveLength(20);
    expect(state.trialIndex).toBe(0);
    expect(state.stats).toEqual({
      score: 0,
      trialsPlayed: 0,
      trialsCorrect: 0,
      bestStreak: 0,
      streak: 0,
      avgReactionMs: 0,
      fastestReactionMs: Infinity,
      slowestReactionMs: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same trials for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.trials).toEqual(b.trials);
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.trials).toHaveLength(30);
    const easy = startSession('a', 'easy');
    expect(easy.trials).toHaveLength(15);
  });
});

describe('trial-shown', () => {
  it('records the shown timestamp', () => {
    const state = startSession('shown');
    const updated = speedColorMatchReducer(state, { type: 'trial-shown', shownAtMs: 1000 });
    expect(updated.trialShownAtMs).toBe(1000);
  });

  it('is ignored outside the trial phase or while paused', () => {
    const paused = speedColorMatchReducer(startSession('p'), { type: 'pause' });
    const updated = speedColorMatchReducer(paused, { type: 'trial-shown', shownAtMs: 1000 });
    expect(updated.trialShownAtMs).toBeNull();
  });
});

describe('tap-color', () => {
  it('marks correct when tapped color matches swatch', () => {
    let state = startSession('tap', 'easy');
    state = speedColorMatchReducer(state, { type: 'trial-shown', shownAtMs: 1000 });
    const trial = state.trials[0];
    const updated = speedColorMatchReducer(state, {
      type: 'tap-color',
      color: trial.swatchColor,
      tappedAtMs: 1200,
    });
    expect(updated.phase).toBe('roundResult');
    expect(updated.currentTrialOutcome).toBe('correct');
    expect(updated.currentReactionMs).toBe(200);
    expect(updated.stats.trialsCorrect).toBe(1);
    expect(updated.stats.score).toBeGreaterThan(0);
  });

  it('marks wrong when tapped color does not match swatch', () => {
    let state = startSession('tap-wrong');
    state = speedColorMatchReducer(state, { type: 'trial-shown', shownAtMs: 1000 });
    const trial = state.trials[0];
    const wrongColor = trial.swatchColor === 'red' ? 'blue' : 'red';
    const updated = speedColorMatchReducer(state, {
      type: 'tap-color',
      color: wrongColor,
      tappedAtMs: 1500,
    });
    expect(updated.phase).toBe('roundResult');
    expect(updated.currentTrialOutcome).toBe('timeout');
    expect(updated.stats.trialsPlayed).toBe(1);
    expect(updated.stats.trialsCorrect).toBe(0);
    expect(updated.stats.streak).toBe(0);
  });

  it('is ignored during roundResult / after the round ended', () => {
    let state = startSession('x');
    state = speedColorMatchReducer(state, { type: 'trial-shown', shownAtMs: 1000 });
    const trial = state.trials[0];
    state = speedColorMatchReducer(state, {
      type: 'tap-color',
      color: trial.swatchColor,
      tappedAtMs: 1100,
    });
    expect(state.phase).toBe('roundResult');
    // Further taps should be ignored.
    const after = speedColorMatchReducer(state, {
      type: 'tap-color',
      color: 'red',
      tappedAtMs: 2000,
    });
    expect(after.stats.trialsPlayed).toBe(1);
  });
});

describe('trial-timeout', () => {
  it('marks the trial as timed out', () => {
    const state = startSession('timeout');
    const updated = speedColorMatchReducer(state, { type: 'trial-timeout', timedOutAtMs: 5000 });
    expect(updated.phase).toBe('roundResult');
    expect(updated.currentTrialOutcome).toBe('timeout');
    expect(updated.stats.trialsPlayed).toBe(1);
    expect(updated.stats.streak).toBe(0);
  });
});

describe('next-trial', () => {
  it('advances to the next trial', () => {
    let state = startSession('next');
    state = speedColorMatchReducer(state, { type: 'trial-shown', shownAtMs: 1000 });
    const trial = state.trials[0];
    state = speedColorMatchReducer(state, {
      type: 'tap-color',
      color: trial.swatchColor,
      tappedAtMs: 1200,
    });
    expect(state.phase).toBe('roundResult');
    state = speedColorMatchReducer(state, { type: 'next-trial' });
    expect(state.phase).toBe('trial');
    expect(state.trialIndex).toBe(1);
    expect(state.trialShownAtMs).toBeNull();
  });

  it('moves to results after the final trial', () => {
    let state = startSession('final', 'easy'); // 15 trials
    for (let trial = 0; trial < 15; trial += 1) {
      state = speedColorMatchReducer(state, { type: 'trial-shown', shownAtMs: 1000 });
      const t = state.trials[state.trialIndex];
      state = speedColorMatchReducer(state, {
        type: 'tap-color',
        color: t.swatchColor,
        tappedAtMs: 1100,
      });
      state = speedColorMatchReducer(state, { type: 'next-trial' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.trialsPlayed).toBe(15);
    expect(state.stats.trialsCorrect).toBe(15);
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = speedColorMatchReducer(createInitialSpeedColorMatchState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = speedColorMatchReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = speedColorMatchReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(speedColorMatchReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = speedColorMatchReducer(startSession('p'), { type: 'pause' });
    state = speedColorMatchReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = speedColorMatchReducer(createInitialSpeedColorMatchState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(speedColorMatchReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = speedColorMatchReducer(createInitialSpeedColorMatchState(), {
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
    let state = speedColorMatchReducer(createInitialSpeedColorMatchState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = speedColorMatchReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      speedColorMatchReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    let state = startSession('qa-win');
    state = speedColorMatchReducer(state, { type: 'trial-shown', shownAtMs: 1000 });
    const finalState = speedColorMatchReducer(state, { type: 'qa/force-win' });
    expect(finalState.phase).toBe('results');
    expect(finalState.forced).toBe(true);
    expect(finalState.stats.trialsPlayed).toBe(20);
    expect(finalState.stats.trialsCorrect).toBe(20);
  });

  it('force-lose ends the session with the current trial failed', () => {
    const midTrial = startSession('qa-lose');
    const state = speedColorMatchReducer(midTrial, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.trialsPlayed).toBe(1);
    expect(state.stats.trialsCorrect).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored roundResult keeps the recorded outcome', () => {
    let state = startSession('qa-lose2');
    state = speedColorMatchReducer(state, { type: 'trial-shown', shownAtMs: 1000 });
    const trial = state.trials[0];
    state = speedColorMatchReducer(state, {
      type: 'tap-color',
      color: trial.swatchColor,
      tappedAtMs: 1100,
    });
    expect(state.currentTrialOutcome).toBe('correct');
    const result = speedColorMatchReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.trialsPlayed).toBe(1);
    expect(result.stats.trialsCorrect).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = speedColorMatchReducer(createInitialSpeedColorMatchState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    let state = startSession('q');
    state = speedColorMatchReducer(state, { type: 'trial-shown', shownAtMs: 1000 });
    const result = speedColorMatchReducer(state, { type: 'qa/force-win' });
    const after = speedColorMatchReducer(result, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = speedColorMatchReducer(createInitialSpeedColorMatchState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = speedColorMatchReducer(createInitialSpeedColorMatchState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = speedColorMatchReducer(createInitialSpeedColorMatchState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = speedColorMatchReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
