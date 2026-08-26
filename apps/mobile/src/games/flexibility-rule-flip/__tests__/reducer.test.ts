// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import { generateSession } from '../generator';
import { flexibilityRuleFlipReducer } from '../reducer';
import {
  perfectPlanScore,
  roundScore,
  SWITCH_CORRECT_BONUS,
  UNCUED_FIRST_PICK_BONUS,
} from '../scoring';
import { createInitialFlexibilityRuleFlipState } from '../types';
import type { FlexibilityRuleFlipGameState } from '../types';
import {
  FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS,
  flexibilityRuleFlipParamsFromProfile,
} from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): FlexibilityRuleFlipGameState {
  let state = createInitialFlexibilityRuleFlipState();
  state = flexibilityRuleFlipReducer(state, { type: 'select-difficulty', level });
  state = flexibilityRuleFlipReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
  });
  return state;
}

function playRound(
  state: FlexibilityRuleFlipGameState,
  pickIndex: number,
  responseMs = 0,
): FlexibilityRuleFlipGameState {
  const picked = flexibilityRuleFlipReducer(state, {
    type: 'pick-card',
    index: pickIndex,
    responseMs,
  });
  return flexibilityRuleFlipReducer(picked, { type: 'next-round' });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = flexibilityRuleFlipReducer(createInitialFlexibilityRuleFlipState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = flexibilityRuleFlipReducer(startSession('x'), {
      type: 'select-difficulty',
      level: 'easy',
    });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('opens trial 1 in trialActive with the generated plan', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('trialActive');
    expect(state.profile?.level).toBe('normal');
    expect(state.rounds).toBe(FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal.rounds);
    expect(state.plan).toHaveLength(state.rounds);
    expect(state.roundIndex).toBe(0);
    expect(state.round).toEqual(state.plan[0]);
    expect(state.rule).toBe(state.plan[0].rule);
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
    expect(state.prevTarget).toBeNull();
  });

  it('determinism: same seed → same plan', () => {
    expect(startSession('det').plan).toEqual(startSession('det').plan);
    expect(startSession('det').plan).toEqual(
      generateSession('det', flexibilityRuleFlipParamsFromProfile(startSession('det').profile!)),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.rounds).toBe(FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.expert.rounds);
    expect(expert.profile?.parameters.numNumbers).toBe(6);
    const easy = startSession('e2', 'easy');
    expect(easy.profile?.parameters.speedTargetMs).toBe(6000);
  });
});

