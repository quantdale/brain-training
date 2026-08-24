// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { codeCrackerGameReducer } from '../reducer';
import { createInitialCodeCrackerState } from '../types';
import type { CodeCrackerGameState } from '../types';
import { generateSecretCode } from '../generator';
import { perfectSessionScore } from '../scoring';
import { CODE_CRACKER_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): CodeCrackerGameState {
  let state = createInitialCodeCrackerState();
  state = codeCrackerGameReducer(state, { type: 'select-difficulty', level });
  state = codeCrackerGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

/** Advance from roundReveal to input phase. */
function startInput(state: CodeCrackerGameState): CodeCrackerGameState {
  return codeCrackerGameReducer(state, { type: 'reveal-code' });
}

/** Submit a guess that matches the secret code (perfect solve). */
function submitCorrectGuess(state: CodeCrackerGameState): CodeCrackerGameState {
  let current = startInput(state);
  for (const color of current.secretCode) {
    current = codeCrackerGameReducer(current, { type: 'select-color', colorIndex: color });
  }
  return codeCrackerGameReducer(current, { type: 'submit-guess' });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = codeCrackerGameReducer(createInitialCodeCrackerState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = codeCrackerGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the roundReveal phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('roundReveal');
    expect(state.profile?.level).toBe('normal');
    expect(state.secretCode).toHaveLength(4);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsSolved: 0,
      totalGuessesUsed: 0,
      totalGuessesBudget: 0,
      bestStreak: 0,
      streak: 0,
      bestSolveGuesses: Number.POSITIVE_INFINITY,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same code for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.secretCode).toEqual(b.secretCode);
    expect(a.secretCode).toEqual(
      generateSecretCode({
        rng: createRng('det'),
        roundIndex: 0,
        codeLength: 4,
        colorCount: 6,
        prevSecretCode: null,
      }),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.secretCode).toHaveLength(5);
    expect(expert.profile?.parameters.colorCount).toBe(8);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.secretCode).toHaveLength(4);
  });
});

describe('reveal-code', () => {
  it('transitions from roundReveal to input', () => {
    const state = startSession('r');
    expect(state.phase).toBe('roundReveal');
    const input = codeCrackerGameReducer(state, { type: 'reveal-code' });
    expect(input.phase).toBe('input');
  });

  it('is ignored outside roundReveal phase or while paused', () => {
    const inInput = startInput(startSession('r'));
    expect(codeCrackerGameReducer(inInput, { type: 'reveal-code' }).phase).toBe('input');
    const paused = codeCrackerGameReducer(startSession('r'), { type: 'pause' });
    expect(codeCrackerGameReducer(paused, { type: 'reveal-code' }).phase).toBe('roundReveal');
  });
});

describe('select-color / clear-current-guess', () => {
  it('adds colors to the current guess', () => {
    let state = startInput(startSession('c'));
    state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: 2 });
    expect(state.currentGuess).toEqual([2]);
    state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: 5 });
    expect(state.currentGuess).toEqual([2, 5]);
  });

  it('does not exceed the code length', () => {
    let state = startInput(startSession('c', 'easy')); // codeLength: 3
    state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: 0 });
    state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: 1 });
    state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: 2 });
    state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: 3 }); // should be ignored
    expect(state.currentGuess).toHaveLength(3);
  });

  it('clear-current-guess resets the guess', () => {
    let state = startInput(startSession('c'));
    state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: 0 });
    state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: 1 });
    state = codeCrackerGameReducer(state, { type: 'clear-current-guess' });
    expect(state.currentGuess).toEqual([]);
  });

  it('select-color is ignored outside input phase or while paused', () => {
    const inReveal = startSession('c');
    const result = codeCrackerGameReducer(inReveal, { type: 'select-color', colorIndex: 0 });
    expect(result.currentGuess).toEqual([]);
  });
});

