// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { speedGameReducer } from '../reducer';
import { createInitialSpeedState } from '../types';
import type { SpeedGameState } from '../types';
import { generateRoundDelay } from '../generator';
import { perfectSessionScore } from '../scoring';
import { ADAPTIVE_PARAMS, SPEED_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): SpeedGameState {
  let state = createInitialSpeedState();
  state = speedGameReducer(state, { type: 'select-difficulty', level });
  state = speedGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

/** Show the GO signal at a fixed monotonic clock reading. */
function go(state: SpeedGameState, goAtMs = 1000): SpeedGameState {
  return speedGameReducer(state, { type: 'go', goAtMs });
}

/** Finish the current round with a valid reaction. */
function react(state: SpeedGameState, rtMs: number): SpeedGameState {
  return speedGameReducer(go(state), { type: 'tap', rtMs });
}

/** Expected delay for a round, mirroring the reducer's generator call. */
function expectedDelay(seed: string, roundIndex: number, minDelayMs: number, maxDelayMs: number): number {
  return generateRoundDelay({
    rng: createRng(seed),
    roundIndex,
    minDelayMs,
    maxDelayMs,
  });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = speedGameReducer(createInitialSpeedState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = speedGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the wait phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('wait');
    expect(state.profile?.level).toBe('normal');
    expect(state.delayMinMs).toBe(SPEED_DIFFICULTY_PARAMS.normal.minDelayMs);
    expect(state.goAtMs).toBeNull();
    expect(state.stats).toEqual({
      reactions: [],
      roundsPlayed: 0,
      roundsPassed: 0,
      falseStarts: 0,
      timeouts: 0,
      bestReactionMs: null,
      medianReactionMs: null,
      meanReactionMs: null,
      falseStartAborted: false,
      score: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same delay for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.delayMs).toBe(b.delayMs);
    expect(a.delayMs).toBe(
      expectedDelay('det', 0, SPEED_DIFFICULTY_PARAMS.normal.minDelayMs, SPEED_DIFFICULTY_PARAMS.normal.maxDelayMs),
    );
  });

  it('draws the delay inside the selected difficulty range', () => {
    const easy = startSession('e', 'easy');
    expect(easy.delayMs).toBeGreaterThanOrEqual(SPEED_DIFFICULTY_PARAMS.easy.minDelayMs);
    expect(easy.delayMs).toBeLessThanOrEqual(SPEED_DIFFICULTY_PARAMS.easy.maxDelayMs);
    const expert = startSession('x', 'expert');
    expect(expert.profile?.parameters.rounds).toBe(15);
  });
});

describe('go', () => {
  it('moves wait → go and records the displayed-at timestamp', () => {
    const state = go(startSession('g'));
    expect(state.phase).toBe('go');
    expect(state.goAtMs).toBe(1000);
  });

  it('is ignored outside wait/go', () => {
    const inIntro = speedGameReducer(createInitialSpeedState(), { type: 'go', goAtMs: 5 });
    expect(inIntro.phase).toBe('intro');
    const inResult = speedGameReducer(react(startSession('g'), 400), { type: 'go', goAtMs: 5 });
    expect(inResult.phase).toBe('roundResult');
  });
});

describe('tap', () => {
  it('records an elite reaction as a passed round with 150 points', () => {
    const state = react(startSession('t'), 400);
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.stats.reactions).toEqual([400]);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.bestReactionMs).toBe(400);
    expect(state.stats.medianReactionMs).toBe(400);
    expect(state.stats.meanReactionMs).toBe(400);
    expect(state.stats.score).toBe(150);
  });

  it('records a pass at up to passMs (100 points) and a failure beyond it', () => {
    const passed = react(startSession('t2'), 550);
    expect(passed.roundOutcome).toBe('passed');
    expect(passed.stats.score).toBe(100);
    const failed = react(startSession('t3'), 700);
    expect(failed.roundOutcome).toBe('failed');
    expect(failed.stats.roundsPassed).toBe(0);
    expect(failed.stats.score).toBe(0);
  });

  it('is ignored during wait, after the round ended, and for negative readings', () => {
    const inWait = speedGameReducer(startSession('x'), { type: 'tap', rtMs: 400 });
    expect(inWait.phase).toBe('wait');

    let ended = react(startSession('x'), 700); // failed
    ended = speedGameReducer(ended, { type: 'tap', rtMs: 300 });
    expect(ended.stats.roundsPlayed).toBe(1);
    expect(ended.stats.reactions).toEqual([700]); // late taps never double-count

    const negative = speedGameReducer(go(startSession('x')), { type: 'tap', rtMs: -5 });
    expect(negative.stats.roundsPlayed).toBe(0);
    expect(negative.phase).toBe('go');
  });
});

describe('false-start', () => {
  it('fails the round but stays within the session when the budget holds', () => {
    let state = startSession('fs', 'easy'); // budget 2
    state = speedGameReducer(state, { type: 'false-start' });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('false-start');
    expect(state.stats.falseStarts).toBe(1);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.falseStartAborted).toBe(false);
  });

  it('ends the session when the budget is exceeded', () => {
    let state = startSession('fs2', 'normal'); // budget 1
    state = speedGameReducer(state, { type: 'false-start' });
    expect(state.phase).toBe('roundResult');
    state = speedGameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('wait');
    state = speedGameReducer(state, { type: 'false-start' });
    expect(state.phase).toBe('results');
    expect(state.stats.falseStartAborted).toBe(true);
    expect(state.stats.falseStarts).toBe(2);
    expect(state.stats.roundsPlayed).toBe(2);
  });

  it('is ignored after the GO signal', () => {
    const state = speedGameReducer(go(startSession('x')), { type: 'false-start' });
    expect(state.phase).toBe('go');
    expect(state.stats.falseStarts).toBe(0);
  });
});