describe('pick-card', () => {
  it('scores a correct repeat pick with base + speed bonus', () => {
    let state = startSession('correct');
    // Find a repeat (non-switch) trial — round 0 never is one, but be safe.
    let index = 0;
    while (state.plan[index].isSwitch) {
      state = playRound(state, state.plan[index].correctIndex);
      index += 1;
    }
    const before = state.stats;
    const responseMs = 1000;
    state = flexibilityRuleFlipReducer(state, { type: 'pick-card', index: state.round!.correctIndex, responseMs });
    expect(state.phase).toBe('trialResult');
    expect(state.roundOutcome).toBe('correct');
    expect(state.lastResponseMs).toBe(responseMs);
    expect(state.lastPickIndex).toBe(state.plan[index].correctIndex);
    expect(state.stats.score).toBe(before.score + roundScore(true, responseMs, FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal.speedTargetMs));
    expect(state.stats.correctPicks).toBe(before.correctPicks + 1);
    expect(state.stats.streak).toBe(before.streak + 1);
    expect(state.stats.bestStreak).toBe(Math.max(before.bestStreak, state.stats.streak));
    expect(state.stats.repeatPlayed).toBe(before.repeatPlayed + 1);
    expect(state.stats.repeatCorrect).toBe(before.repeatCorrect + 1);
    expect(state.stats.totalResponseMs).toBe(before.totalResponseMs + responseMs);
    expect(state.stats.scoredPicks).toBe(before.scoredPicks + 1);
  });

  it('adds the switch-correct bonus on a correct switch trial', () => {
    let state = startSession('switch-bonus');
    let index = 0;
    while (!state.plan[index].isSwitch) {
      state = playRound(state, state.plan[index].correctIndex);
      index += 1;
    }
    const before = state.stats;
    state = flexibilityRuleFlipReducer(state, { type: 'pick-card', index: state.round!.correctIndex, responseMs: 0 });
    expect(state.stats.switchPlayed).toBe(before.switchPlayed + 1);
    expect(state.stats.switchCorrect).toBe(before.switchCorrect + 1);
    expect(state.stats.score).toBe(
      before.score + roundScore(true, 0, FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal.speedTargetMs) + SWITCH_CORRECT_BONUS,
    );
  });

  it('records a mistake and resets the streak on a wrong pick', () => {
    let state = startSession('wrong');
    const wrongIndex = (state.round!.correctIndex + 1) % state.round!.candidates.length;
    state = flexibilityRuleFlipReducer(state, { type: 'pick-card', index: wrongIndex, responseMs: 2500 });
    expect(state.phase).toBe('trialResult');
    expect(state.roundOutcome).toBe('wrong');
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.bestStreak).toBe(0);
    expect(state.stats.score).toBe(0); // wrong picks earn nothing
    expect(state.stats.scoredPicks).toBe(1); // but count for the speed denominator
  });

  it('is ignored outside trialActive or while paused (invalid-action guards)', () => {
    const intro = flexibilityRuleFlipReducer(createInitialFlexibilityRuleFlipState(), {
      type: 'pick-card',
      index: 0,
      responseMs: 0,
    });
    expect(intro.phase).toBe('intro');

    const active = startSession('guard');
    const paused = flexibilityRuleFlipReducer(active, { type: 'pause' });
    const pickedWhilePaused = flexibilityRuleFlipReducer(paused, {
      type: 'pick-card',
      index: paused.round!.correctIndex,
      responseMs: 0,
    });
    expect(pickedWhilePaused.phase).toBe('trialActive');
    expect(pickedWhilePaused.stats.roundsPlayed).toBe(0);

    const scored = flexibilityRuleFlipReducer(active, {
      type: 'pick-card',
      index: active.round!.correctIndex,
      responseMs: 0,
    });
    const repick = flexibilityRuleFlipReducer(scored, {
      type: 'pick-card',
      index: 0,
      responseMs: 10,
    });
    expect(repick.stats.roundsPlayed).toBe(1); // no double counting in trialResult
  });
});

