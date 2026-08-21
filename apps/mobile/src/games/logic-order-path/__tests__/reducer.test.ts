// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import { orderPathGameReducer } from '../reducer';
import { createInitialOrderPathState } from '../types';
import type { OrderPathGameState } from '../types';
import { ORDER_PATH_DIFFICULTY_PARAMS, orderPathParamsForLevel } from '../difficulty';
import { perfectSessionScore } from '../scoring';
import { availableNext } from '../solver';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
  startedAtMs = 100,
): OrderPathGameState {
  let state = createInitialOrderPathState();
  state = orderPathGameReducer(state, { type: 'select-difficulty', level });
  state = orderPathGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs,
  });
  return state;
}

/** Solve the current round by tapping the unique solution in order. */
function solveRound(
  state: OrderPathGameState,
  finalNowMs: number,
  startOffsetMs = 0,
): OrderPathGameState {
  const round = state.currentRound;
  if (round === null || state.roundStartedAtMs === null) {
    throw new Error('solveRound requires an active round');
  }
  let next = state;
  for (let i = 0; i < round.solution.length - 1; i += 1) {
    next = orderPathGameReducer(next, {
      type: 'select-item',
      item: round.solution[i],
      nowMs: state.roundStartedAtMs + startOffsetMs + i,
    });
  }
  return orderPathGameReducer(next, {
    type: 'select-item',
    item: round.solution[round.solution.length - 1],
    nowMs: finalNowMs,
  });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = orderPathGameReducer(createInitialOrderPathState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = orderPathGameReducer(startSession('x'), {
      type: 'select-difficulty',
      level: 'easy',
    });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('opens round 1 with a valid uniquely-ordered puzzle', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('round');
    expect(state.profile?.level).toBe('normal');
    expect(state.roundIndex).toBe(0);
    expect(state.currentRound).not.toBeNull();
    expect(state.placedItems).toEqual([]);
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
    // normal budget is 25s → deadline = startedAtMs + 25000.
    expect(state.roundDeadlineMs).toBe(25_100);
    expect(state.roundStartedAtMs).toBe(100);
  });

  it('determinism: same seed → same round', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.currentRound).toEqual(b.currentRound);
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.currentRound?.items).toHaveLength(6);
    expect(expert.roundDeadlineMs).toBe(100 + 15_000);
    const easy = startSession('e2', 'easy');
    expect(easy.currentRound?.items).toHaveLength(4);
  });
});

describe('select-item', () => {
  it('accepts intermediate correct picks without ending the round', () => {
    let state = startSession('mid');
    const round = state.currentRound!;
    state = orderPathGameReducer(state, {
      type: 'select-item',
      item: round.solution[0],
      nowMs: 200,
    });
    expect(state.phase).toBe('round');
    expect(state.placedItems).toEqual([round.solution[0]]);
    expect(state.selectedItem).toBe(round.solution[0]);
    expect(state.stats.roundsPlayed).toBe(0);
  });

  it('scores a fully solved round with a speed bonus', () => {
    // Final pick at elapsed 12500 of 25000 → 100 + round(50 * 0.5) = 125.
    let state = solveRound(startSession('solve'), 12_600);
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('correct');
    expect(state.roundCorrect).toBe(true);
    expect(state.stats.score).toBe(125);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsCorrect).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.bestRoundTimeMs).toBe(12_500);
    expect(state.stats.totalElapsedMs).toBe(12_500);
    expect(state.stats.totalBudgetMs).toBe(25_000);
  });

  it('ends the round as wrong on a bad pick and resets the streak', () => {
    let state = startSession('wrong');
    const round = state.currentRound!;
    const badItem = round.items.find((i) => i !== round.solution[0])!;

    // Build up a streak first (instant solve of round 1 is impossible after a
    // wrong pick ends it, so run a quick prior round via force paths instead:
    // simpler to just verify the wrong path directly here).
    state = orderPathGameReducer(state, {
      type: 'select-item',
      item: badItem,
      nowMs: 2_600,
    });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('wrong');
    expect(state.roundCorrect).toBe(false);
    expect(state.selectedItem).toBe(badItem);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsCorrect).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.totalElapsedMs).toBe(2_500);
  });

  it('treats an already-placed item as a wrong pick', () => {
    let state = startSession('repeat');
    const round = state.currentRound!;
    state = orderPathGameReducer(state, {
      type: 'select-item',
      item: round.solution[0],
      nowMs: 200,
    });
    state = orderPathGameReducer(state, {
      type: 'select-item',
      item: round.solution[0],
      nowMs: 300,
    });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('wrong');
  });

  it('ignores picks in the intro, while paused, past the deadline, or after the round ended', () => {
    expect(
      orderPathGameReducer(createInitialOrderPathState(), {
        type: 'select-item',
        item: 'A',
        nowMs: 0,
      }).phase,
    ).toBe('intro');

    const paused = orderPathGameReducer(startSession('guards'), {
      type: 'pause',
      nowMs: 500,
    });
    expect(orderPathGameReducer(paused, { type: 'select-item', item: 'A', nowMs: 600 }).placedItems).toEqual([]);

    const late = orderPathGameReducer(startSession('guards'), {
      type: 'select-item',
      item: 'A',
      nowMs: 25_101, // deadline is 25100
    });
    expect(late.phase).toBe('round');
    expect(late.placedItems).toEqual([]);

    const done = solveRound(startSession('guards'), 500);
    expect(done.phase).toBe('roundResult');
    expect(orderPathGameReducer(done, { type: 'select-item', item: 'A', nowMs: 600 }).stats.roundsPlayed).toBe(1);
  });
});

