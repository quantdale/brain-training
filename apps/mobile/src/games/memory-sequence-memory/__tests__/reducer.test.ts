// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { sequenceMemoryGameReducer } from '../reducer';
import { createInitialSequenceMemoryState } from '../types';
import type { SequenceMemoryGameState } from '../types';
import { generateSequence } from '../generator';
import { perfectSessionScore, perfectClimbRounds, perfectClimbTaps } from '../scoring';
import { SEQUENCE_MEMORY_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): SequenceMemoryGameState {
  let state = createInitialSequenceMemoryState();
  state = sequenceMemoryGameReducer(state, { type: 'select-difficulty', level });
  state = sequenceMemoryGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
  });
  return state;
}

/** Advance the reveal phase to the input phase. */
function revealAll(state: SequenceMemoryGameState, times = state.length): SequenceMemoryGameState {
  let current = state;
  for (let i = 0; i < times; i += 1) {
    current = sequenceMemoryGameReducer(current, { type: 'reveal-tick' });
  }
  return current;
}

/** Complete the current round by tapping the sequence in order. */
function passRound(state: SequenceMemoryGameState): SequenceMemoryGameState {
  let current = revealAll(state);
  for (const tile of current.sequence) {
    current = sequenceMemoryGameReducer(current, { type: 'tap-tile', index: tile });
  }
  return current;
}

/** Fail the current round with a wrong tap. */
function failRound(state: SequenceMemoryGameState): SequenceMemoryGameState {
  let current = revealAll(state);
  current = sequenceMemoryGameReducer(current, {
    type: 'tap-tile',
    index: (current.sequence[0] + 1) % 4,
  });
  return current;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = sequenceMemoryGameReducer(createInitialSequenceMemoryState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = sequenceMemoryGameReducer(startSession('x'), {
      type: 'select-difficulty',
      level: 'easy',
    });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens the first sequence in the reveal phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('reveal');
    expect(state.profile?.level).toBe('normal');
    expect(state.length).toBe(3); // normal base length
    expect(state.revealedIndex).toBe(0);
    expect(state.roundIndex).toBe(0);
    expect(state.timeUp).toBe(false);
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
      generateSequence({
        rng: createRng('det'),
        sequenceIndex: 0,
        length: 3,
        tileCount: 4,
        prevSequence: null,
      }),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.length).toBe(5);
    expect(expert.profile?.parameters.tileCount).toBe(9);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.length).toBe(3);
  });
});

describe('reveal-tick', () => {
  it('advances one tile at a time and hands over to input at the end', () => {
    let state = startSession('r'); // length 3
    state = sequenceMemoryGameReducer(state, { type: 'reveal-tick' });
    expect(state.revealedIndex).toBe(1);
    state = sequenceMemoryGameReducer(state, { type: 'reveal-tick' });
    expect(state.revealedIndex).toBe(2);
    state = sequenceMemoryGameReducer(state, { type: 'reveal-tick' });
    expect(state.phase).toBe('input');
    expect(state.revealedIndex).toBe(-1);
  });

  it('is ignored outside the reveal phase or while paused', () => {
    const inInput = revealAll(startSession('r'));
    expect(sequenceMemoryGameReducer(inInput, { type: 'reveal-tick' }).phase).toBe('input');
    const paused = sequenceMemoryGameReducer(startSession('r'), { type: 'pause' });
    expect(sequenceMemoryGameReducer(paused, { type: 'reveal-tick' }).revealedIndex).toBe(0);
  });
});

describe('tap-tile', () => {
  it('validates taps against the sequence and completes the round', () => {
    let state = revealAll(startSession('tap', 'easy')); // length 2
    const [t0, t1] = state.sequence;
    state = sequenceMemoryGameReducer(state, { type: 'tap-tile', index: t0 });
    expect(state.phase).toBe('input');
    expect(state.inputIndex).toBe(1);
    expect(state.stats.correctTaps).toBe(1);
    state = sequenceMemoryGameReducer(state, { type: 'tap-tile', index: t1 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.longestSequence).toBe(2);
    expect(state.stats.score).toBe(100);
  });

  it('fails the round immediately on a wrong tap', () => {
    let state = revealAll(startSession('tap-wrong'));
    const wrong = (state.sequence[0] + 1) % 4;
    state = sequenceMemoryGameReducer(state, { type: 'tap-tile', index: wrong });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.totalTaps).toBe(1);
  });

  it('is ignored during reveal / after the round ended / while paused', () => {
    let state = startSession('x');
    state = sequenceMemoryGameReducer(state, { type: 'tap-tile', index: 0 });
    expect(state.phase).toBe('reveal');

    // After the round result, further taps are ignored (no double counting).
    let ended = revealAll(startSession('x'));
    ended = sequenceMemoryGameReducer(ended, { type: 'tap-tile', index: -1 }); // wrong tap → failed
    expect(ended.phase).toBe('roundResult');
    ended = sequenceMemoryGameReducer(ended, { type: 'tap-tile', index: 0 });
    expect(ended.stats.roundsPlayed).toBe(1);
    expect(ended.stats.totalTaps).toBe(1);

    const paused = sequenceMemoryGameReducer(startSession('p'), { type: 'pause' });
    expect(sequenceMemoryGameReducer(paused, { type: 'tap-tile', index: 0 }).stats.totalTaps).toBe(0);
  });
});

