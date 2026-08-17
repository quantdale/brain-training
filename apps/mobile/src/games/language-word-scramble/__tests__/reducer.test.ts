// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { wordScrambleGameReducer } from '../reducer';
import { createInitialWordScrambleState } from '../types';
import type { WordScrambleGameState } from '../types';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): WordScrambleGameState {
  let state = createInitialWordScrambleState();
  state = wordScrambleGameReducer(state, { type: 'select-difficulty', level });
  state = wordScrambleGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

function submitCorrect(state: WordScrambleGameState): WordScrambleGameState {
  if (state.currentRound === null) return state;
  let s = wordScrambleGameReducer(state, {
    type: 'select-option',
    index: state.currentRound.correctIndex,
  });
  s = wordScrambleGameReducer(s, { type: 'submit-answer' });
  return s;
}

function submitWrong(state: WordScrambleGameState): WordScrambleGameState {
  if (state.currentRound === null) return state;
  const wrongIndex = (state.currentRound.correctIndex + 1) % state.currentRound.options.length;
  let s = wordScrambleGameReducer(state, { type: 'select-option', index: wrongIndex });
  s = wordScrambleGameReducer(s, { type: 'submit-answer' });
  return s;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = wordScrambleGameReducer(createInitialWordScrambleState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = wordScrambleGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the play phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('play');
    expect(state.profile?.level).toBe('normal');
    expect(state.currentRound).not.toBeNull();
    expect(state.currentRound!.options).toHaveLength(4);
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same round for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.currentRound).toEqual(b.currentRound);
  });

  it('uses the selected difficulty params', () => {
    const easy = startSession('e', 'easy');
    expect(easy.currentRound!.options).toHaveLength(3);
    const expert = startSession('x', 'expert');
    expect(expert.currentRound!.options).toHaveLength(5);
  });
});

describe('select-option', () => {
  it('selects an option in the play phase', () => {
    let state = startSession('opt');
    state = wordScrambleGameReducer(state, { type: 'select-option', index: 2 });
    expect(state.selectedIndex).toBe(2);
  });

  it('ignores selection outside play phase', () => {
    const state = createInitialWordScrambleState();
    const result = wordScrambleGameReducer(state, { type: 'select-option', index: 0 });
    expect(result.selectedIndex).toBe(-1);
  });

  it('ignores selection while paused', () => {
    let state = startSession('pause-opt');
    state = wordScrambleGameReducer(state, { type: 'pause' });
    const result = wordScrambleGameReducer(state, { type: 'select-option', index: 0 });
    expect(result.selectedIndex).toBe(-1);
  });
});

describe('submit-answer', () => {
  it('passes the round when the correct option is selected', () => {
    let state = startSession('submit-c');
    state = submitCorrect(state);
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.score).toBeGreaterThan(0);
  });

  it('fails the round when a wrong option is selected', () => {
    let state = startSession('submit-w');
    state = submitWrong(state);
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('is ignored if no option is selected', () => {
    const state = startSession('submit-none');
    const result = wordScrambleGameReducer(state, { type: 'submit-answer' });
    expect(result.phase).toBe('play');
  });

  it('is ignored during roundResult', () => {
    let state = startSession('submit-after');
    state = submitCorrect(state);
    const result = wordScrambleGameReducer(state, { type: 'submit-answer' });
    expect(result.phase).toBe('roundResult');
  });
});

describe('next-round', () => {
  it('advances to the next round after a pass', () => {
    let state = startSession('next-p');
    state = submitCorrect(state);
    state = wordScrambleGameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('play');
    expect(state.roundIndex).toBe(1);
    expect(state.currentRound).not.toBeNull();
  });

  it('moves to results after the final round', () => {
    let state = startSession('next-final', 'easy'); // 4 rounds
    for (let round = 0; round < 4; round += 1) {
      state = submitCorrect(state);
      state = wordScrambleGameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
  });

  it('next-round is ignored outside roundResult', () => {
    const state = startSession('next-early');
    const result = wordScrambleGameReducer(state, { type: 'next-round' });
    expect(result.phase).toBe('play');
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = wordScrambleGameReducer(createInitialWordScrambleState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = wordScrambleGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = wordScrambleGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(wordScrambleGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = wordScrambleGameReducer(startSession('p'), { type: 'pause' });
    state = wordScrambleGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = wordScrambleGameReducer(createInitialWordScrambleState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(wordScrambleGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = wordScrambleGameReducer(createInitialWordScrambleState(), {
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
    let state = wordScrambleGameReducer(createInitialWordScrambleState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = wordScrambleGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      wordScrambleGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    let state = startSession('qa-win');
    state = submitCorrect(state);
    state = wordScrambleGameReducer(state, { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(5); // normal rounds
    expect(state.stats.roundsPassed).toBe(5);
  });

  it('force-lose ends the session with the current round failed', () => {
    const midPlay = startSession('qa-lose');
    const state = wordScrambleGameReducer(midPlay, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = wordScrambleGameReducer(createInitialWordScrambleState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    let state = startSession('q');
    state = submitCorrect(state);
    const results = wordScrambleGameReducer(state, { type: 'qa/force-win' });
    const after = wordScrambleGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = wordScrambleGameReducer(createInitialWordScrambleState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = wordScrambleGameReducer(createInitialWordScrambleState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = wordScrambleGameReducer(createInitialWordScrambleState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = wordScrambleGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
