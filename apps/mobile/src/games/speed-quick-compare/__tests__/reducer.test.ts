// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import { quickCompareGameReducer, createInitialQuickCompareState } from '../reducer';
import { QUICK_COMPARE_DIFFICULTY_PARAMS, quickCompareParamsFromProfile } from '../difficulty';
import { perfectSessionScore } from '../scoring';
import type { QuickCompareGameState } from '../types';

function startSession(
  seed = 's',
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
  spawnedAtMs = 1000,
): QuickCompareGameState {
  let state = quickCompareGameReducer(createInitialQuickCompareState(), { type: 'select-difficulty', level });
  state = quickCompareGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
    spawnedAtMs,
  });
  return state;
}

/** Answer the current round correctly and advance to the next round/results. */
function answerCorrect(state: QuickCompareGameState, nowMs: number): QuickCompareGameState {
  const round = state.round;
  if (round === null) {
    return quickCompareGameReducer(state, { type: 'next-round', spawnedAtMs: nowMs });
  }
  const answered = quickCompareGameReducer(state, { type: 'answer', index: round.correctIndex, nowMs });
  return quickCompareGameReducer(answered, { type: 'next-round', spawnedAtMs: nowMs });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = quickCompareGameReducer(createInitialQuickCompareState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });
  it('ignores selection mid-session', () => {
    const state = quickCompareGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves difficulty, opens round 1, sets the window and round total', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('active');
    expect(state.profile?.level).toBe('normal');
    expect(state.windowMs).toBe(2200);
    expect(state.stats.roundsTotal).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS.normal.rounds);
    expect(state.round).not.toBeNull();
    expect(state.roundStartedAtMs).toBe(1000);
    expect(state.deadlineMs).toBe(3200);
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates deterministically for a fixed seed', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.round).toEqual(b.round);
  });

  it('uses the selected difficulty tuning', () => {
    expect(startSession('e', 'expert').windowMs).toBe(1400);
    expect(startSession('a', 'adaptive').profile?.level).toBe('adaptive');
    const easy = startSession('ez', 'easy');
    expect(easy.stats.roundsTotal).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS.easy.rounds);
  });
});

describe('answer', () => {
  it('scores a correct answer with reaction-derived speed factor', () => {
    let state = startSession('tap');
    const round = state.round!;
    state = quickCompareGameReducer(state, { type: 'answer', index: round.correctIndex, nowMs: 1200 });
    expect(state.stats.roundsCorrect).toBe(1);
    expect(state.stats.reactions).toEqual([200]);
    expect(state.stats.speedFactors[0]).toBeCloseTo(1 - 200 / 2200);
    expect(state.stats.score).toBeCloseTo(100 + 50 * (1 - 200 / 2200));
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.phase).toBe('feedback');
    expect(state.lastVerdict).toBe('correct');
  });

  it('counts a wrong answer and breaks the streak', () => {
    let state = startSession('wrong');
    const round = state.round!;
    const wrongIndex = round.correctIndex === 0 ? 1 : 0;
    expect(wrongIndex).not.toBe(round.correctIndex);
    state = quickCompareGameReducer(state, { type: 'answer', index: wrongIndex, nowMs: 1300 });
    expect(state.stats.roundsWrong).toBe(1);
    expect(state.stats.streak).toBe(0);
    expect(state.lastVerdict).toBe('incorrect');
    expect(state.stats.reactions).toEqual([300]);
  });

  it('ignores a post-deadline answer (the expiry timer owns it)', () => {
    const state = startSession('late');
    expect(state.deadlineMs).toBe(3200);
    const after = quickCompareGameReducer(state, { type: 'answer', index: 0, nowMs: 3300 });
    expect(after.stats.roundsCorrect).toBe(0);
    expect(after.phase).toBe('active');
  });

  it('rejects a second answer for the same round (no double count)', () => {
    let state = startSession('dup');
    const round = state.round!;
    state = quickCompareGameReducer(state, { type: 'answer', index: round.correctIndex, nowMs: 1100 });
    const again = quickCompareGameReducer(state, { type: 'answer', index: round.correctIndex, nowMs: 1150 });
    expect(again.stats.roundsCorrect).toBe(1);
    expect(again.phase).toBe('feedback');
  });

  it('is ignored outside the active phase or while paused', () => {
    const paused = quickCompareGameReducer(startSession('x'), { type: 'pause' });
    expect(quickCompareGameReducer(paused, { type: 'answer', index: 0, nowMs: 1500 }).paused).toBe(true);
    const intro = quickCompareGameReducer(createInitialQuickCompareState(), { type: 'answer', index: 0, nowMs: 0 });
    expect(intro.phase).toBe('intro');
  });
});

describe('answer-timeout', () => {
  it('counts a miss and moves to feedback', () => {
    let state = startSession('expire');
    state = quickCompareGameReducer(state, { type: 'answer-timeout', nowMs: 3200 });
    expect(state.stats.roundsMissed).toBe(1);
    expect(state.stats.streak).toBe(0);
    expect(state.lastVerdict).toBe('miss');
    expect(state.phase).toBe('feedback');
  });
});

