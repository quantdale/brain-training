// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { gameReducer } from '../reducer';
import { createInitialState } from '../types';
import type { PatternTapBackState } from '../types';
import { generateRoundSequence } from '../generator';
import { perfectSessionScore } from '../scoring';
import { DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): PatternTapBackState {
  let state = createInitialState();
  state = gameReducer(state, { type: 'select-difficulty', level });
  state = gameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

/** Advance the observe phase to the recall phase. */
function observeAll(state: PatternTapBackState, times = state.length): PatternTapBackState {
  let current = state;
  for (let i = 0; i < times; i += 1) {
    current = gameReducer(current, { type: 'observe-tick' });
  }
  return current;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = gameReducer(createInitialState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = gameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the observe phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('observe');
    expect(state.profile?.level).toBe('normal');
    expect(state.length).toBe(4);
    expect(state.observeIndex).toBe(0);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsPassed: 0,
      bestStreak: 0,
      streak: 0,
      longestSequence: 0,
      totalTaps: 0,
      correctTaps: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same sequence for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.sequence).toEqual(b.sequence);
    expect(a.sequence).toEqual(
      generateRoundSequence({
        rng: createRng('det'),
        roundIndex: 0,
        length: 4,
        gridSize: 9,
        prevSequence: null,
      }),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.length).toBe(6);
    expect(expert.profile?.parameters.gridSize).toBe(16);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.length).toBe(3);
  });
});

describe('observe-tick', () => {
  it('advances one tile at a time and hands over to recall at the end', () => {
    let state = startSession('r');
    state = gameReducer(state, { type: 'observe-tick' });
    expect(state.observeIndex).toBe(1);
    state = gameReducer(state, { type: 'observe-tick' });
    expect(state.observeIndex).toBe(2);
    state = gameReducer(state, { type: 'observe-tick' });
    expect(state.observeIndex).toBe(3);
    state = gameReducer(state, { type: 'observe-tick' });
    expect(state.phase).toBe('recall');
    expect(state.observeIndex).toBe(-1);
  });

  it('is ignored outside the observe phase or while paused', () => {
    const inRecall = observeAll(startSession('r'));
    expect(gameReducer(inRecall, { type: 'observe-tick' }).phase).toBe('recall');
    const paused = gameReducer(startSession('r'), { type: 'pause' });
    expect(gameReducer(paused, { type: 'observe-tick' }).observeIndex).toBe(0);
  });
});

describe('tap-tile', () => {
  it('validates taps against the sequence and completes the round', () => {
    let state = observeAll(startSession('tap', 'easy')); // length 3
    const [t0, t1, t2] = state.sequence;
    state = gameReducer(state, { type: 'tap-tile', index: t0 });
    expect(state.phase).toBe('recall');
    expect(state.inputIndex).toBe(1);
    expect(state.stats.correctTaps).toBe(1);
    expect(state.recallHighlight).toBe(true);
    // Clear the highlight
    state = gameReducer(state, { type: 'recall-tick' });
    expect(state.recallHighlight).toBe(false);
    state = gameReducer(state, { type: 'tap-tile', index: t1 });
    expect(state.inputIndex).toBe(2);
    state = gameReducer(state, { type: 'recall-tick' });
    state = gameReducer(state, { type: 'tap-tile', index: t2 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.longestSequence).toBe(3);
    expect(state.stats.score).toBe(130); // 100 + 10*3
    expect(state.completedRoundLengths).toEqual([3]);
  });

  it('fails the round immediately on a wrong tap', () => {
    let state = observeAll(startSession('tap-wrong'));
    const wrong = (state.sequence[0] + 1) % 9;
    state = gameReducer(state, { type: 'tap-tile', index: wrong });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.totalTaps).toBe(1);
    expect(state.completedRoundLengths).toEqual([]);
  });

  it('is ignored during observe / after the round ended', () => {
    let state = startSession('x');
    state = gameReducer(state, { type: 'tap-tile', index: 0 });
    expect(state.phase).toBe('observe');

    // After the round result, further taps are ignored (no double counting).
    let ended = observeAll(startSession('x'));
    ended = gameReducer(ended, { type: 'tap-tile', index: -1 }); // wrong tap → failed
    expect(ended.phase).toBe('roundResult');
    ended = gameReducer(ended, { type: 'tap-tile', index: 0 });
    expect(ended.stats.roundsPlayed).toBe(1);
    expect(ended.stats.totalTaps).toBe(1);
  });

  it('ignores taps during recall-highlight phase', () => {
    let state = observeAll(startSession('tap-hl'));
    const [t0] = state.sequence;
    state = gameReducer(state, { type: 'tap-tile', index: t0 });
    expect(state.recallHighlight).toBe(true);
    // Tapping during highlight should be ignored
    const stateBefore = { ...state };
    state = gameReducer(state, { type: 'tap-tile', index: 99 });
    expect(state.stats.totalTaps).toBe(stateBefore.stats.totalTaps);
  });
});

