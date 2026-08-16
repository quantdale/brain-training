// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { loadContentPack } from '../content-validation';
import { languageGameReducer } from '../reducer';
import { createInitialLanguageState } from '../types';
import type { LanguageGameState } from '../types';
import { filterByTiers, selectRound } from '../generator';
import { perfectSessionScore } from '../scoring';
import { LANGUAGE_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
  nowMs = 0,
): LanguageGameState {
  let state = createInitialLanguageState();
  state = languageGameReducer(state, { type: 'select-difficulty', level });
  state = languageGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
    nowMs,
  });
  return state;
}

/** Answer the current round's correct option at the given clock time. */
function answerCorrect(state: LanguageGameState, nowMs: number): LanguageGameState {
  if (state.round === null) {
    throw new Error('no active round');
  }
  return languageGameReducer(state, { type: 'answer-option', index: state.round.correctIndex, nowMs });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = languageGameReducer(createInitialLanguageState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = languageGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the question phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('question');
    expect(state.profile?.level).toBe('normal');
    expect(state.params).toEqual(LANGUAGE_DIFFICULTY_PARAMS.normal);
    expect(state.roundBudgetMs).toBe(8000);
    expect(state.roundStartedAtMs).toBe(0);
    expect(state.roundDeadlineMs).toBe(8000);
    expect(state.poolTiers).toEqual(['t1', 't2']);
    expect(state.currentTier).toBeNull();
    expect(state.round).not.toBeNull();
    expect(state.usedItemIds).toEqual([state.round!.itemId]);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsCorrect: 0,
      bestStreak: 0,
      streak: 0,
      totalAnswerMs: 0,
      sumAnswerRatio: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same round for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.round).toEqual(b.round);
    expect(a.round).toEqual(
      selectRound({
        rng: createRng('det'),
        roundIndex: 0,
        pool: filterByTiers(loadContentPack().items, ['t1', 't2']),
        usedItemIds: new Set(),
        previousRound: null,
      }),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.roundBudgetMs).toBe(5000);
    expect(expert.poolTiers).toEqual(['t3']);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.currentTier).toBe('t1');
    expect(adaptive.poolTiers).toEqual(['t1']);
    expect(adaptive.roundBudgetMs).toBe(6000);
  });
});

describe('answer-option', () => {
  it('scores a correct answer with a speed bonus', () => {
    let state = startSession('ok');
    state = languageGameReducer(state, { type: 'answer-option', index: state.round!.correctIndex, nowMs: 500 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('correct');
    expect(state.lastAnswerMs).toBe(500);
    expect(state.roundOutcomes).toEqual(['correct']);
    // budget 8000 → ratio 0.0625 → 100 + round(50 * 0.9375) = 147
    expect(state.stats.score).toBe(147);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsCorrect).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.totalAnswerMs).toBe(500);
    expect(state.stats.sumAnswerRatio).toBeCloseTo(0.0625);
  });

  it('fails the round on a wrong option', () => {
    let state = startSession('wrong');
    const wrongIndex = (state.round!.correctIndex + 1) % 4;
    state = languageGameReducer(state, { type: 'answer-option', index: wrongIndex, nowMs: 1000 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('wrong');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsCorrect).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.score).toBe(0);
    expect(state.lastAnswerIndex).toBe(wrongIndex);
  });

  it('ignores taps after the deadline (late answers)', () => {
    const state = startSession('late');
    const after = languageGameReducer(state, {
      type: 'answer-option',
      index: state.round!.correctIndex,
      nowMs: 8001,
    });
    expect(after.phase).toBe('question');
    expect(after.stats.roundsPlayed).toBe(0);
  });

  it('is ignored during reveal-free phases: intro, roundResult, paused, results', () => {
    // While paused.
    let state = startSession('p');
    state = languageGameReducer(state, { type: 'pause', nowMs: 1000 });
    const pausedAnswer = languageGameReducer(state, {
      type: 'answer-option',
      index: state.round!.correctIndex,
      nowMs: 1001,
    });
    expect(pausedAnswer.stats.roundsPlayed).toBe(0);
  });
});

