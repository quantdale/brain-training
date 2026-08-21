// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import { flexibilityTaskSwitchParamsFromProfile, resolveFlexibilityTaskSwitchDifficulty } from '../difficulty';
import { generateSession } from '../generator';
import { perfectSessionScore, roundScore } from '../scoring';
import { flexibilityTaskSwitchReducer, createInitialFlexibilityTaskSwitchState } from '../reducer';
import { INITIAL_STATS } from '../types';
import type { FlexibilityTaskSwitchGameState, QaForceStatePatch } from '../types';

const NORMAL = flexibilityTaskSwitchParamsFromProfile(
  resolveFlexibilityTaskSwitchDifficulty('normal'),
);

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): FlexibilityTaskSwitchGameState {
  let state = createInitialFlexibilityTaskSwitchState();
  state = flexibilityTaskSwitchReducer(state, { type: 'select-difficulty', level });
  state = flexibilityTaskSwitchReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
  });
  return state;
}

/** Answer every remaining round correctly with the given response time. */
function playPerfectly(
  state: FlexibilityTaskSwitchGameState,
  responseMs = 0,
): FlexibilityTaskSwitchGameState {
  let current = state;
  while (current.phase !== 'results') {
    if (current.phase === 'trialActive' && current.round !== null) {
      current = flexibilityTaskSwitchReducer(current, {
        type: 'answer',
        index: current.round.correctIndex,
        responseMs,
      });
    }
    current = flexibilityTaskSwitchReducer(current, { type: 'next-round' });
  }
  return current;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = flexibilityTaskSwitchReducer(createInitialFlexibilityTaskSwitchState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = flexibilityTaskSwitchReducer(startSession('x'), {
      type: 'select-difficulty',
      level: 'easy',
    });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('opens trial 1 with a valid plan and records session identity', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('trialActive');
    expect(state.profile?.level).toBe('normal');
    expect(state.rounds).toBe(NORMAL.rounds);
    expect(state.plan).toEqual(generateSession('seed-1', NORMAL));
    expect(state.round).toEqual(state.plan[0]);
    expect(state.roundIndex).toBe(0);
    expect(state.prevTask).toBeNull();
    expect(state.stats).toEqual(INITIAL_STATS);
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('determinism: same seed → same plan', () => {
    expect(startSession('det').plan).toEqual(startSession('det').plan);
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.rounds).toBe(14);
    expect(expert.profile?.parameters.task_color).toBe(1);
    const easy = startSession('e2', 'easy');
    expect(easy.rounds).toBe(10);
  });

  it('is ignored without a selected difficulty', () => {
    const state = flexibilityTaskSwitchReducer(
      { ...createInitialFlexibilityTaskSwitchState(), difficulty: null },
      { type: 'start-session', seed: 'x', sessionId: 's', startedAtMs: 0 },
    );
    expect(state.phase).toBe('intro');
  });
});

