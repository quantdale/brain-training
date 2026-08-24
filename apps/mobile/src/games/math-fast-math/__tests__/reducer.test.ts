// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { mathGameReducer } from '../reducer';
import { createInitialMathState , OPERATORS } from '../types';
import type { MathGameState } from '../types';
import { generateProblem, generateSessionProblems } from '../generator';
import { perfectSessionScore, problemScore } from '../scoring';
import { ADAPTIVE_PARAMS, MATH_DIFFICULTY_PARAMS, adaptiveParamsForStep } from '../difficulty';

const NORMAL = MATH_DIFFICULTY_PARAMS.normal;

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): MathGameState {
  let state = createInitialMathState();
  state = mathGameReducer(state, { type: 'select-difficulty', level });
  state = mathGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

/** Type the correct answer for the current problem and submit it. */
function answerCorrectly(
  state: MathGameState,
  atActiveMs: number,
): MathGameState {
  let current = state;
  for (const digit of String(current.problem?.answer ?? '')) {
    current = mathGameReducer(current, { type: 'digit', digit: Number(digit) });
  }
  return mathGameReducer(current, { type: 'submit-answer', atActiveMs });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = mathGameReducer(createInitialMathState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = mathGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens problem 1 in the problem phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('problem');
    expect(state.profile?.level).toBe('normal');
    expect(state.problem).not.toBeNull();
    expect(state.problemBudgetMs).toBe(8_000);
    expect(state.problemStartActiveMs).toBe(0);
    expect(state.problemElapsedMs).toBe(0);
    expect(state.difficultyStep).toBe(0);
    expect(state.stats).toEqual({
      score: 0,
      problemsPlayed: 0,
      problemsCorrect: 0,
      bestStreak: 0,
      streak: 0,
      fastestMs: null,
      totalCorrectMs: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same problem for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.problem).toEqual(b.problem);
    expect(a.problem).toEqual(
      generateProblem({
        rng: createRng('det'),
        problemIndex: 0,
        params: NORMAL,
        prevProblem: null,
      }),
    );
  });

  it('uses the selected difficulty params', () => {
    const easy = startSession('e', 'easy');
    expect(easy.problemBudgetMs).toBe(10_000);
    expect(['+', '−']).toContain(easy.problem?.operator);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.problemBudgetMs).toBe(8_000);
    expect(['+', '−']).toContain(adaptive.problem?.operator);
  });
});

describe('digit / backspace / clear-input', () => {
  it('appends digits up to the input cap', () => {
    let state = startSession('d');
    for (const digit of [1, 2, 3, 4, 5, 6, 7]) {
      state = mathGameReducer(state, { type: 'digit', digit });
    }
    expect(state.input).toBe('123456'); // capped at 6
  });

  it('ignores non-digit values and input outside the problem phase', () => {
    let state = startSession('d');
    state = mathGameReducer(state, { type: 'digit', digit: 10 });
    expect(state.input).toBe('');
    state = mathGameReducer(state, { type: 'digit', digit: 5 });
    state = mathGameReducer(state, { type: 'submit-answer', atActiveMs: 1_000 });
    expect(state.phase).toBe('feedback');
    const inFeedback = mathGameReducer(state, { type: 'digit', digit: 3 });
    expect(inFeedback.input).toBe('');
  });

  it('ignores digits while paused', () => {
    const paused = mathGameReducer(startSession('d'), { type: 'pause' });
    expect(mathGameReducer(paused, { type: 'digit', digit: 3 }).input).toBe('');
  });

  it('backspaces and clears', () => {
    let state = mathGameReducer(startSession('d'), { type: 'digit', digit: 3 });
    state = mathGameReducer(state, { type: 'digit', digit: 1 });
    state = mathGameReducer(state, { type: 'backspace' });
    expect(state.input).toBe('3');
    state = mathGameReducer(state, { type: 'clear-input' });
    expect(state.input).toBe('');
    expect(mathGameReducer(state, { type: 'backspace' }).input).toBe('');
  });
});