describe('expire-round', () => {
  it('ends the round as a timeout and records the full budget', () => {
    let state = startSession('expire');
    state = languageGameReducer(state, { type: 'expire-round', nowMs: 8000 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('timeout');
    expect(state.lastAnswerMs).toBe(8000);
    expect(state.roundOutcomes).toEqual(['timeout']);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsCorrect).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.totalAnswerMs).toBe(8000);
    expect(state.stats.sumAnswerRatio).toBe(1);
  });

  it('is ignored before the deadline (premature, defensive)', () => {
    const state = startSession('early');
    const after = languageGameReducer(state, { type: 'expire-round', nowMs: 7999 });
    expect(after.phase).toBe('question');
  });

  it('is ignored while paused or outside the question phase', () => {
    let paused = startSession('pe');
    paused = languageGameReducer(paused, { type: 'pause', nowMs: 1000 });
    expect(languageGameReducer(paused, { type: 'expire-round', nowMs: 9000 }).phase).toBe('question');
    const results = languageGameReducer(createInitialLanguageState(), { type: 'expire-round', nowMs: 0 });
    expect(results.phase).toBe('intro');
  });
});

describe('next-round', () => {
  it('keeps fixed-level tuning and grows the used-item set', () => {
    let state = startSession('next');
    state = answerCorrect(state, 1000);
    state = languageGameReducer(state, { type: 'next-round', nowMs: 2000 });
    expect(state.phase).toBe('question');
    expect(state.roundIndex).toBe(1);
    expect(state.roundBudgetMs).toBe(8000);
    expect(state.poolTiers).toEqual(['t1', 't2']);
    expect(state.roundStartedAtMs).toBe(2000);
    expect(state.roundDeadlineMs).toBe(10000);
    expect(state.usedItemIds).toHaveLength(2);
    expect(new Set(state.usedItemIds).size).toBe(2);
    expect(state.round!.itemId).not.toBe(startSession('next').round!.itemId);
  });

  it('holds the budget after a fixed-level failure', () => {
    let state = startSession('hold');
    state = languageGameReducer(state, { type: 'answer-option', index: (state.round!.correctIndex + 1) % 4, nowMs: 500 });
    state = languageGameReducer(state, { type: 'next-round', nowMs: 1500 });
    expect(state.roundBudgetMs).toBe(8000);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 5 rounds
    for (let round = 0; round < 5; round += 1) {
      state = answerCorrect(state, 100 + round * 100);
      state = languageGameReducer(state, { type: 'next-round', nowMs: 200 + round * 100 });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsCorrect).toBe(5);
    expect(state.roundOutcomes).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
    expect(state.stats.score).toBe(perfectSessionScore(LANGUAGE_DIFFICULTY_PARAMS.easy));
  });

  it('is a no-op outside the roundResult phase', () => {
    const state = startSession('noop');
    expect(languageGameReducer(state, { type: 'next-round', nowMs: 100 }).roundIndex).toBe(0);
  });
});

describe('adaptive difficulty progression', () => {
  it('escalates tier and tightens the budget after a pass', () => {
    let state = startSession('adapt-up', 'adaptive');
    expect(state.currentTier).toBe('t1');
    expect(state.roundBudgetMs).toBe(6000);
    state = answerCorrect(state, 1000);
    state = languageGameReducer(state, { type: 'next-round', nowMs: 2000 });
    expect(state.currentTier).toBe('t2');
    expect(state.roundBudgetMs).toBe(5500);
    expect(state.poolTiers).toEqual(['t2']);
  });

  it('drops tier and loosens the budget after a timeout (a fail)', () => {
    let state = startSession('adapt-down', 'adaptive');
    state = languageGameReducer(state, { type: 'answer-option', index: (state.round!.correctIndex + 1) % 4, nowMs: 1000 });
    state = languageGameReducer(state, { type: 'next-round', nowMs: 2000 });
    expect(state.currentTier).toBe('t1');
    expect(state.roundBudgetMs).toBe(6500);
  });

  it('respects the tier/budget bounds over a long session', () => {
    let state = startSession('adapt-bounds', 'adaptive');
    // 10 perfect rounds: tier caps at t3, budget floors at 4000.
    for (let round = 0; round < 10; round += 1) {
      state = answerCorrect(state, 100 + round * 100);
      state = languageGameReducer(state, { type: 'next-round', nowMs: 200 + round * 100 });
    }
    expect(state.phase).toBe('results');
    expect(state.currentTier).toBe('t3');
    expect(state.roundBudgetMs).toBe(4000);
  });
});

