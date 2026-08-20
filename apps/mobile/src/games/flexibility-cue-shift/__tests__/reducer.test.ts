// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import { flexibilityCueReducer } from '../reducer';
import { createInitialFlexibilityCueState } from '../types';
import type { FlexibilityCueGameState } from '../types';
import { generateSession } from '../generator';
import { perfectSessionScore, roundScore } from '../scoring';
import { FLEXIBILITY_CUE_DIFFICULTY_PARAMS, flexibilityCueParamsForLevel } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): FlexibilityCueGameState {
  let state = createInitialFlexibilityCueState();
  state = flexibilityCueReducer(state, { type: 'select-difficulty', level });
  state = flexibilityCueReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

function correctPick(state: FlexibilityCueGameState, responseMs = 0): FlexibilityCueGameState {
  return flexibilityCueReducer(state, {
    type: 'pick-card',
    index: state.round?.correctIndex ?? 0,
    responseMs,
  });
}

function wrongPick(state: FlexibilityCueGameState, responseMs = 0): FlexibilityCueGameState {
  const wrong = ((state.round?.correctIndex ?? 0) + 1) % 4;
  return flexibilityCueReducer(state, { type: 'pick-card', index: wrong, responseMs });
}

function next(state: FlexibilityCueGameState): FlexibilityCueGameState {
  return flexibilityCueReducer(state, { type: 'next-round' });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = flexibilityCueReducer(createInitialFlexibilityCueState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = flexibilityCueReducer(startSession('x'), {
      type: 'select-difficulty',
      level: 'easy',
    });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens trial 1 in trialActive', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('trialActive');
    expect(state.profile?.level).toBe('normal');
    expect(state.round).not.toBeNull();
    expect(state.round?.candidates).toHaveLength(4);
    expect(state.roundIndex).toBe(0);
    expect(state.rounds).toBe(FLEXIBILITY_CUE_DIFFICULTY_PARAMS.normal.rounds);
    expect(state.lastPickIndex).toBe(-1);
    expect(state.plan).toHaveLength(FLEXIBILITY_CUE_DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      correctPicks: 0,
      mistakes: 0,
      bestStreak: 0,
      streak: 0,
      totalResponseMs: 0,
      scoredPicks: 0,
      switchPlayed: 0,
      switchCorrect: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('opens with the seed-derived plan and generates trial 1 deterministically', () => {
    const a = startSession('det');
    const b = startSession('det');
    const plan = generateSession('det', flexibilityCueParamsForLevel('normal'));
    expect(a.rule).toBe(plan[0].rule);
    expect(a.round).toEqual(plan[0]);
    expect(a.round).toEqual(b.round);
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.rounds).toBe(12);
    expect(expert.profile?.parameters.numShapes).toBe(4);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.rounds).toBe(10);
    expect(adaptive.profile?.parameters.switchRate).toBe(0.5);
  });
});

describe('pick-card', () => {
  it('scores a correct pick with the speed bonus', () => {
    let state = startSession('pick-c');
    const speedTargetMs = 5000;
    state = flexibilityCueReducer(state, { type: 'pick-card', index: state.round!.correctIndex, responseMs: 1000 });
    expect(state.phase).toBe('trialResult');
    expect(state.roundOutcome).toBe('correct');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(1);
    expect(state.stats.mistakes).toBe(0);
    expect(state.stats.scoredPicks).toBe(1);
    expect(state.stats.totalResponseMs).toBe(1000);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.score).toBe(roundScore(true, 1000, speedTargetMs));
    expect(state.lastPickIndex).toBe(state.round!.correctIndex);
  });

  it('penalizes a wrong pick: 0 score, mistake counted, streak reset', () => {
    const state = wrongPick(startSession('pick-w'), 500);
    expect(state.phase).toBe('trialResult');
    expect(state.roundOutcome).toBe('wrong');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.score).toBe(0);
    expect(state.stats.totalResponseMs).toBe(500);
  });

  it('is ignored outside trialActive (result, paused, intro)', () => {
    const inResult = correctPick(startSession('r'));
    const afterResult = flexibilityCueReducer(inResult, { type: 'pick-card', index: 0, responseMs: 1 });
    expect(afterResult.stats.roundsPlayed).toBe(1);

    const paused = flexibilityCueReducer(startSession('p'), { type: 'pause' });
    const afterPaused = flexibilityCueReducer(paused, { type: 'pick-card', index: 0, responseMs: 1 });
    expect(afterPaused.stats.roundsPlayed).toBe(0);

    const intro = flexibilityCueReducer(createInitialFlexibilityCueState(), {
      type: 'pick-card',
      index: 0,
      responseMs: 1,
    });
    expect(intro.phase).toBe('intro');
  });

  it('counts rule-switch trials (the flexibility diagnostic)', () => {
    const plan = generateSession('ps', flexibilityCueParamsForLevel('normal'));
    const switchIndex = plan.findIndex((r) => r.isSwitch);
    expect(switchIndex).toBeGreaterThan(0);
    let state = startSession('ps');
    for (let i = 0; i < switchIndex; i += 1) {
      state = next(correctPick(state));
    }
    // Now on the switch trial (trialActive).
    expect(state.round?.isSwitch).toBe(true);
    state = correctPick(state, 0);
    expect(state.stats.switchPlayed).toBe(1);
    expect(state.stats.switchCorrect).toBe(1);
    expect(state.stats.switchCorrect).toBeLessThanOrEqual(state.stats.switchPlayed);

    let state2 = startSession('ps');
    for (let i = 0; i < switchIndex; i += 1) {
      state2 = next(correctPick(state2));
    }
    state2 = wrongPick(state2);
    expect(state2.stats.switchPlayed).toBe(1);
    expect(state2.stats.switchCorrect).toBe(0);
  });
});