describe('submit-guess', () => {
  it('validates the guess against the secret code', () => {
    let state = startInput(startSession('g'));
    // Build a wrong guess (different from secret)
    const wrongColor = (state.secretCode[0] + 1) % 6;
    for (let i = 0; i < 4; i += 1) {
      state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: wrongColor });
    }
    state = codeCrackerGameReducer(state, { type: 'submit-guess' });
    expect(state.roundGuesses).toHaveLength(1);
    expect(state.guessesUsed).toBe(1);
    expect(state.roundSolved).toBe(false);
    expect(state.roundGuesses[0].feedback.exact).toBeLessThan(4);
  });

  it('solves the round when all pegs are exact', () => {
    let state = startInput(startSession('solve'));
    for (const color of state.secretCode) {
      state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: color });
    }
    state = codeCrackerGameReducer(state, { type: 'submit-guess' });
    expect(state.phase).toBe('roundResult');
    expect(state.roundSolved).toBe(true);
    expect(state.roundOutcome).toBe('solved');
    expect(state.stats.roundsSolved).toBe(1);
    expect(state.stats.streak).toBe(1);
  });

  it('fails the round when budget is exhausted', () => {
    let state = startInput(startSession('exhaust', 'easy')); // guessBudget: 10, codeLength: 3
    // Use all guesses with wrong guesses.
    for (let g = 0; g < 10; g += 1) {
      const wrongColor = (state.secretCode[0] + 1) % 4;
      for (let i = 0; i < 3; i += 1) {
        state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: wrongColor });
      }
      state = codeCrackerGameReducer(state, { type: 'submit-guess' });
    }
    expect(state.phase).toBe('roundResult');
    expect(state.roundSolved).toBe(false);
    expect(state.roundOutcome).toBe('budget-exhausted');
    expect(state.stats.streak).toBe(0);
  });

  it('ignores submit with incomplete guess', () => {
    let state = startInput(startSession('incomplete'));
    state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: 0 });
    const before = { ...state };
    state = codeCrackerGameReducer(state, { type: 'submit-guess' });
    expect(state.roundGuesses).toEqual(before.roundGuesses);
  });

  it('clears current guess after a successful submit', () => {
    let state = startInput(startSession('clear'));
    for (const color of state.secretCode) {
      state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: color });
    }
    state = codeCrackerGameReducer(state, { type: 'submit-guess' });
    expect(state.currentGuess).toEqual([]);
  });
});

describe('next-round', () => {
  it('advances to the next round after solving', () => {
    let state = startSession('next-solve');
    state = submitCorrectGuess(state);
    state = codeCrackerGameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('roundReveal');
    expect(state.roundIndex).toBe(1);
    expect(state.secretCode).toHaveLength(4);
    expect(state.guessesUsed).toBe(0);
  });

  it('holds code length after a failure on fixed difficulty', () => {
    let state = startSession('next-fail');
    // Submit a wrong guess
    state = startInput(state);
    const wrongColor = (state.secretCode[0] + 1) % 6;
    for (let i = 0; i < 4; i += 1) {
      state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: wrongColor });
    }
    state = codeCrackerGameReducer(state, { type: 'submit-guess' });
    // Exhaust remaining guesses
    for (let g = 0; g < 9; g += 1) {
      state = startInput(state);
      for (let i = 0; i < 4; i += 1) {
        state = codeCrackerGameReducer(state, { type: 'select-color', colorIndex: wrongColor });
      }
      state = codeCrackerGameReducer(state, { type: 'submit-guess' });
    }
    state = codeCrackerGameReducer(state, { type: 'next-round' });
    expect(state.roundIndex).toBe(1);
    expect(state.secretCode).toHaveLength(4); // Fixed level keeps code length constant
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 3 rounds
    for (let round = 0; round < 3; round += 1) {
      state = submitCorrectGuess(state);
      state = codeCrackerGameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(3);
    expect(state.stats.roundsSolved).toBe(3);
    expect(state.stats.score).toBe(perfectSessionScore(CODE_CRACKER_DIFFICULTY_PARAMS.easy));
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = codeCrackerGameReducer(createInitialCodeCrackerState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = codeCrackerGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = codeCrackerGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(codeCrackerGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = codeCrackerGameReducer(startSession('p'), { type: 'pause' });
    state = codeCrackerGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = codeCrackerGameReducer(createInitialCodeCrackerState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(codeCrackerGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = codeCrackerGameReducer(createInitialCodeCrackerState(), {
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
    let state = codeCrackerGameReducer(createInitialCodeCrackerState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = codeCrackerGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      codeCrackerGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = codeCrackerGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsSolved).toBe(4);
    expect(state.stats.score).toBe(perfectSessionScore(CODE_CRACKER_DIFFICULTY_PARAMS.normal));
  });

  it('force-lose ends the session with the current round failed', () => {
    const midReveal = startSession('qa-lose');
    const state = codeCrackerGameReducer(midReveal, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsSolved).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = codeCrackerGameReducer(createInitialCodeCrackerState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = codeCrackerGameReducer(startSession('q'), { type: 'qa/force-win' });
    const after = codeCrackerGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = codeCrackerGameReducer(createInitialCodeCrackerState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = codeCrackerGameReducer(createInitialCodeCrackerState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = codeCrackerGameReducer(createInitialCodeCrackerState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = codeCrackerGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
