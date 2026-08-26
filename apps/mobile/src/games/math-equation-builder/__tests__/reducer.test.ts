// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import { isValidEquationStructure, mathEquationBuilderGameReducer } from '../reducer';
import { createInitialMathEquationBuilderState } from '../types';
import type { MathEquationBuilderGameState } from '../types';
import { MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): MathEquationBuilderGameState {
  let state = createInitialMathEquationBuilderState();
  state = mathEquationBuilderGameReducer(state, { type: 'select-difficulty', level });
  state = mathEquationBuilderGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
  });
  return state;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = mathEquationBuilderGameReducer(
      createInitialMathEquationBuilderState(),
      { type: 'select-difficulty', level: 'hard' },
    );
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = mathEquationBuilderGameReducer(
      startSession('x'),
      { type: 'select-difficulty', level: 'easy' },
    );
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens the playing phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('playing');
    expect(state.profile?.level).toBe('normal');
    expect(state.availableNumbers.length).toBe(4);
    expect(state.allowedOperators).toContain('+');
    expect(state.allowedOperators).toContain('-');
    expect(state.allowedOperators).toContain('×');
    expect(state.timeRemainingMs).toBe(50_000);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsPassed: 0,
      bestStreak: 0,
      streak: 0,
      totalTimeBonus: 0,
      puzzlesSolvedFirstTry: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same puzzle for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.target).toBe(b.target);
    expect(a.availableNumbers).toEqual(b.availableNumbers);
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.availableNumbers.length).toBe(5);
    expect(expert.timeBudgetMs).toBe(40_000);
    const easy = startSession('a', 'easy');
    expect(easy.availableNumbers.length).toBe(3);
    expect(easy.timeBudgetMs).toBe(60_000);
  });
});

describe('isValidEquationStructure', () => {
  it('accepts a minimal valid equation', () => {
    expect(isValidEquationStructure([3, '+', 5], 2, 2)).toBe(true);
  });

  it('accepts longer alternating equations, with or without grouping', () => {
    expect(isValidEquationStructure([10, '-', 2, '÷', 4, '+', 6], 4, 4)).toBe(true);
    expect(isValidEquationStructure(['(', 3, '+', 5, ')', '×', 2], 3, 3)).toBe(true);
    expect(
      isValidEquationStructure(['(', '(', 7, '+', 8, ')', '×', 2, ')', '-', 4], 3, 3),
    ).toBe(true);
  });

  it('rejects a number where an operator is expected (campaign 014 regression)', () => {
    // The old validator returned TRUE for both of these: its odd-index check
    // inverted the condition and accepted any non-number as an operator.
    expect(isValidEquationStructure([3, 5, '+'], 2, 2)).toBe(false);
    expect(isValidEquationStructure([12, 5, '-', 3, '+'], 3, 3)).toBe(false);
  });

  it('rejects an operator where a number is expected', () => {
    expect(isValidEquationStructure(['+', 3, 5], 2, 2)).toBe(false);
    expect(isValidEquationStructure([3, '+', '×', 5], 2, 2)).toBe(false);
  });

  it('rejects even-length or too-short flattened token streams', () => {
    expect(isValidEquationStructure([3, '+', 5, '-'], 2, 2)).toBe(false); // even
    expect(isValidEquationStructure([7], 1, 1)).toBe(false); // < 3 tokens
  });

  it('rejects empty input and used-count mismatches', () => {
    expect(isValidEquationStructure([], 0, 0)).toBe(false);
    expect(isValidEquationStructure([3, '+', 5], 1, 2)).toBe(false);
  });
});

describe('add-number / add-operator', () => {
  it('adds numbers and operators in alternating order', () => {
    let state = startSession('build');
    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 0 });
    expect(state.equationTokens).toHaveLength(1);
    expect(state.usedNumberIndices).toEqual([0]);
    expect(state.expectOperator).toBe(true);

    state = mathEquationBuilderGameReducer(state, {
      type: 'add-operator',
      operator: '+',
    });
    expect(state.equationTokens).toHaveLength(2);
    expect(state.expectOperator).toBe(false);

    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 1 });
    expect(state.equationTokens).toHaveLength(3);
    expect(state.usedNumberIndices).toEqual([0, 1]);
  });

  it('prevents duplicate number usage', () => {
    let state = startSession('dup');
    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 0 });
    const before = state.equationTokens.length;
    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 0 });
    expect(state.equationTokens.length).toBe(before); // no change
  });

  it('prevents operator when number is expected', () => {
    const state = startSession('op-first');
    const before = state.equationTokens.length;
    const after = mathEquationBuilderGameReducer(state, {
      type: 'add-operator',
      operator: '+',
    });
    expect(after.equationTokens.length).toBe(before); // no change
  });

  it('ignores actions during pause', () => {
    let state = startSession('paused');
    state = mathEquationBuilderGameReducer(state, { type: 'pause' });
    const before = state.equationTokens.length;
    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 0 });
    expect(state.equationTokens.length).toBe(before);
  });
});