describe('next-round', () => {
  it('continues to the next trial: next index, new round generated', () => {
    let state = startSession('nr');
    const firstTarget = state.round!.target;
    const firstRule = state.rule;
    state = next(correctPick(state));
    expect(state.phase).toBe('trialActive');
    expect(state.roundIndex).toBe(1);
    expect(state.rule).toBe(state.round?.rule);
    expect(state.round?.rule).toBe(firstRule); // rule may or may not switch; must match stored rule
    expect(state.round?.target).not.toEqual(firstTarget);
    expect(state.prevTarget).toEqual(firstTarget);
    expect(state.lastPickIndex).toBe(-1);
  });

  it('moves to results after the final trial', () => {
    const plan = generateSession('final', flexibilityCueParamsForLevel('easy'));
    let state = startSession('final', 'easy');
    for (let round = 0; round < plan.length; round += 1) {
      state = next(correctPick(state));
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(plan.length);
    expect(state.stats.correctPicks).toBe(plan.length);
    expect(state.stats.score).toBe(perfectSessionScore(FLEXIBILITY_CUE_DIFFICULTY_PARAMS.easy));
    const switchCount = plan.filter((r) => r.isSwitch).length;
    expect(state.stats.switchPlayed).toBe(switchCount);
    expect(state.stats.switchCorrect).toBe(switchCount);
  });

  it('is ignored outside trialResult', () => {
    const inActive = startSession('n');
    const after = flexibilityCueReducer(inActive, { type: 'next-round' });
    expect(after.roundIndex).toBe(0);
  });
});

describe('pause / resume', () => {
  it('pauses during a session phase and resumes from paused', () => {
    const inActive = flexibilityCueReducer(startSession('p'), { type: 'pause' });
    expect(inActive.paused).toBe(true);
    const resumed = flexibilityCueReducer(inActive, { type: 'resume' });
    expect(resumed.paused).toBe(false);
    expect(flexibilityCueReducer(resumed, { type: 'resume' }).paused).toBe(false);

    const inResult = correctPick(startSession('p2'));
    expect(flexibilityCueReducer(inResult, { type: 'pause' }).paused).toBe(true);
  });

  it('cannot pause in the intro or on results, or twice', () => {
    const inIntro = flexibilityCueReducer(createInitialFlexibilityCueState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = flexibilityCueReducer(startSession('p4'), { type: 'pause' });
    state = flexibilityCueReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = flexibilityCueReducer(createInitialFlexibilityCueState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(flexibilityCueReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = flexibilityCueReducer(createInitialFlexibilityCueState(), {
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
    let state = flexibilityCueReducer(createInitialFlexibilityCueState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = flexibilityCueReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(flexibilityCueReducer(state, { type: 'persistence-succeeded' }).persistState).toBe(
      'succeeded',
    );
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const plan = generateSession('qa-win', flexibilityCueParamsForLevel('normal'));
    const state = flexibilityCueReducer(correctPick(startSession('qa-win')), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    const rounds = FLEXIBILITY_CUE_DIFFICULTY_PARAMS.normal.rounds;
    expect(state.stats.roundsPlayed).toBe(rounds);
    expect(state.stats.correctPicks).toBe(rounds);
    expect(state.stats.mistakes).toBe(0);
    expect(state.stats.score).toBe(perfectSessionScore(FLEXIBILITY_CUE_DIFFICULTY_PARAMS.normal));
    expect(state.stats.bestStreak).toBe(rounds);
    const switchCount = plan.filter((r) => r.isSwitch).length;
    expect(state.stats.switchPlayed).toBe(switchCount);
    expect(state.stats.switchCorrect).toBe(switchCount);
  });

  it('force-lose ends the session with the current trial failed', () => {
    const midRound = startSession('qa-lose');
    const state = flexibilityCueReducer(midRound, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored trial result keeps the recorded outcome', () => {
    const scored = correctPick(startSession('qa-lose2'));
    expect(scored.roundOutcome).toBe('correct');
    const state = flexibilityCueReducer(scored, { type: 'qa/force-lose' });
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(1);
    expect(state.stats.mistakes).toBe(0);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = flexibilityCueReducer(createInitialFlexibilityCueState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = flexibilityCueReducer(correctPick(startSession('q')), { type: 'qa/force-win' });
    const after = flexibilityCueReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = flexibilityCueReducer(createInitialFlexibilityCueState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = flexibilityCueReducer(createInitialFlexibilityCueState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = flexibilityCueReducer(createInitialFlexibilityCueState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = flexibilityCueReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
