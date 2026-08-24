// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { generateBoard } from '../generator';
import { oddOneOutReducer } from '../reducer';
import { perfectSessionScore } from '../scoring';
import {
  ODD_ONE_OUT_DIFFICULTY_PARAMS,
  effectiveParamsForStep,
  escalateStep,
} from '../difficulty';
import { createInitialOddOneOutState } from '../types';
import type { OddOneOutBoard, OddOneOutGameState } from '../types';

const NOW = 1_000;

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
  nowMs = NOW,
): OddOneOutGameState {
  let state = createInitialOddOneOutState();
  state = oddOneOutReducer(state, { type: 'select-difficulty', level });
  state = oddOneOutReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
    nowMs,
  });
  return state;
}

/** Expected board of the current round, replicated from the reducer's own logic. */
function expectedBoard(state: OddOneOutGameState, seed: string): OddOneOutBoard {
  return generateBoard({
    rng: createRng(seed),
    roundIndex: state.roundIndex,
    subtlety: state.subtlety,
    gridSize: state.gridSize,
    prevBoard: state.prevBoard,
  });
}

/** Tap the correct odd item of the current round. */
function passRound(
  state: OddOneOutGameState,
  seed: string,
  nowMs = NOW,
): OddOneOutGameState {
  return oddOneOutReducer(state, {
    type: 'tap-tile',
    index: expectedBoard(state, seed).oddIndex,
    nowMs,
  });
}

/** Tap a deliberately wrong tile (the first wrong item that is not the odd one). */
function wrongRound(state: OddOneOutGameState, seed: string, nowMs = NOW): OddOneOutGameState {
  const board = expectedBoard(state, seed);
  const wrongIndex = (board.oddIndex + 1) % state.gridSize;
  return oddOneOutReducer(state, { type: 'tap-tile', index: wrongIndex, nowMs });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = oddOneOutReducer(createInitialOddOneOutState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = oddOneOutReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the playing phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('playing');
    expect(state.profile?.level).toBe('normal');
    expect(state.roundIndex).toBe(0);
    expect(state.step).toBe(0);
    expect(state.gridSize).toBe(9);
    expect(state.subtlety).toBe(0);
    expect(state.windowMs).toBe(12_000);
    expect(state.deadlineMs).toBe(NOW + 12_000);
    expect(state.roundStartedAtMs).toBe(NOW);
    expect(state.remainingMs).toBe(12_000);
    expect(state.board).not.toBeNull();
    expect(state.board!.oddIndex).toBeGreaterThanOrEqual(0);
    expect(state.board!.oddIndex).toBeLessThan(9);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsPassed: 0,
      firstTryCorrect: 0,
      wrongTaps: 0,
      timeouts: 0,
      bestStreak: 0,
      streak: 0,
      solveRatioSum: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same board for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.board).toEqual(b.board);
    expect(a.board).toEqual(expectedBoard(a, 'det'));
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.gridSize).toBe(16);
    expect(expert.subtlety).toBe(2);
    expect(expert.windowMs).toBe(8_000);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.step).toBe(0);
    expect(adaptive.subtlety).toBe(0);
    expect(adaptive.windowMs).toBe(12_000);
  });
});

describe('tick', () => {
  it('refreshes the displayed remainder in the playing phase', () => {
    const state = oddOneOutReducer(startSession('r'), { type: 'tick', remainingMs: 10_500 });
    expect(state.remainingMs).toBe(10_500);
    expect(oddOneOutReducer(state, { type: 'tick', remainingMs: -4 }).remainingMs).toBe(0);
  });

  it('is ignored outside the playing phase or while paused', () => {
    const paused = oddOneOutReducer(startSession('r'), { type: 'pause', remainingMs: 5_000 });
    expect(oddOneOutReducer(paused, { type: 'tick', remainingMs: 1 }).remainingMs).toBe(5_000);
    const inIntro = oddOneOutReducer(createInitialOddOneOutState(), {
      type: 'tick',
      remainingMs: 1,
    });
    expect(inIntro.remainingMs).toBe(0);
  });
});

