// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { memoryGameReducer } from '../reducer';
import { createInitialMemoryState } from '../types';
import type { MemoryGameState } from '../types';
import { generateRoundSequence } from '../generator';
import { perfectSessionScore } from '../scoring';
import { MEMORY_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): MemoryGameState {
  let state = createInitialMemoryState();
  state = memoryGameReducer(state, { type: 'select-difficulty', level });
  state = memoryGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

/** Advance the reveal phase to the input phase. */
function revealAll(state: MemoryGameState, times = state.length): MemoryGameState {
  let current = state;
  for (let i = 0; i < times; i += 1) {
    current = memoryGameReducer(current, { type: 'reveal-tick' });
  }
  return current;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = memoryGameReducer(createInitialMemoryState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = memoryGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the reveal phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('reveal');
    expect(state.profile?.level).toBe('normal');
    expect(state.length).toBe(4);
    expect(state.revealedIndex).toBe(0);
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
    expect(adaptive.length).toBe(4);
  });
});

describe('reveal-tick', () => {
  it('advances one tile at a time and hands over to input at the end', () => {
    let state = startSession('r');
    state = memoryGameReducer(state, { type: 'reveal-tick' });
    expect(state.revealedIndex).toBe(1);
    state = memoryGameReducer(state, { type: 'reveal-tick' });
    expect(state.revealedIndex).toBe(2);
    state = memoryGameReducer(state, { type: 'reveal-tick' });
    expect(state.revealedIndex).toBe(3);
    state = memoryGameReducer(state, { type: 'reveal-tick' });
    expect(state.phase).toBe('input');
    expect(state.revealedIndex).toBe(-1);
  });

  it('is ignored outside the reveal phase or while paused', () => {
    const inInput = revealAll(startSession('r'));
    expect(memoryGameReducer(inInput, { type: 'reveal-tick' }).phase).toBe('input');
    const paused = memoryGameReducer(startSession('r'), { type: 'pause' });
    expect(memoryGameReducer(paused, { type: 'reveal-tick' }).revealedIndex).toBe(0);
  });
});

describe('tap-tile', () => {
  it('validates taps against the sequence and completes the round', () => {
    let state = revealAll(startSession('tap', 'easy')); // length 3
    const [t0, t1, t2] = state.sequence;
    state = memoryGameReducer(state, { type: 'tap-tile', index: t0 });
    expect(state.phase).toBe('input');
    expect(state.inputIndex).toBe(1);
    expect(state.stats.correctTaps).toBe(1);
    state = memoryGameReducer(state, { type: 'tap-tile', index: t1 });
    expect(state.inputIndex).toBe(2);
    state = memoryGameReducer(state, { type: 'tap-tile', index: t2 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.longestSequence).toBe(3);
    expect(state.stats.score).toBe(100);
  });

  it('fails the round immediately on a wrong tap', () => {
    let state = revealAll(startSession('tap-wrong'));
    const wrong = (state.sequence[0] + 1) % 9;
    state = memoryGameReducer(state, { type: 'tap-tile', index: wrong });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.totalTaps).toBe(1);
  });

  it('is ignored during reveal / after the round ended', () => {
    let state = startSession('x');
    state = memoryGameReducer(state, { type: 'tap-tile', index: 0 });
    expect(state.phase).toBe('reveal');

    // After the round result, further taps are ignored (no double counting).
    let ended = revealAll(startSession('x'));
    ended = memoryGameReducer(ended, { type: 'tap-tile', index: -1 }); // wrong tap → failed
    expect(ended.phase).toBe('roundResult');
    ended = memoryGameReducer(ended, { type: 'tap-tile', index: 0 });
    expect(ended.stats.roundsPlayed).toBe(1);
    expect(ended.stats.totalTaps).toBe(1);
  });
});

describe('next-round', () => {
  it('escalates the length after a pass and regenerates a distinct sequence', () => {
    let state = revealAll(startSession('escalate'));
    for (const tile of state.sequence) {
      state = memoryGameReducer(state, { type: 'tap-tile', index: tile });
    }
    expect(state.roundOutcome).toBe('passed');
    state = memoryGameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('reveal');
    expect(state.roundIndex).toBe(1);
    expect(state.length).toBe(5);
    expect(state.sequence).toHaveLength(5);
    expect(state.sequence).not.toEqual(state.prevSequence);
  });

  it('holds the length after a failure', () => {
    let state = revealAll(startSession('hold'));
    state = memoryGameReducer(state, { type: 'tap-tile', index: (state.sequence[0] + 1) % 9 });
    state = memoryGameReducer(state, { type: 'next-round' });
    expect(state.length).toBe(4);
    expect(state.roundIndex).toBe(1);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 4 rounds
    for (let round = 0; round < 4; round += 1) {
      state = revealAll(state);
      for (const tile of state.sequence) {
        state = memoryGameReducer(state, { type: 'tap-tile', index: tile });
      }
      state = memoryGameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
    expect(state.stats.score).toBe(perfectSessionScore(MEMORY_DIFFICULTY_PARAMS.easy));
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = memoryGameReducer(createInitialMemoryState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = memoryGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = memoryGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(memoryGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = memoryGameReducer(startSession('p'), { type: 'pause' });
    state = memoryGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = memoryGameReducer(createInitialMemoryState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(memoryGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = memoryGameReducer(createInitialMemoryState(), {
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
    let state = memoryGameReducer(createInitialMemoryState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = memoryGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      memoryGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = memoryGameReducer(revealAll(startSession('qa-win')), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.score).toBe(perfectSessionScore(MEMORY_DIFFICULTY_PARAMS.normal));
    expect(state.stats.longestSequence).toBe(9);
  });

  it('force-lose ends the session with the current round failed', () => {
    const midReveal = startSession('qa-lose');
    const state = memoryGameReducer(midReveal, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = revealAll(startSession('qa-lose2'));
    for (const tile of state.sequence) {
      state = memoryGameReducer(state, { type: 'tap-tile', index: tile });
    }
    expect(state.roundOutcome).toBe('passed');
    const result = memoryGameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsPassed).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = memoryGameReducer(createInitialMemoryState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = memoryGameReducer(revealAll(startSession('q')), { type: 'qa/force-win' });
    const after = memoryGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = memoryGameReducer(createInitialMemoryState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = memoryGameReducer(createInitialMemoryState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = memoryGameReducer(createInitialMemoryState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = memoryGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
