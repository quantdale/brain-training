// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { logicGameReducer } from '../reducer';
import { createInitialLogicState } from '../types';
import type { LogicGameState, LogicPuzzle } from '../types';
import { generatePuzzle } from '../generator';
import { perfectSessionScore } from '../scoring';
import { ADAPTIVE_PARAMS, LOGIC_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): LogicGameState {
  let state = createInitialLogicState();
  state = logicGameReducer(state, { type: 'select-difficulty', level });
  state = logicGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

/** Answer the current round correctly (or wrongly) and move on. */
function answerAndAdvance(state: LogicGameState, correct: boolean): LogicGameState {
  let current = state;
  if (current.puzzle !== null) {
    const index = correct ? current.puzzle.answerIndex : (current.puzzle.answerIndex + 1) % 4;
    current = logicGameReducer(current, { type: 'answer-option', index, responseMs: 4000 });
  }
  return logicGameReducer(current, { type: 'next-round' });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = logicGameReducer(createInitialLogicState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = logicGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the question phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('question');
    expect(state.profile?.level).toBe('normal');
    expect(state.tier).toBe(1);
    expect(state.puzzle).not.toBeNull();
    expect(state.puzzle?.terms).toHaveLength(4);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsPassed: 0,
      bestStreak: 0,
      streak: 0,
      totalMs: 0,
      targetMs: 8000,
      fastestMs: null,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same puzzle for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.puzzle).toEqual(
      generatePuzzle({
        rng: createRng('det'),
        roundIndex: 0,
        tier: 1,
        params: LOGIC_DIFFICULTY_PARAMS.normal,
        prevPuzzle: null,
      }),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.tier).toBe(3);
    expect(expert.puzzle?.terms).toHaveLength(6);
    expect(expert.stats.targetMs).toBe(6000);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.tier).toBe(1);
    expect(adaptive.puzzle?.terms).toHaveLength(4);
    expect(adaptive.stats.targetMs).toBe(8000);
  });
});

describe('answer-option', () => {
  it('scores a correct answer with the speed bonus', () => {
    const state = startSession('ans');
    const puzzle = state.puzzle as LogicPuzzle;
    const next = logicGameReducer(state, {
      type: 'answer-option',
      index: puzzle.answerIndex,
      responseMs: 4000,
    });
    expect(next.phase).toBe('roundResult');
    expect(next.roundOutcome).toBe('passed');
    expect(next.selection).toBe(puzzle.answerIndex);
    expect(next.stats.roundsPlayed).toBe(1);
    expect(next.stats.roundsPassed).toBe(1);
    expect(next.stats.streak).toBe(1);
    expect(next.stats.bestStreak).toBe(1);
    expect(next.stats.totalMs).toBe(4000);
    expect(next.stats.fastestMs).toBe(4000);
    expect(next.stats.score).toBe(150); // 100 + round(50 * clamp01(8000/4000))
  });

  it('fails the round immediately on a wrong answer', () => {
    const state = startSession('ans-wrong');
    const puzzle = state.puzzle as LogicPuzzle;
    const wrongIndex = (puzzle.answerIndex + 1) % puzzle.options.length;
    const next = logicGameReducer(state, {
      type: 'answer-option',
      index: wrongIndex,
      responseMs: 9000,
    });
    expect(next.phase).toBe('roundResult');
    expect(next.roundOutcome).toBe('failed');
    expect(next.stats.roundsPlayed).toBe(1);
    expect(next.stats.roundsPassed).toBe(0);
    expect(next.stats.streak).toBe(0);
    expect(next.stats.totalMs).toBe(9000);
    expect(next.stats.score).toBe(0);
  });

  it('is ignored when already answered, during pause, or outside the question phase', () => {
    const state = startSession('x');
    const puzzle = state.puzzle as LogicPuzzle;
    const answered = logicGameReducer(state, {
      type: 'answer-option',
      index: puzzle.answerIndex,
      responseMs: 1000,
    });
    // Double answer (second dispatch after the round is scored) must not count.
    const double = logicGameReducer(answered, {
      type: 'answer-option',
      index: (puzzle.answerIndex + 1) % 4,
      responseMs: 1000,
    });
    expect(double.stats.roundsPlayed).toBe(1);
    expect(double.stats.totalMs).toBe(1000);

    const paused = logicGameReducer(state, { type: 'pause' });
    const duringPause = logicGameReducer(paused, {
      type: 'answer-option',
      index: puzzle.answerIndex,
      responseMs: 1000,
    });
    expect(duringPause.phase).toBe('question');
    expect(duringPause.selection).toBeNull();
  });
});