describe('recall-tick', () => {
  it('clears the recall highlight', () => {
    let state = observeAll(startSession('rt'));
    const [t0] = state.sequence;
    state = gameReducer(state, { type: 'tap-tile', index: t0 });
    expect(state.recallHighlight).toBe(true);
    state = gameReducer(state, { type: 'recall-tick' });
    expect(state.recallHighlight).toBe(false);
  });

  it('is a no-op when not in recall or not highlighted', () => {
    const state = startSession('rt2');
    expect(gameReducer(state, { type: 'recall-tick' }).recallHighlight).toBe(false);
  });
});

describe('next-round', () => {
  it('escalates the length after a pass and regenerates a distinct sequence', () => {
    let state = observeAll(startSession('escalate'));
    for (const tile of state.sequence) {
      state = gameReducer(state, { type: 'tap-tile', index: tile });
      state = gameReducer(state, { type: 'recall-tick' });
    }
    expect(state.roundOutcome).toBe('passed');
    state = gameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('observe');
    expect(state.roundIndex).toBe(1);
    expect(state.length).toBe(5);
    expect(state.sequence).toHaveLength(5);
    expect(state.sequence).not.toEqual(state.prevSequence);
  });

  it('holds the length after a failure', () => {
    let state = observeAll(startSession('hold'));
    state = gameReducer(state, { type: 'tap-tile', index: (state.sequence[0] + 1) % 9 });
    state = gameReducer(state, { type: 'next-round' });
    expect(state.length).toBe(4);
    expect(state.roundIndex).toBe(1);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 4 rounds
    for (let round = 0; round < 4; round += 1) {
      state = observeAll(state);
      for (const tile of state.sequence) {
        state = gameReducer(state, { type: 'tap-tile', index: tile });
        state = gameReducer(state, { type: 'recall-tick' });
      }
      state = gameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
    expect(state.stats.score).toBe(perfectSessionScore(DIFFICULTY_PARAMS.easy));
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = gameReducer(createInitialState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = gameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = gameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(gameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = gameReducer(startSession('p'), { type: 'pause' });
    state = gameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = gameReducer(createInitialState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(gameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = gameReducer(createInitialState(), {
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
    let state = gameReducer(createInitialState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = gameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      gameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = gameReducer(observeAll(startSession('qa-win')), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.score).toBe(perfectSessionScore(DIFFICULTY_PARAMS.normal));
    expect(state.stats.longestSequence).toBe(8);
    expect(state.completedRoundLengths).toHaveLength(5);
  });

  it('force-lose ends the session with the current round failed', () => {
    const midObserve = startSession('qa-lose');
    const state = gameReducer(midObserve, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = observeAll(startSession('qa-lose2'));
    for (const tile of state.sequence) {
      state = gameReducer(state, { type: 'tap-tile', index: tile });
      state = gameReducer(state, { type: 'recall-tick' });
    }
    expect(state.roundOutcome).toBe('passed');
    const result = gameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsPassed).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = gameReducer(createInitialState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = gameReducer(observeAll(startSession('q')), { type: 'qa/force-win' });
    const after = gameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = gameReducer(createInitialState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = gameReducer(createInitialState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = gameReducer(createInitialState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = gameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