describe('submit-answer', () => {
  it('scores a correct answer with the speed bonus', () => {
    const state = answerCorrectly(startSession('q1'), 1_000);
    expect(state.phase).toBe('feedback');
    expect(state.outcome).toBe('correct');
    expect(state.stats.score).toBe(problemScore(1_000, 8_000)); // 144
    expect(state.stats.problemsPlayed).toBe(1);
    expect(state.stats.problemsCorrect).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.fastestMs).toBe(1_000);
    expect(state.stats.totalCorrectMs).toBe(1_000);
    expect(state.input).toBe('');
    expect(state.enteredAnswer).toBe(String(startSession('q1').problem?.answer));
  });

  it('scores an incorrect answer with zero points and breaks the streak', () => {
    let state = startSession('q2');
    state = mathGameReducer(state, { type: 'digit', digit: 0 }); // never the answer (answers ≥ 1)
    state = mathGameReducer(state, { type: 'submit-answer', atActiveMs: 500 });
    expect(state.phase).toBe('feedback');
    expect(state.outcome).toBe('incorrect');
    expect(state.stats.score).toBe(0);
    expect(state.stats.problemsPlayed).toBe(1);
    expect(state.stats.problemsCorrect).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.enteredAnswer).toBe('0');
  });

  it('scores a submit past the budget as a timeout', () => {
    let state = startSession('q3');
    for (const digit of String(state.problem?.answer ?? '')) {
      state = mathGameReducer(state, { type: 'digit', digit: Number(digit) });
    }
    state = mathGameReducer(state, { type: 'submit-answer', atActiveMs: 8_000 });
    expect(state.phase).toBe('feedback');
    expect(state.outcome).toBe('timeout');
    expect(state.stats.score).toBe(0);
    expect(state.stats.problemsPlayed).toBe(1);
    expect(state.stats.problemsCorrect).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.problemElapsedMs).toBe(8_000);
  });

  it('ignores empty submits', () => {
    const state = mathGameReducer(startSession('q4'), { type: 'submit-answer', atActiveMs: 100 });
    expect(state.phase).toBe('problem');
  });

  it('tracks the fastest correct answer', () => {
    let state = answerCorrectly(startSession('q5'), 1_000);
    state = mathGameReducer(state, { type: 'next-problem', startedAtActiveMs: 1_000 });
    // Second answer is slower (elapsed 2000ms vs 1000ms): fastest stays 1000.
    state = answerCorrectly(state, 3_000);
    expect(state.stats.fastestMs).toBe(1_000);
  });
});

describe('problem-tick', () => {
  it('updates the elapsed time and times out at the budget', () => {
    let state = startSession('t');
    state = mathGameReducer(state, { type: 'problem-tick', atActiveMs: 500 });
    expect(state.problemElapsedMs).toBe(500);
    expect(state.phase).toBe('problem');
    state = mathGameReducer(state, { type: 'problem-tick', atActiveMs: 7_999 });
    expect(state.problemElapsedMs).toBe(7_999);
    state = mathGameReducer(state, { type: 'problem-tick', atActiveMs: 8_000 });
    expect(state.phase).toBe('feedback');
    expect(state.outcome).toBe('timeout');
    expect(state.stats.problemsPlayed).toBe(1);
    expect(state.stats.streak).toBe(0);
  });

  it('is ignored outside the problem phase', () => {
    let state = answerCorrectly(startSession('t3'), 1_000);
    state = mathGameReducer(state, { type: 'problem-tick', atActiveMs: 9_000 });
    expect(state.outcome).toBe('correct');
    expect(state.phase).toBe('feedback');
  });

  it('is ignored while paused', () => {
    const paused = mathGameReducer(startSession('t4'), { type: 'pause' });
    const state = mathGameReducer(paused, { type: 'problem-tick', atActiveMs: 9_000 });
    expect(state.problemElapsedMs).toBe(0);
    expect(state.phase).toBe('problem');
  });
});

describe('next-problem', () => {
  it('advances to the next generated problem with the previous as context', () => {
    let state = answerCorrectly(startSession('escalate'), 1_000);
    state = mathGameReducer(state, { type: 'next-problem', startedAtActiveMs: 1_000 });
    expect(state.phase).toBe('problem');
    expect(state.problemIndex).toBe(1);
    expect(state.prevProblem).toEqual(startSession('escalate').problem);
    expect(state.problem).toEqual(
      generateProblem({
        rng: createRng('escalate'),
        problemIndex: 1,
        params: NORMAL,
        prevProblem: startSession('escalate').problem,
      }),
    );
    expect(state.problemStartActiveMs).toBe(1_000);
    expect(state.problemElapsedMs).toBe(0);
    expect(state.input).toBe('');
    expect(state.enteredAnswer).toBe('');
  });

  it('moves to results after the final problem', () => {
    let state = startSession('final', 'easy'); // 4 rounds
    for (let round = 0; round < 4; round += 1) {
      // Each round is answered with exactly 1000ms of active time.
      const atMs = 1_000 * (round + 1);
      state = answerCorrectly(state, atMs);
      state = mathGameReducer(state, { type: 'next-problem', startedAtActiveMs: atMs });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.problemsPlayed).toBe(4);
    expect(state.stats.problemsCorrect).toBe(4);
    expect(state.stats.score).toBe(4 * problemScore(1_000, 10_000)); // 4 × 145
  });
});

