// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { flexibilityGameReducer } from '../reducer';
import { createInitialFlexibilityState } from '../types';
import type { FlexibilityGameState } from '../types';
import { otherRule } from '../types';
import { generateRound, pickInitialRule } from '../generator';
import { perfectSessionScore, roundScore } from '../scoring';
import { FLEXIBILITY_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): FlexibilityGameState {
  let state = createInitialFlexibilityState();
  state = flexibilityGameReducer(state, { type: 'select-difficulty', level });
  state = flexibilityGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

function correctPick(state: FlexibilityGameState, responseMs = 0): FlexibilityGameState {
  return flexibilityGameReducer(state, {
    type: 'pick-card',
    index: state.round?.correctIndex ?? 0,
    responseMs,
  });
}

function wrongPick(state: FlexibilityGameState, responseMs = 0): FlexibilityGameState {
  const wrong = ((state.round?.correctIndex ?? 0) + 1) % 4;
  return flexibilityGameReducer(state, { type: 'pick-card', index: wrong, responseMs });
}

function next(state: FlexibilityGameState): FlexibilityGameState {
  return flexibilityGameReducer(state, { type: 'next-round' });
}

function expireNotice(state: FlexibilityGameState): FlexibilityGameState {
  return flexibilityGameReducer(state, { type: 'notice-expired' });
}

/** Play `count` correct rounds (pick + next-round each). */
function playCorrectRounds(state: FlexibilityGameState, count: number): FlexibilityGameState {
  let current = state;
  for (let i = 0; i < count; i += 1) {
    current = next(correctPick(current));
  }
  return current;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = flexibilityGameReducer(createInitialFlexibilityState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = flexibilityGameReducer(startSession('x'), {
      type: 'select-difficulty',
      level: 'easy',
    });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in roundActive', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('roundActive');
    expect(state.profile?.level).toBe('normal');
    expect(state.round).not.toBeNull();
    expect(state.round?.candidates).toHaveLength(4);
    expect(state.roundIndex).toBe(0);
    expect(state.rounds).toBe(FLEXIBILITY_DIFFICULTY_PARAMS.normal.rounds);
    expect(state.switchEvery).toBe(FLEXIBILITY_DIFFICULTY_PARAMS.normal.switchEvery);
    expect(state.blockIndex).toBe(0);
    expect(state.roundsInBlock).toBe(0);
    expect(state.lastPickIndex).toBe(-1);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      correctPicks: 0,
      mistakes: 0,
      bestStreak: 0,
      streak: 0,
      totalResponseMs: 0,
      scoredPicks: 0,
      postSwitchPlayed: 0,
      postSwitchCorrect: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('opens with the seed-derived rule and generates round 1 deterministically', () => {
    const a = startSession('det');
    const b = startSession('det');
    const rule = pickInitialRule(createRng('det'));
    expect(a.rule).toBe(rule);
    expect(a.round).toEqual(b.round);
    expect(a.round).toEqual(
      generateRound({
        rng: createRng('det'),
        roundIndex: 0,
        rule,
        numShapes: 3,
        numColors: 3,
        prevTarget: null,
      }),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.rounds).toBe(12);
    expect(expert.switchEvery).toBe(1);
    expect(expert.profile?.parameters.numShapes).toBe(4);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.switchEvery).toBe(2);
  });
});