describe('answer', () => {
  it('scores a correct pick and moves to the result phase', () => {
    const started = startSession('correct');
    const round = started.round!;
    const state = flexibilityTaskSwitchReducer(started, {
      type: 'answer',
      index: round.correctIndex,
      responseMs: 100,
    });
    expect(state.phase).toBe('trialResult');
    expect(state.roundOutcome).toBe('correct');
    expect(state.lastPickIndex).toBe(round.correctIndex);
    expect(state.lastResponseMs).toBe(100);
    expect(state.stats.correctPicks).toBe(1);
    expect(state.stats.mistakes).toBe(0);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.score).toBeCloseTo(roundScore(true, 100, NORMAL.speedTargetMs));
  });

  it('counts a wrong pick as a mistake and resets the streak', () => {
    const started = startSession('wrong');
    const round = started.round!;
    const wrongIndex = (round.correctIndex + 1) % round.options.length;
    let state = flexibilityTaskSwitchReducer(started, {
      type: 'answer',
      index: wrongIndex,
      responseMs: 500,
    });
    expect(state.phase).toBe('trialResult');
    expect(state.roundOutcome).toBe('wrong');
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.score).toBe(0);

    // Recover on the next trial to prove the streak restarts.
    state = flexibilityTaskSwitchReducer(state, { type: 'next-round' });
    state = flexibilityTaskSwitchReducer(state, {
      type: 'answer',
      index: state.round!.correctIndex,
      responseMs: 0,
    });
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
  });

  it('buckets switch and repeat trials by the plan flags', () => {
    const seed = 'buckets';
    const plan = generateSession(seed, NORMAL);
    const switchCount = plan.filter((r) => r.isSwitch).length;
    expect(switchCount).toBeGreaterThan(0);
    expect(switchCount).toBeLessThan(plan.length - 1); // both buckets populated

    const final = playPerfectly(startSession(seed), 100);
    expect(final.stats.roundsPlayed).toBe(plan.length);
    expect(final.stats.correctPicks).toBe(plan.length);
    expect(final.stats.switchPlayed).toBe(switchCount);
    expect(final.stats.switchCorrect).toBe(switchCount);
    expect(final.stats.repeatPlayed).toBe(plan.length - switchCount);
    expect(final.stats.repeatCorrect).toBe(plan.length - switchCount);
    expect(final.stats.switchRtSum).toBe(switchCount * 100);
    expect(final.stats.switchRtCount).toBe(switchCount);
    expect(final.stats.repeatRtSum).toBe((plan.length - switchCount) * 100);
    expect(final.stats.repeatRtCount).toBe(plan.length - switchCount);
  });

  it('is ignored outside trialActive or while paused (no double counting)', () => {
    const started = startSession('guard');
    // Intro phase.
    const intro = flexibilityTaskSwitchReducer(createInitialFlexibilityTaskSwitchState(), {
      type: 'answer',
      index: 0,
      responseMs: 10,
    });
    expect(intro.stats.roundsPlayed).toBe(0);
    // Paused.
    const paused = flexibilityTaskSwitchReducer(started, { type: 'pause' });
    expect(
      flexibilityTaskSwitchReducer(paused, { type: 'answer', index: 0, responseMs: 10 }).stats
        .roundsPlayed,
    ).toBe(0);
    // Already answered (trialResult).
    const answered = flexibilityTaskSwitchReducer(started, {
      type: 'answer',
      index: started.round!.correctIndex,
      responseMs: 10,
    });
    const replayed = flexibilityTaskSwitchReducer(answered, {
      type: 'answer',
      index: answered.round!.correctIndex,
      responseMs: 10,
    });
    expect(replayed.stats.roundsPlayed).toBe(1);
  });
});

