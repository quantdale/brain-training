// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { visualSearchGameReducer } from '../reducer';
import { createInitialVisualSearchState } from '../types';
import type { VisualSearchGameState } from '../types';
import { generateRoundTarget } from '../generator';
import { perfectSessionScore } from '../scoring';
import {
  ADAPTIVE_PARAMS,
  DISTRACTOR_PENALTY_MS,
  VISUAL_SEARCH_DIFFICULTY_PARAMS,
} from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
  nowMs = 0,
): VisualSearchGameState {
  let state = createInitialVisualSearchState();
  state = visualSearchGameReducer(state, { type: 'select-difficulty', level });
  state = visualSearchGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
    nowMs,
  });
  return state;
}

/** Resolve the current round (tap the target at `nowMs`, then next-round). */
function passRound(state: VisualSearchGameState, nowMs = 0): VisualSearchGameState {
  let current = visualSearchGameReducer(state, { type: 'tap-tile', index: state.targetIndex, nowMs });
  expect(current.roundOutcome).toBe('passed');
  current = visualSearchGameReducer(current, { type: 'next-round' });
  return current;
}

/** Resolve the current round by letting the window expire. */
function timeoutRound(state: VisualSearchGameState, nowMs = state.roundDeadlineMs): VisualSearchGameState {
  const current = visualSearchGameReducer(state, { type: 'tick', nowMs });
  expect(current.roundOutcome).toBe('failed');
  expect(current.failReason).toBe('timeout');
  return visualSearchGameReducer(current, { type: 'next-round' });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = visualSearchGameReducer(createInitialVisualSearchState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = visualSearchGameReducer(startSession('x'), {
      type: 'select-difficulty',
      level: 'easy',
    });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the playing phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('playing');
    expect(state.profile?.level).toBe('normal');
    expect(state.gridSize).toBe(4);
    expect(state.windowMs).toBe(4_500);
    expect(state.sessionDeadlineMs).toBe(120_000);
    expect(state.roundDeadlineMs).toBe(4_500);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsPassed: 0,
      bestStreak: 0,
      streak: 0,
      totalTaps: 0,
      correctTaps: 0,
      sumResponseMs: 0,
      sumResponseRatio: 0,
      fastestResponseMs: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same target for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.targetIndex).toEqual(b.targetIndex);
    expect(a.targetIndex).toEqual(
      generateRoundTarget({
        rng: createRng('det'),
        roundIndex: 0,
        gridSize: 4,
        prevTargetIndex: null,
      }),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.gridSize).toBe(9);
    expect(expert.windowMs).toBe(2_400);
    expect(expert.sessionDeadlineMs).toBe(180_000);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.gridSize).toBe(4);
    expect(adaptive.windowMs).toBe(3_000);
  });
});