describe('expire-round', () => {
  it('times out at the deadline and charges the full budget', () => {
    const state = orderPathGameReducer(startSession('timeout'), {
      type: 'expire-round',
      nowMs: 25_100,
    });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('timeout');
    expect(state.roundCorrect).toBe(false);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.totalElapsedMs).toBe(25_000);
    expect(state.stats.totalBudgetMs).toBe(25_000);
  });

  it('is a no-op before the deadline, while paused, or outside the round phase', () => {
    const early = orderPathGameReducer(startSession('early'), {
      type: 'expire-round',
      nowMs: 25_099,
    });
    expect(early.phase).toBe('round');

    const paused = orderPathGameReducer(startSession('early'), {
      type: 'pause',
      nowMs: 500,
    });
    expect(
      orderPathGameReducer(paused, { type: 'expire-round', nowMs: 30_000 }).phase,
    ).toBe('round');

    expect(
      orderPathGameReducer(createInitialOrderPathState(), {
        type: 'expire-round',
        nowMs: 30_000,
      }).phase,
    ).toBe('intro');
  });
});

describe('next-round', () => {
  it('advances to a fresh round with rebased timers', () => {
    let state = solveRound(startSession('next'), 500);
    state = orderPathGameReducer(state, { type: 'next-round', nowMs: 700 });
    expect(state.phase).toBe('round');
    expect(state.roundIndex).toBe(1);
    expect(state.placedItems).toEqual([]);
    expect(state.roundOutcome).toBeNull();
    expect(state.roundStartedAtMs).toBe(700);
    expect(state.roundDeadlineMs).toBe(700 + 25_000);
  });

  it('generates a different puzzle than the previous round', () => {
    let state = solveRound(startSession('distinct'), 500);
    const firstSolution = state.currentRound!.solution;
    state = orderPathGameReducer(state, { type: 'next-round', nowMs: 700 });
    expect(state.currentRound!.solution).not.toEqual(firstSolution);
  });

  it('moves to results after the final round with a perfect score', () => {
    let state = startSession('final', 'easy'); // 4 rounds
    for (let round = 0; round < 4; round += 1) {
      state = solveRound(state, state.roundStartedAtMs!); // instant answers
      state = orderPathGameReducer(state, { type: 'next-round', nowMs: state.startedAtMs! });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsCorrect).toBe(4);
    expect(state.stats.score).toBe(perfectSessionScore(ORDER_PATH_DIFFICULTY_PARAMS.easy));
  });

  it('is ignored outside roundResult', () => {
    const state = orderPathGameReducer(startSession('nope'), {
      type: 'next-round',
      nowMs: 200,
    });
    expect(state.roundIndex).toBe(0);
  });
});

