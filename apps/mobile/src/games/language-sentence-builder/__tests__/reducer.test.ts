// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import { sentenceBuilderReducer } from '../reducer';
import { createInitialState } from '../types';
import type { SentenceBuilderState } from '../types';
import { createRng } from '@/sdk';
import { generateRound } from '../generator';
import { SENTENCE_BANK } from '../content/sentence-bank';
import { DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): SentenceBuilderState {
  let state = createInitialState();
  state = sentenceBuilderReducer(state, { type: 'select-difficulty', level });
  state = sentenceBuilderReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

function solveRound(state: SentenceBuilderState): SentenceBuilderState {
  if (state.scrambled === null) return state;
  let current = state;
  // Tap words in the correct order (original order).
  for (let i = 0; i < state.scrambled.original.length; i += 1) {
    const targetWord = state.scrambled.original[i];
    const scrambledIdx = state.scrambled.scrambled.indexOf(targetWord);
    current = sentenceBuilderReducer(current, { type: 'tap-word', index: scrambledIdx });
  }
  return current;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = sentenceBuilderReducer(createInitialState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = sentenceBuilderReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('opens round 1 in the puzzle phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('puzzle');
    expect(state.profile?.level).toBe('normal');
    expect(state.scrambled).not.toBeNull();
    expect(state.scrambled!.scrambled.length).toBeGreaterThanOrEqual(5);
    expect(state.scrambled!.scrambled.length).toBeLessThanOrEqual(7);
    expect(state.stats.roundsPlayed).toBe(0);
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same scramble for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.scrambled!.scrambled).toEqual(b.scrambled!.scrambled);
    expect(a.scrambled!.category).toBe(b.scrambled!.category);
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.scrambled!.original.length).toBeGreaterThanOrEqual(7);
    expect(expert.scrambled!.original.length).toBeLessThanOrEqual(12);
    const easy = startSession('y', 'easy');
    expect(easy.scrambled!.original.length).toBeGreaterThanOrEqual(4);
    expect(easy.scrambled!.original.length).toBeLessThanOrEqual(5);
  });
});

describe('tap-word', () => {
  it('completes the round on correct taps', () => {
    let state = startSession('tap');
    const solved = solveRound(state);
    expect(solved.phase).toBe('roundResult');
    expect(solved.roundOutcome).toBe('passed');
    expect(solved.stats.roundsPassed).toBe(1);
    expect(solved.stats.roundsPlayed).toBe(1);
    expect(solved.stats.streak).toBe(1);
  });

  it('fails the round on a wrong tap', () => {
    let state = startSession('tap-wrong');
    const scrambled = state.scrambled!;
    // Tap a word that's not the first original word.
    const wrongIdx = scrambled.scrambled.findIndex(
      (w) => w !== scrambled.original[0],
    );
    state = sentenceBuilderReducer(state, { type: 'tap-word', index: wrongIdx });
    // The round completes with failure since it mismatches the expected.
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.stats.roundsPassed).toBe(0);
  });

  it('is ignored during reveal / after the round ended', () => {
    let state = startSession('x');
    state = solveRound(state);
    expect(state.phase).toBe('roundResult');
    state = sentenceBuilderReducer(state, { type: 'tap-word', index: 0 });
    expect(state.stats.roundsPlayed).toBe(1);
  });

  it('awards points for correct solutions', () => {
    const state = solveRound(startSession('pts'));
    expect(state.stats.score).toBeGreaterThan(0);
  });
});

describe('timer-expired', () => {
  it('fails the current round', () => {
    let state = startSession('timer');
    state = sentenceBuilderReducer(state, { type: 'timer-expired' });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.stats.roundsPlayed).toBe(1);
  });

  it('is ignored outside the puzzle phase', () => {
    const state = startSession('timer2');
    const solved = solveRound(state);
    const result = sentenceBuilderReducer(solved, { type: 'timer-expired' });
    expect(result.phase).toBe('roundResult');
  });
});

describe('next-round', () => {
  it('advances to the next puzzle', () => {
    let state = solveRound(startSession('next'));
    state = sentenceBuilderReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('puzzle');
    expect(state.roundIndex).toBe(1);
    expect(state.scrambled).not.toBeNull();
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 4 rounds
    for (let round = 0; round < 4; round += 1) {
      state = solveRound(state);
      state = sentenceBuilderReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = sentenceBuilderReducer(createInitialState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = sentenceBuilderReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = sentenceBuilderReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(sentenceBuilderReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = sentenceBuilderReducer(startSession('p'), { type: 'pause' });
    state = sentenceBuilderReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = sentenceBuilderReducer(createInitialState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(sentenceBuilderReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = sentenceBuilderReducer(createInitialState(), {
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
    let state = sentenceBuilderReducer(createInitialState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = sentenceBuilderReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      sentenceBuilderReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    let state = startSession('qa-win');
    state = solveRound(state);
    state = sentenceBuilderReducer(state, { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.score).toBeGreaterThan(0);
  });

  it('force-lose ends the session with the current round failed', () => {
    const state = sentenceBuilderReducer(startSession('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = solveRound(startSession('qa-lose2'));
    expect(state.roundOutcome).toBe('passed');
    const result = sentenceBuilderReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsPassed).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = sentenceBuilderReducer(createInitialState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    let state = solveRound(startSession('q'));
    const results = sentenceBuilderReducer(state, { type: 'qa/force-win' });
    const after = sentenceBuilderReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = sentenceBuilderReducer(createInitialState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = sentenceBuilderReducer(createInitialState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = sentenceBuilderReducer(createInitialState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = sentenceBuilderReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