describe('tick', () => {
  it('updates the clock and times the round out at the deadline', () => {
    let state = startSession('r');
    state = visualSearchGameReducer(state, { type: 'tick', nowMs: 1_000 });
    expect(state.nowMs).toBe(1_000);
    expect(state.phase).toBe('playing');
    state = visualSearchGameReducer(state, { type: 'tick', nowMs: 4_500 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.failReason).toBe('timeout');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('ends the session when the score-attack budget expires mid-round', () => {
    const state = visualSearchGameReducer(startSession('budget'), {
      type: 'tick',
      nowMs: 120_000,
    });
    expect(state.phase).toBe('results');
    // The unfinished round is not counted.
    expect(state.stats.roundsPlayed).toBe(0);
  });

  it('ends the session when the budget expires between rounds', () => {
    let state = passRound(startSession('between'));
    expect(state.phase).toBe('playing');
    state = visualSearchGameReducer(state, { type: 'tick', nowMs: 120_000 });
    expect(state.phase).toBe('results');
  });

  it('never moves the clock backwards and is ignored while paused', () => {
    let state = visualSearchGameReducer(startSession('p'), { type: 'tick', nowMs: 1_000 });
    state = visualSearchGameReducer(state, { type: 'tick', nowMs: 500 });
    expect(state.nowMs).toBe(1_000);
    state = visualSearchGameReducer(state, { type: 'pause', nowMs: 1_000 });
    expect(visualSearchGameReducer(state, { type: 'tick', nowMs: 9_999 }).nowMs).toBe(1_000);
  });
});

describe('tap-tile', () => {
  it('passes the round when the target is tapped and awards speed-scaled points', () => {
    let state = startSession('tap', 'normal');
    const target = state.targetIndex;
    state = visualSearchGameReducer(state, { type: 'tap-tile', index: target, nowMs: 1_000 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.failReason).toBeNull();
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.correctTaps).toBe(1);
    // remaining 3500/4500 → 100 + round(77.78) = 178
    expect(state.stats.score).toBe(178);
    expect(state.lastResponseMs).toBe(1_000);
    expect(state.lastRoundPoints).toBe(178);
    expect(state.stats.sumResponseRatio).toBeCloseTo(3_500 / 4_500, 10);
  });

  it('fails the round on a distractor and docks the session clock', () => {
    let state = startSession('tap-wrong');
    const wrong = (state.targetIndex + 1) % state.gridSize;
    state = visualSearchGameReducer(state, { type: 'tap-tile', index: wrong, nowMs: 500 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.failReason).toBe('distractor');
    expect(state.sessionDeadlineMs).toBe(120_000 - DISTRACTOR_PENALTY_MS);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.totalTaps).toBe(1);
    expect(state.lastTapIndex).toBe(wrong);
  });

  it('treats a tap after the deadline as a timeout, not a distractor', () => {
    let state = startSession('late');
    state = visualSearchGameReducer(state, { type: 'tap-tile', index: 0, nowMs: 4_500 });
    expect(state.roundOutcome).toBe('failed');
    expect(state.failReason).toBe('timeout');
    expect(state.sessionDeadlineMs).toBe(120_000); // no penalty docked
  });

  it('ends the session when tapped after the budget expired', () => {
    const state = visualSearchGameReducer(startSession('very-late'), {
      type: 'tap-tile',
      index: 0,
      nowMs: 120_000,
    });
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(0);
  });

  it('is ignored outside the playing phase or while paused', () => {
    const intro = visualSearchGameReducer(createInitialVisualSearchState(), {
      type: 'tap-tile',
      index: 0,
      nowMs: 0,
    });
    expect(intro.phase).toBe('intro');

    let playing = startSession('x');
    playing = visualSearchGameReducer(playing, { type: 'pause', nowMs: 0 });
    const after = visualSearchGameReducer(playing, {
      type: 'tap-tile',
      index: playing.targetIndex,
      nowMs: 0,
    });
    expect(after.phase).toBe('playing');
    expect(after.stats.totalTaps).toBe(0);
  });
});

describe('next-round', () => {
  it('escalates the grid and shrinks the window on fixed levels', () => {
    // normal: round 0-1 on 4 tiles (4500/4100), round 2 on 9 tiles (3700).
    let state = startSession('escalate');
    expect(state.gridSize).toBe(4);
    state = passRound(state);
    expect(state.roundIndex).toBe(1);
    expect(state.gridSize).toBe(4);
    expect(state.windowMs).toBe(4_100);
    state = passRound(state);
    expect(state.roundIndex).toBe(2);
    expect(state.gridSize).toBe(9);
    expect(state.windowMs).toBe(3_700);
    expect(state.targetIndex).toBeLessThan(9);
  });

  it('regenerates a distinct target for the next round', () => {
    let state = startSession('distinct');
    const first = state.targetIndex;
    state = passRound(state);
    expect(state.targetIndex).not.toBe(first);
  });

  it('moves the adaptive window by outcome within bounds', () => {
    let state = startSession('adaptive-window', 'adaptive');
    expect(state.windowMs).toBe(ADAPTIVE_PARAMS.initialWindowMs);
    state = passRound(state); // pass → shrink
    expect(state.windowMs).toBe(2_700);
    state = visualSearchGameReducer(state, {
      type: 'tap-tile',
      index: (state.targetIndex + 1) % state.gridSize,
      nowMs: 0,
    });
    state = visualSearchGameReducer(state, { type: 'next-round' }); // fail → grow
    expect(state.windowMs).toBe(3_000);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'normal');
    for (let round = 0; round < 12; round += 1) {
      state = visualSearchGameReducer(state, {
        type: 'tap-tile',
        index: state.targetIndex,
        nowMs: 0,
      });
      expect(state.roundOutcome).toBe('passed');
      state = visualSearchGameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(12);
    expect(state.stats.roundsPassed).toBe(12);
    expect(state.stats.score).toBe(perfectSessionScore(VISUAL_SEARCH_DIFFICULTY_PARAMS.normal));
  });

  it('moves to results when the budget is exhausted between rounds', () => {
    let state = passRound(startSession('next-budget'));
    state = visualSearchGameReducer(state, { type: 'tick', nowMs: 120_000 });
    expect(state.phase).toBe('results');
    // next-round from results is a no-op
    expect(visualSearchGameReducer(state, { type: 'next-round' }).phase).toBe('results');
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = visualSearchGameReducer(createInitialVisualSearchState(), {
      type: 'pause',
      nowMs: 0,
    });
    expect(inIntro.paused).toBe(false);
    let state = visualSearchGameReducer(startSession('p'), { type: 'pause', nowMs: 0 });
    expect(state.paused).toBe(true);
    expect(state.pausedAtMs).toBe(0);
    state = visualSearchGameReducer(state, { type: 'resume', nowMs: 0 });
    expect(state.paused).toBe(false);
    expect(state.pausedAtMs).toBeNull();
  });

  it('shifts deadlines by the paused duration (timers freeze while hidden)', () => {
    let state = startSession('freeze');
    state = visualSearchGameReducer(state, { type: 'pause', nowMs: 1_000 });
    state = visualSearchGameReducer(state, { type: 'resume', nowMs: 5_000 });
    expect(state.nowMs).toBe(5_000);
    expect(state.roundDeadlineMs).toBe(4_500 + 4_000);
    expect(state.sessionDeadlineMs).toBe(120_000 + 4_000);
    // The full remaining window is still required after resuming.
    state = visualSearchGameReducer(state, { type: 'tick', nowMs: 8_499 });
    expect(state.phase).toBe('playing');
    state = visualSearchGameReducer(state, { type: 'tick', nowMs: 8_500 });
    expect(state.phase).toBe('roundResult');
    expect(state.failReason).toBe('timeout');
  });

  it('cannot pause twice or resume unpaused', () => {
    let state = visualSearchGameReducer(startSession('p'), { type: 'pause', nowMs: 0 });
    state = visualSearchGameReducer(state, { type: 'pause', nowMs: 500 });
    expect(state.pausedAtMs).toBe(0);
    expect(state.paused).toBe(true);
    const resumed = visualSearchGameReducer(state, { type: 'resume', nowMs: 500 });
    expect(visualSearchGameReducer(resumed, { type: 'resume', nowMs: 500 }).paused).toBe(false);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = visualSearchGameReducer(createInitialVisualSearchState(), {
      type: 'tutorial-open',
    });
    expect(opened.tutorialOpen).toBe(true);
    expect(visualSearchGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = visualSearchGameReducer(createInitialVisualSearchState(), {
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
    let state = visualSearchGameReducer(createInitialVisualSearchState(), {
      type: 'persistence-started',
    });
    expect(state.persistState).toBe('started');
    state = visualSearchGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      visualSearchGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = visualSearchGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(12);
    expect(state.stats.roundsPassed).toBe(12);
    expect(state.stats.bestStreak).toBe(12);
    // Instant-tap ratios average to 1 → normalization reaches 1.0.
    expect(state.stats.sumResponseRatio).toBe(12);
    expect(state.stats.score).toBe(perfectSessionScore(VISUAL_SEARCH_DIFFICULTY_PARAMS.normal));
  });

  it('force-lose ends the session with the current round failed', () => {
    const midRound = startSession('qa-lose');
    const state = visualSearchGameReducer(midRound, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    const scored = startSession('qa-lose2');
    let state = visualSearchGameReducer(scored, {
      type: 'tap-tile',
      index: scored.targetIndex,
      nowMs: 0,
    });
    expect(state.roundOutcome).toBe('passed');
    const result = visualSearchGameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsPassed).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = visualSearchGameReducer(createInitialVisualSearchState(), {
      type: 'qa/force-win',
    });
    expect(intro.phase).toBe('intro');
    const scored = startSession('q');
    let state = visualSearchGameReducer(scored, {
      type: 'tap-tile',
      index: scored.targetIndex,
      nowMs: 0,
    });
    state = visualSearchGameReducer(state, { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    const after = visualSearchGameReducer(state, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = visualSearchGameReducer(createInitialVisualSearchState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = visualSearchGameReducer(createInitialVisualSearchState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = visualSearchGameReducer(createInitialVisualSearchState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = visualSearchGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});

describe('session flow helpers (scenario coverage)', () => {
  it('a full mixed session resolves deterministically', () => {
    // Pass round 0, time out round 1, then pass everything to the end.
    let state = startSession('mixed', 'normal');
    state = passRound(state);
    state = timeoutRound(state);
    for (let round = 2; round < 12; round += 1) {
      state = passRound(state);
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(12);
    expect(state.stats.roundsPassed).toBe(11);
    expect(state.stats.bestStreak).toBe(10); // rounds 2..11
  });
});