describe('pick-card', () => {
  it('scores a correct pick with the speed bonus', () => {
    let state = startSession('pick-c');
    const speedTargetMs = 5000;
    state = flexibilityGameReducer(state, { type: 'pick-card', index: state.round!.correctIndex, responseMs: 1000 });
    expect(state.phase).toBe('roundResult');
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
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('wrong');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.score).toBe(0);
    expect(state.stats.totalResponseMs).toBe(500);
  });

  it('is ignored outside roundActive (notice, result, paused)', () => {
    const inNotice = playCorrectRounds(startSession('x'), 3); // block of 3 done → notice
    expect(inNotice.phase).toBe('ruleSwitchNotice');
    const after = flexibilityGameReducer(inNotice, { type: 'pick-card', index: 0, responseMs: 1 });
    expect(after.phase).toBe('ruleSwitchNotice');

    const inResult = correctPick(startSession('r'));
    const afterResult = flexibilityGameReducer(inResult, { type: 'pick-card', index: 0, responseMs: 1 });
    expect(afterResult.stats.roundsPlayed).toBe(1);

    const paused = flexibilityGameReducer(startSession('p'), { type: 'pause' });
    const afterPaused = flexibilityGameReducer(paused, {
      type: 'pick-card',
      index: 0,
      responseMs: 1,
    });
    expect(afterPaused.stats.roundsPlayed).toBe(0);
  });

  it('counts post-switch rounds (the flexibility diagnostic)', () => {
    // easy: switchEvery 4 → after 4 correct rounds the rule switches.
    let state = playCorrectRounds(startSession('ps', 'easy'), 4);
    expect(state.phase).toBe('ruleSwitchNotice');
    state = expireNotice(state);
    expect(state.phase).toBe('roundActive');
    expect(state.blockIndex).toBe(1);
    expect(state.roundsInBlock).toBe(0);

    state = correctPick(state);
    expect(state.stats.postSwitchPlayed).toBe(1);
    expect(state.stats.postSwitchCorrect).toBe(1);
    expect(state.stats.postSwitchCorrect).toBeLessThanOrEqual(state.stats.postSwitchPlayed);

    // A wrong pick on a post-switch round counts the attempt but not the hit.
    let state2 = playCorrectRounds(startSession('ps2', 'easy'), 4);
    state2 = expireNotice(next(state2));
    state2 = wrongPick(state2);
    expect(state2.stats.postSwitchPlayed).toBe(1);
    expect(state2.stats.postSwitchCorrect).toBe(0);
  });
});