describe('undo / clear', () => {
  it('undo removes the last token', () => {
    let state = startSession('undo-test');
    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 0 });
    state = mathEquationBuilderGameReducer(state, {
      type: 'add-operator',
      operator: '+',
    });
    expect(state.equationTokens).toHaveLength(2);
    state = mathEquationBuilderGameReducer(state, { type: 'undo' });
    expect(state.equationTokens).toHaveLength(1);
    // The equation ends with a number again, so an operator comes next.
    expect(state.expectOperator).toBe(true);
  });

  it('undo of a trailing operator restores operator mode (regression)', () => {
    let state = startSession('undo-op');
    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 0 });
    state = mathEquationBuilderGameReducer(state, {
      type: 'add-operator',
      operator: '+',
    });
    state = mathEquationBuilderGameReducer(state, { type: 'undo' });

    // The removed operator can be re-entered; a second number in a row cannot.
    const reAdded = mathEquationBuilderGameReducer(state, {
      type: 'add-operator',
      operator: '+',
    });
    expect(reAdded.equationTokens).toHaveLength(2);
    const blockedNumber = mathEquationBuilderGameReducer(state, {
      type: 'add-number',
      numberIndex: 1,
    });
    expect(blockedNumber.equationTokens).toHaveLength(1);
  });

  it('undo of a closing paren expects an operator again', () => {
    let state = startSession('undo-paren');
    for (const i of [0, 1]) {
      state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: i });
      if (i === 0) {
        state = mathEquationBuilderGameReducer(state, { type: 'add-operator', operator: '+' });
      }
    }
    state = mathEquationBuilderGameReducer(state, { type: 'group' });
    expect(state.equationTokens).toContain(')');
    state = mathEquationBuilderGameReducer(state, { type: 'undo' });
    expect(state.equationTokens).not.toContain(')');
    expect(state.expectOperator).toBe(true);
  });

  it('undo back to empty expects a number', () => {
    let state = startSession('undo-empty');
    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 0 });
    state = mathEquationBuilderGameReducer(state, { type: 'undo' });
    expect(state.equationTokens).toHaveLength(0);
    expect(state.usedNumberIndices).toHaveLength(0);
    expect(state.expectOperator).toBe(false);
  });

  it('clear resets the equation', () => {
    let state = startSession('clear-test');
    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 0 });
    state = mathEquationBuilderGameReducer(state, {
      type: 'add-operator',
      operator: '+',
    });
    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 1 });
    state = mathEquationBuilderGameReducer(state, { type: 'clear' });
    expect(state.equationTokens).toHaveLength(0);
    expect(state.usedNumberIndices).toHaveLength(0);
    expect(state.expectOperator).toBe(false);
  });
});

describe('submit', () => {
  it('requires all numbers to be used', () => {
    let state = startSession('submit-partial');
    state = mathEquationBuilderGameReducer(state, { type: 'add-number', numberIndex: 0 });
    const before = state.phase;
    state = mathEquationBuilderGameReducer(state, { type: 'submit' });
    expect(state.phase).toBe(before); // no change
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = mathEquationBuilderGameReducer(
      createInitialMathEquationBuilderState(),
      { type: 'pause' },
    );
    expect(inIntro.paused).toBe(false);
    let state = mathEquationBuilderGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = mathEquationBuilderGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(mathEquationBuilderGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = mathEquationBuilderGameReducer(startSession('p'), { type: 'pause' });
    state = mathEquationBuilderGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = mathEquationBuilderGameReducer(
      createInitialMathEquationBuilderState(),
      { type: 'tutorial-open' },
    );
    expect(opened.tutorialOpen).toBe(true);
    expect(
      mathEquationBuilderGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen,
    ).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = mathEquationBuilderGameReducer(createInitialMathEquationBuilderState(), {
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
    let state = mathEquationBuilderGameReducer(
      createInitialMathEquationBuilderState(),
      { type: 'persistence-started' },
    );
    expect(state.persistState).toBe('started');
    state = mathEquationBuilderGameReducer(state, {
      type: 'persistence-failed',
      message: 'boom',
    });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      mathEquationBuilderGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = mathEquationBuilderGameReducer(
      startSession('qa-win'),
      { type: 'qa/force-win' },
    );
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.score).toBe(perfectSessionScore(MATH_EQUATION_BUILDER_DIFFICULTY_PARAMS.normal));
  });

  it('force-lose ends the session with the current round failed', () => {
    const midPlay = startSession('qa-lose');
    const state = mathEquationBuilderGameReducer(midPlay, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = mathEquationBuilderGameReducer(
      createInitialMathEquationBuilderState(),
      { type: 'qa/force-win' },
    );
    expect(intro.phase).toBe('intro');
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = mathEquationBuilderGameReducer(createInitialMathEquationBuilderState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = mathEquationBuilderGameReducer(createInitialMathEquationBuilderState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = mathEquationBuilderGameReducer(createInitialMathEquationBuilderState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = mathEquationBuilderGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});

/** Helper to import from scoring */
function perfectSessionScore(params: { rounds: number }): number {
  return params.rounds * (200 + 100);
}