describe('pause / resume', () => {
  it('freezes the remaining budget and rebases the answer clock', () => {
    let state = startSession('pause', 'normal', 'p1', 0);
    // Deadline 8000; pause at 2000 → remaining 6000, elapsed 2000.
    state = languageGameReducer(state, { type: 'pause', nowMs: 2000 });
    expect(state.paused).toBe(true);
    expect(state.roundDeadlineMs).toBeNull();
    expect(state.roundRemainingMs).toBe(6000);
    expect(state.roundElapsedMs).toBe(2000);

    // Resume 5000ms later: deadline 11000, answer clock rebased to 3000.
    state = languageGameReducer(state, { type: 'resume', nowMs: 7000 });
    expect(state.paused).toBe(false);
    expect(state.roundDeadlineMs).toBe(13000);
    expect(state.roundStartedAtMs).toBe(5000);

    // Answer 8s after resume → answerMs 8000 (exactly the budget, still valid).
    state = languageGameReducer(state, { type: 'answer-option', index: state.round!.correctIndex, nowMs: 13000 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('correct');
    expect(state.lastAnswerMs).toBe(8000);
  });

  it('pauses only during the question phase', () => {
    const inIntro = languageGameReducer(createInitialLanguageState(), { type: 'pause', nowMs: 0 });
    expect(inIntro.paused).toBe(false);
    let state = startSession('p2');
    state = answerCorrect(state, 500);
    const inResult = languageGameReducer(state, { type: 'pause', nowMs: 600 });
    expect(inResult.paused).toBe(false);
  });

  it('cannot pause twice or resume when not paused', () => {
    let state = startSession('p3');
    state = languageGameReducer(state, { type: 'pause', nowMs: 500 });
    state = languageGameReducer(state, { type: 'pause', nowMs: 600 });
    expect(state.paused).toBe(true);
    const resumed = languageGameReducer(state, { type: 'resume', nowMs: 700 });
    expect(resumed.paused).toBe(false);
    expect(languageGameReducer(resumed, { type: 'resume', nowMs: 800 }).paused).toBe(false);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = languageGameReducer(createInitialLanguageState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(languageGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = languageGameReducer(createInitialLanguageState(), {
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
    let state = languageGameReducer(createInitialLanguageState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = languageGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      languageGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = languageGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(6);
    expect(state.stats.roundsCorrect).toBe(6);
    expect(state.stats.score).toBe(perfectSessionScore(LANGUAGE_DIFFICULTY_PARAMS.normal));
    expect(state.stats.bestStreak).toBe(6);
    expect(state.roundOutcomes).toEqual(['correct', 'correct', 'correct', 'correct', 'correct', 'correct']);
  });

  it('force-lose ends the session with the current round failed', () => {
    const state = languageGameReducer(startSession('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsCorrect).toBe(0);
    expect(state.roundOutcomes).toEqual(['wrong']);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = startSession('qa-lose2');
    state = answerCorrect(state, 500);
    const result = languageGameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsCorrect).toBe(1);
    expect(result.roundOutcomes).toEqual(['correct']);
    expect(result.forced).toBe(true);
  });

  it('force-timeout expires the current round and keeps the session going', () => {
    const state = languageGameReducer(startSession('qa-timeout'), { type: 'qa/force-timeout' });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('timeout');
    expect(state.forced).toBe(false); // only win/lose mark the session forced
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.sumAnswerRatio).toBe(1);
    const continued = languageGameReducer(state, { type: 'next-round', nowMs: 200 });
    expect(continued.phase).toBe('question');
    expect(continued.roundIndex).toBe(1);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = languageGameReducer(createInitialLanguageState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = languageGameReducer(startSession('q'), { type: 'qa/force-win' });
    const after = languageGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
    const afterTimeout = languageGameReducer(results, { type: 'qa/force-timeout' });
    expect(afterTimeout.phase).toBe('results');
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = languageGameReducer(createInitialLanguageState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = languageGameReducer(createInitialLanguageState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = languageGameReducer(createInitialLanguageState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = languageGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