describe('next-round', () => {
  it('continues within a block: same rule, next round generated', () => {
    let state = startSession('nr');
    const firstTarget = state.round!.target;
    const firstRule = state.rule;
    state = next(correctPick(state));
    expect(state.phase).toBe('roundActive');
    expect(state.roundIndex).toBe(1);
    expect(state.roundsInBlock).toBe(1);
    expect(state.rule).toBe(firstRule);
    expect(state.round?.rule).toBe(firstRule);
    expect(state.round?.target).not.toEqual(firstTarget);
    expect(state.prevTarget).toEqual(firstTarget);
    expect(state.lastPickIndex).toBe(-1);
  });

  it('enters the rule-switch notice at a block boundary', () => {
    let state = playCorrectRounds(startSession('block', 'easy'), 4);
    expect(state.phase).toBe('ruleSwitchNotice');
    expect(state.rule).toBe(otherRule(pickInitialRule(createRng('block'))));
    expect(state.blockIndex).toBe(1);
    expect(state.roundsInBlock).toBe(0);
    expect(state.round).toBeNull();
    expect(state.roundOutcome).toBeNull();
    expect(state.roundIndex).toBe(4);
    expect(state.prevTarget).not.toBeNull();
  });

  it('adapts the switch frequency at a block boundary (adaptive)', () => {
    // adaptive: switchEvery 2; a perfect first block → 1 (harder).
    let state = playCorrectRounds(startSession('ad', 'adaptive'), 2);
    expect(state.phase).toBe('ruleSwitchNotice');
    expect(state.switchEvery).toBe(1);
    // a half-correct block → 3 (easier).
    let state2 = startSession('ad2', 'adaptive');
    state2 = next(correctPick(state2));
    state2 = next(wrongPick(state2));
    expect(state2.phase).toBe('ruleSwitchNotice');
    expect(state2.switchEvery).toBe(3);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 8 rounds, 4+4 with one notice
    for (let round = 0; round < 4; round += 1) {
      state = next(correctPick(state));
    }
    state = expireNotice(state);
    for (let round = 0; round < 4; round += 1) {
      state = next(correctPick(state));
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(8);
    expect(state.stats.correctPicks).toBe(8);
    expect(state.stats.score).toBe(perfectSessionScore(FLEXIBILITY_DIFFICULTY_PARAMS.easy));
    expect(state.stats.postSwitchPlayed).toBe(1);
    expect(state.stats.postSwitchCorrect).toBe(1);
  });

  it('is ignored outside roundResult', () => {
    const inActive = startSession('n');
    const after = flexibilityGameReducer(inActive, { type: 'next-round' });
    expect(after.roundIndex).toBe(0);
  });
});

describe('notice-expired / notice-continue', () => {
  it('generates the next round under the new rule on expiry', () => {
    let state = playCorrectRounds(startSession('ne', 'easy'), 4);
    const newRule = state.rule;
    expect(state.phase).toBe('ruleSwitchNotice');
    state = expireNotice(state);
    expect(state.phase).toBe('roundActive');
    expect(state.round?.rule).toBe(newRule);
    expect(state.roundIndex).toBe(4);
    expect(state.roundsInBlock).toBe(0);
    expect(state.round).not.toBeNull();
  });

  it('tap-to-continue behaves identically to expiry', () => {
    let state = playCorrectRounds(startSession('nc', 'easy'), 4);
    state = flexibilityGameReducer(state, { type: 'notice-continue' });
    expect(state.phase).toBe('roundActive');
    expect(state.round?.rule).toBe(otherRule(pickInitialRule(createRng('nc'))));
  });

  it('is ignored while paused', () => {
    let state = playCorrectRounds(startSession('np', 'easy'), 4);
    state = flexibilityGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
    const after = expireNotice(state);
    expect(after.phase).toBe('ruleSwitchNotice');
  });

  it('is ignored outside the notice phase', () => {
    const inActive = startSession('x');
    expect(expireNotice(inActive).phase).toBe('roundActive');
  });
});

describe('pause / resume', () => {
  it('pauses during any session phase and resumes from paused', () => {
    const inActive = flexibilityGameReducer(startSession('p'), { type: 'pause' });
    expect(inActive.paused).toBe(true);
    const resumed = flexibilityGameReducer(inActive, { type: 'resume' });
    expect(resumed.paused).toBe(false);
    expect(flexibilityGameReducer(resumed, { type: 'resume' }).paused).toBe(false);

    const inResult = correctPick(startSession('p2'));
    expect(flexibilityGameReducer(inResult, { type: 'pause' }).paused).toBe(true);

    const inNotice = playCorrectRounds(startSession('p3', 'easy'), 4);
    expect(flexibilityGameReducer(inNotice, { type: 'pause' }).paused).toBe(true);
  });

  it('cannot pause in the intro or on results, or twice', () => {
    const inIntro = flexibilityGameReducer(createInitialFlexibilityState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = flexibilityGameReducer(startSession('p4'), { type: 'pause' });
    state = flexibilityGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = flexibilityGameReducer(createInitialFlexibilityState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(flexibilityGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = flexibilityGameReducer(createInitialFlexibilityState(), {
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
    let state = flexibilityGameReducer(createInitialFlexibilityState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = flexibilityGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(flexibilityGameReducer(state, { type: 'persistence-succeeded' }).persistState).toBe(
      'succeeded',
    );
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = flexibilityGameReducer(correctPick(startSession('qa-win')), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    const rounds = FLEXIBILITY_DIFFICULTY_PARAMS.normal.rounds;
    expect(state.stats.roundsPlayed).toBe(rounds);
    expect(state.stats.correctPicks).toBe(rounds);
    expect(state.stats.mistakes).toBe(0);
    expect(state.stats.score).toBe(perfectSessionScore(FLEXIBILITY_DIFFICULTY_PARAMS.normal));
    expect(state.stats.bestStreak).toBe(rounds);
    // normal: switchEvery 3 → ceil(10/3) - 1 = 3 post-switch rounds, all correct.
    expect(state.stats.postSwitchPlayed).toBe(3);
    expect(state.stats.postSwitchCorrect).toBe(3);
  });

  it('force-lose ends the session with the current round failed', () => {
    const midRound = startSession('qa-lose');
    const state = flexibilityGameReducer(midRound, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    const scored = correctPick(startSession('qa-lose2'));
    expect(scored.roundOutcome).toBe('correct');
    const state = flexibilityGameReducer(scored, { type: 'qa/force-lose' });
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.correctPicks).toBe(1);
    expect(state.stats.mistakes).toBe(0);
  });

  it('force-lose from the notice phase counts nothing', () => {
    const inNotice = playCorrectRounds(startSession('qa-lose3', 'easy'), 4);
    const state = flexibilityGameReducer(inNotice, { type: 'qa/force-lose' });
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.correctPicks).toBe(4);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = flexibilityGameReducer(createInitialFlexibilityState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = flexibilityGameReducer(correctPick(startSession('q')), { type: 'qa/force-win' });
    const after = flexibilityGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = flexibilityGameReducer(createInitialFlexibilityState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = flexibilityGameReducer(createInitialFlexibilityState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = flexibilityGameReducer(createInitialFlexibilityState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = flexibilityGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