describe('tap-tile', () => {
  it('ignores a tap after the monotonic deadline (no post-deadline grace)', () => {
    const state = startSession('late-tap', 'normal');
    // Deadline is NOW + 12_000; a tap one tick later must be an exact no-op —
    // the round stays in `playing` and the timeout path still resolves it.
    const late = oddOneOutReducer(state, {
      type: 'tap-tile',
      index: expectedBoard(state, 'late-tap').oddIndex,
      nowMs: NOW + 12_001,
    });
    expect(late).toBe(state);
    expect(Object.is(late, state)).toBe(true);

    // A tap exactly at the boundary is honored (tie goes to the player), and
    // the tick-driven timeout still ends an unanswered round.
    const atBoundary = oddOneOutReducer(state, {
      type: 'tap-tile',
      index: expectedBoard(state, 'late-tap').oddIndex,
      nowMs: NOW + 12_000,
    });
    expect(atBoundary.phase).toBe('roundResult');
    expect(atBoundary.roundOutcome).toBe('passed');

    const timedOut = oddOneOutReducer(late, { type: 'round-timeout' });
    expect(timedOut.phase).toBe('roundResult');
    expect(timedOut.roundOutcome).toBe('timeout');
    expect(timedOut.stats.timeouts).toBe(1);
    expect(timedOut.stats.roundsPlayed).toBe(1);
  });

  it('passes the round on the first try with points + bonus', () => {
    let state = startSession('tap', 'normal');
    state = oddOneOutReducer(state, { type: 'tap-tile', index: expectedBoard(state, 'tap').oddIndex, nowMs: NOW + 6_000 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.stats.score).toBe(125);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.firstTryCorrect).toBe(1);
    expect(state.stats.wrongTaps).toBe(0);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    // solve ratio 6000/12000 = 0.5
    expect(state.stats.solveRatioSum).toBeCloseTo(0.5);
  });

  it('penalizes a wrong tap and keeps the round running', () => {
    let state = startSession('tap-wrong');
    state = wrongRound(state, 'tap-wrong');
    expect(state.phase).toBe('playing');
    expect(state.roundWrongTaps).toBe(1);
    expect(state.stats.wrongTaps).toBe(1);
    expect(state.stats.score).toBe(0); // max(0, 0 - 25)
    expect(state.lastWrongIndex).toBe((state.board!.oddIndex + 1) % 9);
  });

  it('loses the first-try bonus after a wrong tap and still passes', () => {
    let state = startSession('tap-messy');
    state = wrongRound(state, 'tap-messy');
    state = passRound(state, 'tap-messy');
    expect(state.roundOutcome).toBe('passed');
    expect(state.stats.score).toBe(100); // no bonus
    expect(state.stats.firstTryCorrect).toBe(0);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.wrongTaps).toBe(1);
  });

  it('penalizes wrong taps against an existing score', () => {
    let state = startSession('tap-two');
    state = passRound(state, 'tap-two'); // score 125
    state = oddOneOutReducer(state, { type: 'next-round', nowMs: NOW + 15_000 });
    state = wrongRound(state, 'tap-two'); // -25 → 100
    expect(state.stats.score).toBe(100);
    expect(state.phase).toBe('playing');
  });

  it('is ignored during roundResult or while paused', () => {
    let state = startSession('x');
    state = passRound(state, 'x');
    const played = state.stats.roundsPlayed;
    const after = oddOneOutReducer(state, { type: 'tap-tile', index: 0, nowMs: NOW });
    expect(after.stats.roundsPlayed).toBe(played);
    const paused = oddOneOutReducer(startSession('x'), { type: 'pause', remainingMs: 9_000 });
    expect(oddOneOutReducer(paused, { type: 'tap-tile', index: 0, nowMs: NOW }).roundWrongTaps).toBe(0);
  });
});

describe('round-timeout', () => {
  it('marks the round failed when the window expires', () => {
    const state = oddOneOutReducer(startSession('t'), { type: 'round-timeout' });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('timeout');
    expect(state.remainingMs).toBe(0);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.timeouts).toBe(1);
    expect(state.stats.streak).toBe(0);
  });

  it('is ignored while paused or outside the playing phase', () => {
    const paused = oddOneOutReducer(startSession('t'), { type: 'pause', remainingMs: 9_000 });
    expect(oddOneOutReducer(paused, { type: 'round-timeout' }).phase).toBe('playing');
    const results = oddOneOutReducer(startSession('t'), { type: 'round-timeout' });
    expect(oddOneOutReducer(results, { type: 'round-timeout' }).stats.timeouts).toBe(1);
  });
});