describe('next-round', () => {
  it('advances to a fresh distinct puzzle and accumulates the target time', () => {
    let state = answerAndAdvance(startSession('escalate'), true);
    expect(state.phase).toBe('question');
    expect(state.roundIndex).toBe(1);
    expect(state.tier).toBe(1); // fixed level: tier constant
    expect(state.puzzle).not.toBe(state.prevPuzzle);
    expect(state.puzzle?.terms).toHaveLength(4);
    expect(state.stats.targetMs).toBe(16000);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 4 rounds
    for (let round = 0; round < 4; round += 1) {
      state = answerAndAdvance(state, true);
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
    expect(state.stats.score).toBe(perfectSessionScore(LOGIC_DIFFICULTY_PARAMS.easy));
  });

  it('is ignored outside the round result phase', () => {
    const state = logicGameReducer(startSession('x'), { type: 'next-round' });
    expect(state.phase).toBe('question');
  });
});

describe('adaptive tier movement', () => {
  it('moves the tier ±1 on pass/fail within [0, 3]', () => {
    let state = answerAndAdvance(startSession('adapt', 'adaptive'), true);
    expect(state.tier).toBe(2);
    expect(state.puzzle?.terms).toHaveLength(5);
    state = answerAndAdvance(state, false);
    expect(state.tier).toBe(1);
    expect(state.puzzle?.terms).toHaveLength(4);

    // Floor at minTier 0.
    let floor = answerAndAdvance(startSession('adapt-floor', 'adaptive'), false);
    expect(floor.tier).toBe(0);
    expect(floor.puzzle?.terms).toHaveLength(3);
    floor = answerAndAdvance(floor, false);
    expect(floor.tier).toBe(0);

    // Cap at maxTier 3.
    let cap = startSession('adapt-cap', 'adaptive');
    cap = answerAndAdvance(cap, true);
    cap = answerAndAdvance(cap, true);
    cap = answerAndAdvance(cap, true);
    expect(cap.tier).toBe(3);
    expect(cap.puzzle?.terms).toHaveLength(6);
    cap = answerAndAdvance(cap, true);
    expect(cap.tier).toBe(3);
  });

  it('uses the adaptive value bounds for every tier', () => {
    const state = startSession('adapt-bounds', 'adaptive');
    expect(ADAPTIVE_PARAMS.maxValue).toBe(500);
    expect(state.puzzle).not.toBeNull();
    for (const value of [...(state.puzzle?.terms ?? []), state.puzzle?.answer ?? 0]) {
      expect(value).toBeGreaterThanOrEqual(ADAPTIVE_PARAMS.minValue);
      expect(value).toBeLessThanOrEqual(ADAPTIVE_PARAMS.maxValue);
    }
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = logicGameReducer(createInitialLogicState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = logicGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = logicGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(logicGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = logicGameReducer(startSession('p'), { type: 'pause' });
    state = logicGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = logicGameReducer(createInitialLogicState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(logicGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = logicGameReducer(createInitialLogicState(), {
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
    let state = logicGameReducer(createInitialLogicState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = logicGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      logicGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect fast run', () => {
    const state = logicGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.score).toBe(perfectSessionScore(LOGIC_DIFFICULTY_PARAMS.normal));
    expect(state.stats.totalMs).toBe(0); // perfect speed
    expect(state.stats.fastestMs).toBeNull();
  });

  it('force-lose ends the session with the current round failed', () => {
    const state = logicGameReducer(startSession('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = startSession('qa-lose2');
    const puzzle = state.puzzle as LogicPuzzle;
    state = logicGameReducer(state, {
      type: 'answer-option',
      index: puzzle.answerIndex,
      responseMs: 1000,
    });
    expect(state.roundOutcome).toBe('passed');
    const result = logicGameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsPassed).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = logicGameReducer(createInitialLogicState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = logicGameReducer(startSession('q'), { type: 'qa/force-win' });
    const after = logicGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = logicGameReducer(createInitialLogicState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = logicGameReducer(createInitialLogicState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = logicGameReducer(createInitialLogicState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = logicGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