describe('next-round', () => {
  it('advances to the next planned trial and tracks prevTask', () => {
    const started = startSession('advance');
    let state = flexibilityTaskSwitchReducer(started, {
      type: 'answer',
      index: started.round!.correctIndex,
      responseMs: 0,
    });
    state = flexibilityTaskSwitchReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('trialActive');
    expect(state.roundIndex).toBe(1);
    expect(state.round).toEqual(started.plan[1]);
    expect(state.prevTask).toBe(started.plan[0].task);
    expect(state.roundOutcome).toBeNull();
    expect(state.lastPickIndex).toBe(-1);
  });

  it('moves to results after the final trial', () => {
    const final = playPerfectly(startSession('final', 'easy'));
    expect(final.phase).toBe('results');
    expect(final.round).toBeNull();
    expect(final.stats.roundsPlayed).toBe(10);
    expect(final.stats.score).toBe(perfectSessionScore(flexibilityTaskSwitchParamsFromProfile(resolveFlexibilityTaskSwitchDifficulty('easy'))));
  });

  it('is ignored outside trialResult', () => {
    const started = startSession('nr-guard');
    expect(flexibilityTaskSwitchReducer(started, { type: 'next-round' }).roundIndex).toBe(0);
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const intro = flexibilityTaskSwitchReducer(createInitialFlexibilityTaskSwitchState(), {
      type: 'pause',
    });
    expect(intro.paused).toBe(false);
    let state = flexibilityTaskSwitchReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = flexibilityTaskSwitchReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(flexibilityTaskSwitchReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('blocks answers while paused and ignores double pause', () => {
    const paused = flexibilityTaskSwitchReducer(startSession('pp'), { type: 'pause' });
    expect(
      flexibilityTaskSwitchReducer(paused, { type: 'answer', index: 0, responseMs: 5 }).stats
        .roundsPlayed,
    ).toBe(0);
    expect(flexibilityTaskSwitchReducer(paused, { type: 'pause' }).paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial overlay', () => {
    let state = flexibilityTaskSwitchReducer(createInitialFlexibilityTaskSwitchState(), {
      type: 'tutorial-open',
    });
    expect(state.tutorialOpen).toBe(true);
    state = flexibilityTaskSwitchReducer(state, { type: 'tutorial-close' });
    expect(state.tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = flexibilityTaskSwitchReducer(createInitialFlexibilityTaskSwitchState(), {
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
    expect(state.pausedDurationMs).toBe(2_000);
    expect(state.completedAtMs).toBe(30_100);
  });

  it('tracks persistence progress and failures', () => {
    let state = flexibilityTaskSwitchReducer(createInitialFlexibilityTaskSwitchState(), {
      type: 'persistence-started',
    });
    expect(state.persistState).toBe('started');
    state = flexibilityTaskSwitchReducer(state, {
      type: 'persistence-failed',
      message: 'boom',
    });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      flexibilityTaskSwitchReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });

  it('stores the authoritative completion outcome', () => {
    const state = flexibilityTaskSwitchReducer(createInitialFlexibilityTaskSwitchState(), {
      type: 'completion-outcome-received',
      xp: 30,
      currency: 5,
      deltas: [{ domain: 'Flexibility', delta: 4, ratingAfter: 1004 }],
    });
    expect(state.authoritativeXp).toBe(30);
    expect(state.authoritativeCurrency).toBe(5);
    expect(state.authoritativeDeltas).toHaveLength(1);
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run matching the plan', () => {
    const state = flexibilityTaskSwitchReducer(startSession('qa-win'), {
      type: 'qa/force-win',
    });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(NORMAL.rounds);
    expect(state.stats.correctPicks).toBe(NORMAL.rounds);
    expect(state.stats.mistakes).toBe(0);
    expect(state.stats.score).toBe(perfectSessionScore(NORMAL));
    const switchCount = state.plan.filter((r) => r.isSwitch).length;
    expect(state.stats.switchPlayed).toBe(switchCount);
    expect(state.stats.switchCorrect).toBe(switchCount);
    expect(state.stats.repeatPlayed).toBe(NORMAL.rounds - switchCount);
    expect(state.stats.repeatCorrect).toBe(NORMAL.rounds - switchCount);
  });

  it('force-lose counts an in-flight trial as a mistake', () => {
    const state = flexibilityTaskSwitchReducer(startSession('qa-lose'), {
      type: 'qa/force-lose',
    });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
    expect(state.stats.scoredPicks).toBe(1);
  });

  it('force-lose keeps already-scored trials and adds nothing in trialResult', () => {
    const started = startSession('qa-lose-mid');
    const answered = flexibilityTaskSwitchReducer(started, {
      type: 'answer',
      index: started.round!.correctIndex,
      responseMs: 0,
    });
    const state = flexibilityTaskSwitchReducer(answered, { type: 'qa/force-lose' });
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(1);
    expect(state.stats.mistakes).toBe(0);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = flexibilityTaskSwitchReducer(createInitialFlexibilityTaskSwitchState(), {
      type: 'qa/force-win',
    });
    expect(intro.phase).toBe('intro');
    const finished = playPerfectly(startSession('done'));
    expect(flexibilityTaskSwitchReducer(finished, { type: 'qa/force-lose' })).toBe(finished);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = flexibilityTaskSwitchReducer(createInitialFlexibilityTaskSwitchState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');

    // Invalid difficulty values are ignored; seeds are stringified. The cast
    // simulates untrusted QA input that the runtime isDifficultyLevel guard
    // rejects.
    state = flexibilityTaskSwitchReducer(createInitialFlexibilityTaskSwitchState(), {
      type: 'qa/force-state',
      patch: { seed: 42, difficulty: 'impossible' } as unknown as QaForceStatePatch,
    });
    expect(state.seedOverride).toBe('42');
    expect(state.difficulty).toBe('normal');

    const mid = flexibilityTaskSwitchReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