describe('next-round', () => {
  it('advances to the next trial and carries the previous target', () => {
    let state = startSession('advance');
    const firstTarget = state.round!.target;
    state = flexibilityRuleFlipReducer(state, {
      type: 'pick-card',
      index: state.round!.correctIndex,
      responseMs: 0,
    });
    state = flexibilityRuleFlipReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('trialActive');
    expect(state.roundIndex).toBe(1);
    expect(state.round).toEqual(state.plan[1]);
    expect(state.rule).toBe(state.plan[1].rule);
    expect(state.prevTarget).toEqual(firstTarget);
    expect(state.lastPickIndex).toBe(-1);
    expect(state.roundOutcome).toBeNull();
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 8 rounds
    for (let i = 0; i < 8; i += 1) {
      state = playRound(state, state.round!.correctIndex);
    }
    expect(state.phase).toBe('results');
    expect(state.round).toBeNull();
    expect(state.roundOutcome).toBeNull();
    expect(state.stats.roundsPlayed).toBe(8);
    expect(state.stats.correctPicks).toBe(8);
    expect(state.stats.score).toBe(perfectPlanScore(generateSession('final', FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.easy)));
  });

  it('is ignored outside trialResult', () => {
    const state = flexibilityRuleFlipReducer(startSession('nr'), { type: 'next-round' });
    expect(state.roundIndex).toBe(0);
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const intro = flexibilityRuleFlipReducer(createInitialFlexibilityRuleFlipState(), { type: 'pause' });
    expect(intro.paused).toBe(false);
    let state = flexibilityRuleFlipReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = flexibilityRuleFlipReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(flexibilityRuleFlipReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause a finished session', () => {
    const finalized = flexibilityRuleFlipReducer(createInitialFlexibilityRuleFlipState(), {
      type: 'session-finalized',
      xp: 0,
      normalized: 0,
      activeDurationMs: 0,
      pausedDurationMs: 0,
      completedAtMs: 1,
    });
    void finalized;
    const results = startSession('pr');
    const done = flexibilityRuleFlipReducer(results, { type: 'qa/force-win' });
    expect(flexibilityRuleFlipReducer(done, { type: 'pause' }).paused).toBe(false);
  });
});

describe('tutorial open/close', () => {
  it('toggles the tutorial overlay flag', () => {
    let state = flexibilityRuleFlipReducer(createInitialFlexibilityRuleFlipState(), { type: 'tutorial-open' });
    expect(state.tutorialOpen).toBe(true);
    state = flexibilityRuleFlipReducer(state, { type: 'tutorial-close' });
    expect(state.tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = flexibilityRuleFlipReducer(createInitialFlexibilityRuleFlipState(), {
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

  it('tracks persistence progress including failure detail', () => {
    let state = flexibilityRuleFlipReducer(createInitialFlexibilityRuleFlipState(), {
      type: 'persistence-started',
    });
    expect(state.persistState).toBe('started');
    state = flexibilityRuleFlipReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(flexibilityRuleFlipReducer(state, { type: 'persistence-succeeded' }).persistState).toBe('succeeded');
  });

  it('stores the authoritative completion outcome', () => {
    const state = flexibilityRuleFlipReducer(createInitialFlexibilityRuleFlipState(), {
      type: 'completion-outcome-received',
      xp: 7,
      currency: 3,
      deltas: [{ domain: 'flexibility', delta: 0.02, ratingAfter: 0.52 }],
    });
    expect(state.authoritativeXp).toBe(7);
    expect(state.authoritativeCurrency).toBe(3);
    expect(state.authoritativeDeltas).toEqual([{ domain: 'flexibility', delta: 0.02, ratingAfter: 0.52 }]);
  });
});

describe('uncued-window trials (inference)', () => {
  function advanceToUncuedTrial(seed: string): FlexibilityRuleFlipGameState {
    let state = startSession(seed);
    const target = state.plan.findIndex((r) => r.uncued);
    expect(target).toBeGreaterThan(0); // plan guarantees ≥1 uncued window past trial 0
    for (let i = 0; i < target; i += 1) {
      state = playRound(state, state.plan[i].correctIndex);
    }
    return state;
  }

  it('scores a correct uncued first pick with the inference bonus', () => {
    const state = advanceToUncuedTrial('uncue-correct');
    expect(state.round?.uncued).toBe(true);
    const before = state.stats;
    const scored = flexibilityRuleFlipReducer(state, {
      type: 'pick-card',
      index: state.round!.correctIndex,
      responseMs: 0,
    });
    // 150 base + uncued bonus (no switch bonus unless the hidden block also flipped).
    const expectedBonus = state.round!.isSwitch ? SWITCH_CORRECT_BONUS : 0;
    expect(scored.stats.score).toBe(before.score + 150 + UNCUED_FIRST_PICK_BONUS + expectedBonus);
    expect(scored.stats.uncuedPlayed).toBe(before.uncuedPlayed + 1);
    expect(scored.stats.uncuedCorrect).toBe(before.uncuedCorrect + 1);
  });

  it('counts an uncued miss as played-but-not-correct and keeps the rule for reveal', () => {
    const state = advanceToUncuedTrial('uncue-wrong');
    const before = state.stats;
    const wrongIndex = (state.round!.correctIndex + 1) % state.round!.candidates.length;
    const scored = flexibilityRuleFlipReducer(state, { type: 'pick-card', index: wrongIndex, responseMs: 100 });
    // A miss adds nothing to the cumulative session score.
    expect(scored.stats.score).toBe(before.score);
    expect(scored.stats.uncuedPlayed).toBe(before.uncuedPlayed + 1);
    expect(scored.stats.uncuedCorrect).toBe(before.uncuedCorrect);
    expect(scored.stats.mistakes).toBe(before.mistakes + 1);
    // The reveal is presentation-layer: the round keeps its rule so feedback
    // can name it (screen renders `rule-reveal` from this).
    expect(scored.round?.rule).toBe(state.plan[state.roundIndex].rule);
  });

  it('force-win fills uncued stats from the plan and scores them perfectly', () => {
    const seed = 'uncue-force-win';
    const forced = flexibilityRuleFlipReducer(startSession(seed), { type: 'qa/force-win' });
    const plan = generateSession(seed, FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal);
    const uncuedPlayed = plan.filter((r) => r.uncued).length;
    expect(forced.stats.uncuedPlayed).toBe(uncuedPlayed);
    expect(forced.stats.uncuedCorrect).toBe(uncuedPlayed);
    expect(forced.stats.score).toBe(perfectPlanScore(plan));
  });

  it('force-lose counts an in-flight uncued round as played but missed', () => {
    const state = advanceToUncuedTrial('uncue-force-lose');
    const before = state.stats;
    const forced = flexibilityRuleFlipReducer(state, { type: 'qa/force-lose' });
    expect(forced.stats.uncuedPlayed).toBe(before.uncuedPlayed + 1);
    expect(forced.stats.uncuedCorrect).toBe(before.uncuedCorrect);
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run of the whole plan', () => {
    const state = flexibilityRuleFlipReducer(startSession('qa-win'), { type: 'qa/force-win' });
    const plan = generateSession('qa-win', FLEXIBILITY_RULE_FLIP_DIFFICULTY_PARAMS.normal);
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(plan.length);
    expect(state.stats.correctPicks).toBe(plan.length);
    expect(state.stats.mistakes).toBe(0);
    expect(state.stats.switchPlayed).toBe(plan.filter((r) => r.isSwitch).length);
    expect(state.stats.switchCorrect).toBe(plan.filter((r) => r.isSwitch).length);
    expect(state.stats.score).toBe(perfectPlanScore(plan));
    expect(state.stats.bestStreak).toBe(plan.length);
  });

  it('force-win also works from trialResult and is a no-op in intro/results', () => {
    let state = startSession('qa-win-2');
    state = flexibilityRuleFlipReducer(state, { type: 'pick-card', index: state.round!.correctIndex, responseMs: 100 });
    state = flexibilityRuleFlipReducer(state, { type: 'qa/force-win' });
    expect(state.phase).toBe('results');

    const intro = flexibilityRuleFlipReducer(createInitialFlexibilityRuleFlipState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    expect(flexibilityRuleFlipReducer(intro, { type: 'qa/force-win' }).forced).toBe(false);
  });

  it('force-lose counts the in-flight trialActive round as a mistake', () => {
    const state = flexibilityRuleFlipReducer(startSession('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.scoredPicks).toBe(1);
  });

  it('force-lose from trialResult keeps the scored round as-is', () => {
    let state = startSession('qa-lose-2');
    state = flexibilityRuleFlipReducer(state, { type: 'pick-card', index: state.round!.correctIndex, responseMs: 0 });
    const forced = flexibilityRuleFlipReducer(state, { type: 'qa/force-lose' });
    expect(forced.stats.roundsPlayed).toBe(1);
    expect(forced.stats.mistakes).toBe(0);
    expect(forced.stats.correctPicks).toBe(1);
  });

  it('force-timeout ends the session without scoring the in-flight round', () => {
    let state = startSession('qa-timeout');
    state = playRound(state, state.round!.correctIndex); // complete round 1
    expect(state.roundIndex).toBe(1);
    const forced = flexibilityRuleFlipReducer(state, { type: 'qa/force-timeout' });
    expect(forced.phase).toBe('results');
    expect(forced.forced).toBe(true);
    expect(forced.stats.roundsPlayed).toBe(1); // in-flight round NOT scored
    expect(forced.stats.mistakes).toBe(0);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = flexibilityRuleFlipReducer(createInitialFlexibilityRuleFlipState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');

    state = flexibilityRuleFlipReducer(state, {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');

    // Invalid difficulty values are ignored (isDifficultyLevel guard).
    state = flexibilityRuleFlipReducer(state, {
      type: 'qa/force-state',
      patch: { difficulty: 'impossible' as unknown as DifficultyLevel },
    });
    expect(state.difficulty).toBe('expert');

    const mid = flexibilityRuleFlipReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