describe('next-round', () => {
  it('escalates the length after a pass and regenerates a distinct sequence', () => {
    let state = passRound(startSession('escalate'));
    expect(state.roundOutcome).toBe('passed');
    state = sequenceMemoryGameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('reveal');
    expect(state.roundIndex).toBe(1);
    expect(state.length).toBe(4);
    expect(state.sequence).toHaveLength(4);
    expect(state.sequence).not.toEqual(state.prevSequence);
    expect(state.prevSequence).not.toBeNull();
  });

  it('restarts at the base length after a failure (classic Simon rule)', () => {
    let state = failRound(startSession('hold'));
    const failedSequence = state.sequence;
    state = sequenceMemoryGameReducer(state, { type: 'next-round' });
    expect(state.length).toBe(3);
    expect(state.roundIndex).toBe(1);
    // The failed sequence still constrains the next one (near-duplicate rule).
    expect(state.prevSequence).toEqual(failedSequence);
  });

  it('moves ±1 for adaptive', () => {
    let passed = passRound(startSession('ad', 'adaptive'));
    passed = sequenceMemoryGameReducer(passed, { type: 'next-round' });
    expect(passed.length).toBe(4);

    let failed = failRound(startSession('ad2', 'adaptive'));
    failed = sequenceMemoryGameReducer(failed, { type: 'next-round' });
    expect(failed.length).toBe(2); // minLength floor
  });

  it('is ignored outside the round result phase', () => {
    const inReveal = startSession('x');
    expect(sequenceMemoryGameReducer(inReveal, { type: 'next-round' }).phase).toBe('reveal');
  });
});

describe('time-up', () => {
  it('ends the session and counts the in-flight round as failed (reveal)', () => {
    const state = sequenceMemoryGameReducer(startSession('t'), { type: 'time-up' });
    expect(state.phase).toBe('results');
    expect(state.timeUp).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('ends the session and counts the in-flight round as failed (input)', () => {
    let state = revealAll(startSession('t2'));
    state = sequenceMemoryGameReducer(state, { type: 'tap-tile', index: state.sequence[0] });
    state = sequenceMemoryGameReducer(state, { type: 'time-up' });
    expect(state.phase).toBe('results');
    expect(state.timeUp).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
  });

  it('keeps an already-scored round result', () => {
    let state = passRound(startSession('t3'));
    expect(state.roundOutcome).toBe('passed');
    state = sequenceMemoryGameReducer(state, { type: 'time-up' });
    expect(state.phase).toBe('results');
    expect(state.timeUp).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
  });

  it('is ignored in the intro and results phases', () => {
    const intro = sequenceMemoryGameReducer(createInitialSequenceMemoryState(), { type: 'time-up' });
    expect(intro.phase).toBe('intro');
    const results = sequenceMemoryGameReducer(startSession('t4'), { type: 'time-up' });
    expect(sequenceMemoryGameReducer(results, { type: 'time-up' }).phase).toBe('results');
    expect(results.stats.roundsPlayed).toBe(1); // unchanged by the second dispatch
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = sequenceMemoryGameReducer(createInitialSequenceMemoryState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = sequenceMemoryGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = sequenceMemoryGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(sequenceMemoryGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = sequenceMemoryGameReducer(startSession('p'), { type: 'pause' });
    state = sequenceMemoryGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = sequenceMemoryGameReducer(createInitialSequenceMemoryState(), {
      type: 'tutorial-open',
    });
    expect(opened.tutorialOpen).toBe(true);
    expect(sequenceMemoryGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = sequenceMemoryGameReducer(createInitialSequenceMemoryState(), {
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
    let state = sequenceMemoryGameReducer(createInitialSequenceMemoryState(), {
      type: 'persistence-started',
    });
    expect(state.persistState).toBe('started');
    state = sequenceMemoryGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      sequenceMemoryGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session with the in-flight round passed', () => {
    const state = sequenceMemoryGameReducer(revealAll(startSession('qa-win')), {
      type: 'qa/force-win',
    });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.timeUp).toBe(false);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.score).toBe(100); // normal base length 3
  });

  it('force-win from a scored round keeps the recorded outcome', () => {
    let state = passRound(startSession('qa-win2'));
    expect(state.stats.roundsPlayed).toBe(1);
    state = sequenceMemoryGameReducer(state, { type: 'qa/force-win' });
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.forced).toBe(true);
  });

  it('force-lose ends the session with the current round failed', () => {
    const midReveal = startSession('qa-lose');
    const state = sequenceMemoryGameReducer(midReveal, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = passRound(startSession('qa-lose2'));
    expect(state.roundOutcome).toBe('passed');
    const result = sequenceMemoryGameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsPassed).toBe(1);
    expect(result.forced).toBe(true);
  });

  it('force-perfect ends the session with the canonical perfect-run statistics', () => {
    const state = sequenceMemoryGameReducer(startSession('qa-perfect'), {
      type: 'qa/force-perfect',
    });
    const params = SEQUENCE_MEMORY_DIFFICULTY_PARAMS.normal;
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(perfectClimbRounds(params));
    expect(state.stats.roundsPassed).toBe(perfectClimbRounds(params));
    expect(state.stats.score).toBe(perfectSessionScore(params));
    expect(state.stats.longestSequence).toBe(params.maxLength);
    expect(state.stats.totalTaps).toBe(perfectClimbTaps(params));
    expect(state.stats.correctTaps).toBe(perfectClimbTaps(params));
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = sequenceMemoryGameReducer(createInitialSequenceMemoryState(), {
      type: 'qa/force-win',
    });
    expect(intro.phase).toBe('intro');
    const results = sequenceMemoryGameReducer(revealAll(startSession('q')), {
      type: 'qa/force-win',
    });
    const after = sequenceMemoryGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = sequenceMemoryGameReducer(createInitialSequenceMemoryState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = sequenceMemoryGameReducer(createInitialSequenceMemoryState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = sequenceMemoryGameReducer(createInitialSequenceMemoryState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = sequenceMemoryGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