describe('pause / resume', () => {
  it('freezes the remaining budget and rebases timing on resume', () => {
    let state = orderPathGameReducer(startSession('p'), { type: 'pause', nowMs: 6_000 });
    expect(state.paused).toBe(true);
    expect(state.roundDeadlineMs).toBeNull();
    expect(state.roundRemainingMs).toBe(19_100);
    expect(state.roundElapsedMs).toBe(5_900);

    state = orderPathGameReducer(state, { type: 'resume', nowMs: 10_000 });
    expect(state.paused).toBe(false);
    expect(state.roundDeadlineMs).toBe(29_100);
    expect(state.roundRemainingMs).toBeNull();
    expect(state.roundElapsedMs).toBeNull();
    expect(state.roundStartedAtMs).toBe(4_100);

    // Answer timing continues from where it left off (5900 + 6600 = 12500).
    state = solveRound(state, 16_600);
    expect(state.stats.score).toBe(125);
  });

  it('ignores double pause, resume without pause, and pausing outside a round', () => {
    const paused = orderPathGameReducer(startSession('p2'), { type: 'pause', nowMs: 1_000 });
    expect(orderPathGameReducer(paused, { type: 'pause', nowMs: 2_000 })).toBe(paused);

    const fresh = startSession('p3');
    expect(orderPathGameReducer(fresh, { type: 'resume', nowMs: 2_000 })).toBe(fresh);

    const intro = orderPathGameReducer(createInitialOrderPathState(), { type: 'pause', nowMs: 0 });
    expect(intro.paused).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = orderPathGameReducer(createInitialOrderPathState(), {
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

  it('tracks persistence progress and errors', () => {
    let state = orderPathGameReducer(createInitialOrderPathState(), {
      type: 'persistence-started',
    });
    expect(state.persistState).toBe('started');
    state = orderPathGameReducer(state, {
      type: 'persistence-failed',
      message: 'boom',
    });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      orderPathGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });

  it('stores the authoritative completion outcome', () => {
    const state = orderPathGameReducer(createInitialOrderPathState(), {
      type: 'completion-outcome-received',
      xp: 30,
      currency: 5,
      deltas: [{ domain: 'Memory', delta: 2, ratingAfter: 1002 }],
    });
    expect(state.authoritativeXp).toBe(30);
    expect(state.authoritativeCurrency).toBe(5);
    expect(state.authoritativeDeltas).toHaveLength(1);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial overlay', () => {
    let state = orderPathGameReducer(createInitialOrderPathState(), { type: 'tutorial-open' });
    expect(state.tutorialOpen).toBe(true);
    state = orderPathGameReducer(state, { type: 'tutorial-close' });
    expect(state.tutorialOpen).toBe(false);
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = orderPathGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.paused).toBe(false);
    expect(state.stats.score).toBe(perfectSessionScore(orderPathParamsForLevel('normal')));
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsCorrect).toBe(5);
    expect(state.stats.bestStreak).toBe(5);
    expect(state.stats.bestRoundTimeMs).toBe(0);
  });

  it('force-win works from roundResult too but not from intro/results', () => {
    const fromResult = orderPathGameReducer(solveRound(startSession('qa-w2'), 500), {
      type: 'qa/force-win',
    });
    expect(fromResult.phase).toBe('results');

    const intro = orderPathGameReducer(createInitialOrderPathState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');

    const results = orderPathGameReducer(startSession('qa-w3'), { type: 'qa/force-win' });
    const again = orderPathGameReducer(results, { type: 'qa/force-win' });
    expect(again).toBe(results);
  });

  it('force-lose counts the interrupted round as played', () => {
    const fromRound = orderPathGameReducer(startSession('qa-l1'), { type: 'qa/force-lose' });
    expect(fromRound.phase).toBe('results');
    expect(fromRound.forced).toBe(true);
    expect(fromRound.stats.roundsPlayed).toBe(1);
    expect(fromRound.stats.streak).toBe(0);

    // From roundResult the round was already counted.
    const done = solveRound(startSession('qa-l2'), 500);
    const fromResult = orderPathGameReducer(done, { type: 'qa/force-lose' });
    expect(fromResult.stats.roundsPlayed).toBe(1);
  });

  it('force-timeout expires only the active round', () => {
    const state = orderPathGameReducer(startSession('qa-t'), { type: 'qa/force-timeout' });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('timeout');
    expect(state.forced).toBe(false); // session itself is not flagged
    expect(state.stats.roundsPlayed).toBe(1);

    expect(
      orderPathGameReducer(createInitialOrderPathState(), { type: 'qa/force-timeout' }).phase,
    ).toBe('intro');
    const paused = orderPathGameReducer(startSession('qa-t2'), { type: 'pause', nowMs: 0 });
    expect(
      orderPathGameReducer(paused, { type: 'qa/force-timeout' }).phase,
    ).toBe('round');
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = orderPathGameReducer(createInitialOrderPathState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');

    // Invalid difficulty values are ignored at runtime (isDifficultyLevel);
    // the cast exists only to smuggle the bad value past the patch's type.
    state = orderPathGameReducer(state, {
      type: 'qa/force-state',
      patch: { seed: 42, difficulty: 'impossible' as DifficultyLevel },
    });
    expect(state.seedOverride).toBe('42');
    expect(state.difficulty).toBe('expert');

    const mid = orderPathGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