describe('round-timeout', () => {
  it('fails the round when no tap arrives in time', () => {
    const state = speedGameReducer(go(startSession('to')), { type: 'round-timeout' });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('timeout');
    expect(state.stats.timeouts).toBe(1);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.reactions).toEqual([]);
  });

  it('is ignored outside the go phase', () => {
    const state = speedGameReducer(startSession('to2'), { type: 'round-timeout' });
    expect(state.phase).toBe('wait');
    expect(state.stats.timeouts).toBe(0);
  });
});

describe('next-round', () => {
  it('regenerates the delay for the next round (fixed levels keep the range)', () => {
    let state = react(startSession('nr'), 400);
    expect(state.roundOutcome).toBe('passed');
    const delayBefore = state.delayMs;
    state = speedGameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('wait');
    expect(state.roundIndex).toBe(1);
    expect(state.delayMinMs).toBe(SPEED_DIFFICULTY_PARAMS.normal.minDelayMs);
    expect(state.delayMs).toBe(
      expectedDelay('nr', 1, SPEED_DIFFICULTY_PARAMS.normal.minDelayMs, SPEED_DIFFICULTY_PARAMS.normal.maxDelayMs),
    );
    expect(state.delayMs).not.toBe(delayBefore);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 8 rounds
    for (let round = 0; round < 8; round += 1) {
      state = react(state, 400);
      state = speedGameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(8);
    expect(state.stats.roundsPassed).toBe(8);
    expect(state.stats.score).toBe(perfectSessionScore(SPEED_DIFFICULTY_PARAMS.easy));
  });

  it('is ignored outside the round-result phase', () => {
    const state = speedGameReducer(startSession('x'), { type: 'next-round' });
    expect(state.roundIndex).toBe(0);
    expect(state.phase).toBe('wait');
  });
});

describe('adaptive delay adjustment', () => {
  it('tightens the window after a pass and loosens it after a failure', () => {
    let state = startSession('ad', 'adaptive');
    expect(state.delayMinMs).toBe(ADAPTIVE_PARAMS.minDelayMs); // 1000

    state = react(state, 400); // passed
    state = speedGameReducer(state, { type: 'next-round' });
    expect(state.delayMinMs).toBe(1000 - (ADAPTIVE_PARAMS.delayStepMs ?? 150)); // 850

    state = speedGameReducer(go(state), { type: 'tap', rtMs: 700 }); // failed
    state = speedGameReducer(state, { type: 'next-round' });
    expect(state.delayMinMs).toBe(1000); // 850 + 150
  });

  it('clamps the adjusted minimum inside the adaptive bounds', () => {
    let state = startSession('ad2', 'adaptive');
    state = react(state, 400);
    state = speedGameReducer(state, { type: 'next-round' }); // 1000 - 150 = 850
    state = react(state, 400);
    state = speedGameReducer(state, { type: 'next-round' }); // 850 - 150 = 700
    state = react(state, 400);
    state = speedGameReducer(state, { type: 'next-round' }); // 700 - 150 = 550 → clamped
    expect(state.delayMinMs).toBe(600); // minDelayBoundMs
    expect(state.phase).toBe('wait');
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = speedGameReducer(createInitialSpeedState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = speedGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = speedGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(speedGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = speedGameReducer(startSession('p'), { type: 'pause' });
    state = speedGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = speedGameReducer(createInitialSpeedState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(speedGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = speedGameReducer(createInitialSpeedState(), {
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
    let state = speedGameReducer(createInitialSpeedState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = speedGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      speedGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = speedGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(10);
    expect(state.stats.roundsPassed).toBe(10);
    expect(state.stats.falseStarts).toBe(0);
    expect(state.stats.medianReactionMs).toBe(400);
    expect(state.stats.score).toBe(perfectSessionScore(SPEED_DIFFICULTY_PARAMS.normal));
  });

  it('force-lose ends the session with a false-start storm', () => {
    const state = speedGameReducer(startSession('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.falseStartAborted).toBe(true);
    expect(state.stats.falseStarts).toBe(SPEED_DIFFICULTY_PARAMS.normal.falseStartBudget + 1);
    expect(state.stats.roundsPlayed).toBe(10);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.reactions).toEqual([]);
    expect(state.stats.score).toBe(0);
  });

  it('force-timeout fails the current round without ending the session', () => {
    const inWait = speedGameReducer(startSession('qa-to'), { type: 'qa/force-timeout' });
    expect(inWait.phase).toBe('roundResult');
    expect(inWait.roundOutcome).toBe('timeout');
    expect(inWait.stats.timeouts).toBe(1);
    expect(inWait.stats.roundsPlayed).toBe(1);
    expect(inWait.forced).toBe(false); // session continues; not a forced end

    const inGo = speedGameReducer(go(startSession('qa-to2')), { type: 'qa/force-timeout' });
    expect(inGo.phase).toBe('roundResult');
    expect(inGo.roundOutcome).toBe('timeout');

    const inResult = speedGameReducer(react(startSession('qa-to3'), 400), { type: 'qa/force-timeout' });
    expect(inResult.phase).toBe('roundResult');
    expect(inResult.roundOutcome).toBe('passed'); // unchanged
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = speedGameReducer(createInitialSpeedState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    let results = react(startSession('q'), 400);
    results = speedGameReducer(results, { type: 'next-round' });
    for (let round = 1; round < 10; round += 1) {
      results = react(results, 400);
      results = speedGameReducer(results, { type: 'next-round' });
    }
    expect(results.phase).toBe('results');
    const after = speedGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(false); // already terminal → untouched
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = speedGameReducer(createInitialSpeedState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = speedGameReducer(createInitialSpeedState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = speedGameReducer(createInitialSpeedState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = speedGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