describe('next-round', () => {
  it('escalates the step after a pass and regenerates a distinct board', () => {
    let state = startSession('escalate');
    state = passRound(state, 'escalate');
    const prevBoard = state.board;
    state = oddOneOutReducer(state, { type: 'next-round', nowMs: NOW + 15_000 });
    expect(state.phase).toBe('playing');
    expect(state.roundIndex).toBe(1);
    expect(state.step).toBe(1);
    expect(state.subtlety).toBe(1);
    expect(state.windowMs).toBe(10_500);
    expect(state.deadlineMs).toBe(NOW + 15_000 + 10_500);
    expect(state.board).not.toBeNull();
    expect(state.board!.oddIndex).not.toBe(prevBoard!.oddIndex);
    expect(state.prevBoard).toEqual(prevBoard);
  });

  it('holds the step after a failure', () => {
    let state = startSession('hold');
    state = oddOneOutReducer(state, { type: 'round-timeout' });
    state = oddOneOutReducer(state, { type: 'next-round', nowMs: NOW + 15_000 });
    expect(state.roundIndex).toBe(1);
    expect(state.step).toBe(0);
    expect(state.subtlety).toBe(0);
  });

  it('moves ±1 for adaptive sessions', () => {
    let state = startSession('adapt', 'adaptive');
    state = passRound(state, 'adapt');
    state = oddOneOutReducer(state, { type: 'next-round', nowMs: NOW + 15_000 });
    expect(state.step).toBe(1);
    state = oddOneOutReducer(state, { type: 'round-timeout' });
    state = oddOneOutReducer(state, { type: 'next-round', nowMs: NOW + 20_000 });
    expect(state.step).toBe(0);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 5 rounds
    let step = 0;
    for (let round = 0; round < 5; round += 1) {
      state = passRound(state, 'final');
      state = oddOneOutReducer(state, { type: 'next-round', nowMs: NOW + (round + 1) * 15_000 });
      const params = ODD_ONE_OUT_DIFFICULTY_PARAMS.easy;
      step = escalateStep(step, true, 'easy', params);
      const effective = effectiveParamsForStep(params, step);
      // Sanity: the reducer's params match the escalation contract.
      if (round < 4) {
        expect(state.subtlety).toBe(effective.subtlety);
      }
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.firstTryCorrect).toBe(5);
    expect(state.stats.score).toBe(perfectSessionScore(ODD_ONE_OUT_DIFFICULTY_PARAMS.easy));
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = oddOneOutReducer(createInitialOddOneOutState(), {
      type: 'pause',
      remainingMs: 0,
    });
    expect(inIntro.paused).toBe(false);
    let state = oddOneOutReducer(startSession('p'), { type: 'pause', remainingMs: 9_000 });
    expect(state.paused).toBe(true);
    expect(state.remainingMs).toBe(9_000);
    state = oddOneOutReducer(state, { type: 'resume', nowMs: NOW + 30_000 });
    expect(state.paused).toBe(false);
    // The deadline is rebuilt from the frozen remainder.
    expect(state.deadlineMs).toBe(NOW + 30_000 + 9_000);
    expect(oddOneOutReducer(state, { type: 'resume', nowMs: NOW }).paused).toBe(false);
  });

  it('cannot pause while paused or on results, and roundResult pause is allowed', () => {
    let state = oddOneOutReducer(startSession('p'), { type: 'pause', remainingMs: 5_000 });
    state = oddOneOutReducer(state, { type: 'pause', remainingMs: 1_000 });
    expect(state.remainingMs).toBe(5_000);
    const result = oddOneOutReducer(startSession('p'), { type: 'round-timeout' });
    expect(oddOneOutReducer(result, { type: 'pause', remainingMs: 0 }).paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = oddOneOutReducer(createInitialOddOneOutState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(oddOneOutReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = oddOneOutReducer(createInitialOddOneOutState(), {
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
    let state = oddOneOutReducer(createInitialOddOneOutState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = oddOneOutReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      oddOneOutReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = oddOneOutReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(6);
    expect(state.stats.roundsPassed).toBe(6);
    expect(state.stats.firstTryCorrect).toBe(6);
    expect(state.stats.wrongTaps).toBe(0);
    expect(state.stats.timeouts).toBe(0);
    expect(state.stats.solveRatioSum).toBe(0);
    expect(state.stats.score).toBe(perfectSessionScore(ODD_ONE_OUT_DIFFICULTY_PARAMS.normal));
  });

  it('force-lose ends the session with the current round failed', () => {
    const state = oddOneOutReducer(startSession('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.timeouts).toBe(1);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = passRound(startSession('qa-lose2'), 'qa-lose2');
    expect(state.roundOutcome).toBe('passed');
    const result = oddOneOutReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsPassed).toBe(1);
    expect(result.stats.timeouts).toBe(0);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = oddOneOutReducer(createInitialOddOneOutState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = oddOneOutReducer(startSession('q'), { type: 'qa/force-win' });
    const after = oddOneOutReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = oddOneOutReducer(createInitialOddOneOutState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = oddOneOutReducer(createInitialOddOneOutState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = oddOneOutReducer(createInitialOddOneOutState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = oddOneOutReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});