describe('next-round', () => {
  it('advances to the next round and regenerates it', () => {
    let state = startSession('next');
    state = answerCorrect(state, 1200);
    expect(state.phase).toBe('active');
    expect(state.roundIndex).toBe(1);
    expect(state.roundStartedAtMs).toBe(1200);
    expect(state.deadlineMs).toBe(1200 + state.windowMs);
    expect(state.selectedIndex).toBeNull();
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 8 rounds
    for (let i = 0; i < QUICK_COMPARE_DIFFICULTY_PARAMS.easy.rounds; i += 1) {
      state = answerCorrect(state, 1200 + i * 10);
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsCorrect).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS.easy.rounds);
    expect(state.forced).toBe(false);
  });

  it('shrinks the adaptive window after a correct round', () => {
    let state = startSession('adp', 'adaptive');
    state = answerCorrect(state, 1200);
    expect(state.windowMs).toBe(2000);
    // a wrong round widens it again
    const round = state.round!;
    const wrongIndex = round.correctIndex === 0 ? 1 : 0;
    state = quickCompareGameReducer(state, { type: 'answer', index: wrongIndex, nowMs: 1300 });
    state = quickCompareGameReducer(state, { type: 'next-round', spawnedAtMs: 1400 });
    expect(state.windowMs).toBe(2200);
  });
});

describe('pause / resume', () => {
  it('pauses during a session and resumes with the window re-anchored', () => {
    expect(quickCompareGameReducer(createInitialQuickCompareState(), { type: 'pause' }).paused).toBe(false);
    let state = quickCompareGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    // Pause at t=1000 with 2200 ms window left; resume at t=5000 excludes the gap.
    state = quickCompareGameReducer(state, { type: 'resume', nowMs: 5000, remainingMs: 2200 });
    expect(state.paused).toBe(false);
    expect(state.deadlineMs).toBe(7200);
    expect(state.roundStartedAtMs).toBe(5000);
    const round = state.round!;
    const hit = quickCompareGameReducer(state, { type: 'answer', index: round.correctIndex, nowMs: 5200 });
    expect(hit.stats.reactions).toEqual([200]); // only active time since resume
  });

  it('cannot pause on results and resumes only from paused', () => {
    let state = startSession('p');
    state = quickCompareGameReducer(state, { type: 'pause' });
    expect(quickCompareGameReducer(state, { type: 'resume', nowMs: 0, remainingMs: 0 }).paused).toBe(false);
    expect(
      quickCompareGameReducer(
        quickCompareGameReducer(state, { type: 'resume', nowMs: 0, remainingMs: 0 }),
        { type: 'resume', nowMs: 0, remainingMs: 0 },
      ).paused,
    ).toBe(false);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = quickCompareGameReducer(createInitialQuickCompareState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(quickCompareGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = quickCompareGameReducer(createInitialQuickCompareState(), {
      type: 'session-finalized',
      xp: 12,
      normalized: 0.75,
      activeDurationMs: 30000,
      pausedDurationMs: 2000,
      completedAtMs: 30100,
    });
    expect(state.xp).toBe(12);
    expect(state.normalized).toBe(0.75);
    expect(state.activeDurationMs).toBe(30000);
  });

  it('tracks persistence progress', () => {
    let state = quickCompareGameReducer(createInitialQuickCompareState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = quickCompareGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(quickCompareGameReducer(state, { type: 'persistence-succeeded' }).persistState).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends as a perfect run and marks it forced', () => {
    const state = quickCompareGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsCorrect).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats.roundsMissed).toBe(0);
    expect(state.stats.bestStreak).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats.score).toBe(perfectSessionScore(QUICK_COMPARE_DIFFICULTY_PARAMS.normal));
    expect(state.stats.reactions.every((r) => r === 0)).toBe(true);
  });

  it('force-lose ends with every round missed', () => {
    const state = quickCompareGameReducer(startSession('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsMissed).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats.roundsCorrect).toBe(0);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = quickCompareGameReducer(createInitialQuickCompareState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = quickCompareGameReducer(createInitialQuickCompareState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    state = quickCompareGameReducer(createInitialQuickCompareState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    state = quickCompareGameReducer(createInitialQuickCompareState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    const mid = quickCompareGameReducer(startSession('x'), { type: 'qa/force-state', patch: { seed: 'nope' } });
    expect(mid.seedOverride).toBeNull();
  });
});

describe('double-completion guard', () => {
  it('does not re-enter results once finalized', () => {
    let state = startSession('dc');
    for (let i = 0; i < QUICK_COMPARE_DIFFICULTY_PARAMS.normal.rounds; i += 1) {
      state = answerCorrect(state, 1200);
    }
    expect(state.phase).toBe('results');
    // Extra actions after results must not change the outcome.
    const after = quickCompareGameReducer(state, { type: 'next-round', spawnedAtMs: 9999 });
    expect(after.phase).toBe('results');
    expect(after.stats.roundsCorrect).toBe(QUICK_COMPARE_DIFFICULTY_PARAMS.normal.rounds);
  });
});