describe('adaptive difficulty stepping', () => {
  it('starts at step 0 and escalates one step per correct answer', () => {
    let state = startSession('ad', 'adaptive');
    expect(state.difficultyStep).toBe(0);
    expect(state.problemBudgetMs).toBe(8_000);
    expect(['+', '−']).toContain(state.problem?.operator);
    state = answerCorrectly(state, 500);
    state = mathGameReducer(state, { type: 'next-problem', startedAtActiveMs: 500 });
    expect(state.difficultyStep).toBe(1);
    expect(state.problemBudgetMs).toBe(7_000); // 8000 − 1000·step
    expect(['+', '−']).toContain(state.problem?.operator);
  });

  it('de-escalates one step per incorrect answer, clamped at the minimum', () => {
    let state = startSession('ad2', 'adaptive');
    state = mathGameReducer(state, { type: 'digit', digit: 0 });
    state = mathGameReducer(state, { type: 'submit-answer', atActiveMs: 500 });
    state = mathGameReducer(state, { type: 'next-problem', startedAtActiveMs: 500 });
    expect(state.difficultyStep).toBe(0);
  });

  it('reaches the full operator mix at the top step', () => {
    let state = startSession('ad3', 'adaptive');
    for (let step = 0; step < 4; step += 1) {
      state = answerCorrectly(state, 500);
      state = mathGameReducer(state, { type: 'next-problem', startedAtActiveMs: 500 });
    }
    expect(state.difficultyStep).toBe(4);
    expect(state.problemBudgetMs).toBe(4_000);
    // Step-4 params: all four operators are allowed, so a ÷ problem may appear.
    expect(state.problem).not.toBeNull();
    const params = adaptiveParamsForStep(ADAPTIVE_PARAMS, 4);
    expect(params.operators).toEqual(OPERATORS);
    expect(state.problem?.left).toBeGreaterThanOrEqual(1);
    expect(state.problem?.answer).toBeGreaterThanOrEqual(0);
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = mathGameReducer(createInitialMathState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = mathGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = mathGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(mathGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = mathGameReducer(startSession('p'), { type: 'pause' });
    state = mathGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = mathGameReducer(createInitialMathState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(mathGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = mathGameReducer(createInitialMathState(), {
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
    let state = mathGameReducer(createInitialMathState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = mathGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      mathGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect instant run', () => {
    const state = mathGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.problemsPlayed).toBe(5);
    expect(state.stats.problemsCorrect).toBe(5);
    expect(state.stats.score).toBe(perfectSessionScore(NORMAL));
    expect(state.stats.bestStreak).toBe(5);
    expect(state.stats.fastestMs).toBe(0);
  });

  it('force-lose ends the session with the current problem failed', () => {
    const state = mathGameReducer(startSession('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.problemsPlayed).toBe(1);
    expect(state.stats.problemsCorrect).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored feedback keeps the recorded outcome', () => {
    const state = answerCorrectly(startSession('qa-lose2'), 1_000);
    const result = mathGameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.problemsPlayed).toBe(1);
    expect(result.stats.problemsCorrect).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = mathGameReducer(createInitialMathState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = mathGameReducer(startSession('q'), { type: 'qa/force-win' });
    const after = mathGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = mathGameReducer(createInitialMathState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = mathGameReducer(createInitialMathState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = mathGameReducer(createInitialMathState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = mathGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});

describe('generated sessions are reproducible from the seed', () => {
  it('a full reducer-played session matches generateSessionProblems', () => {
    const seed = 'repro';
    let state = startSession(seed);
    const expected = generateSessionProblems(createRng(seed), NORMAL);
    expect(state.problem).toEqual(expected[0]);
    for (let index = 1; index < expected.length; index += 1) {
      state = answerCorrectly(state, 1_000);
      state = mathGameReducer(state, { type: 'next-problem', startedAtActiveMs: 1_000 });
      expect(state.problem).toEqual(expected[index]);
    }
  });
});
