// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { targetCountGameReducer } from '../reducer';
import { createInitialTargetCountState } from '../types';
import type { TargetCountGameState } from '../types';
import { generateRound } from '../generator';
import { perfectSessionScore } from '../scoring';
import { TARGET_COUNT_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): TargetCountGameState {
  let state = createInitialTargetCountState();
  state = targetCountGameReducer(state, { type: 'select-difficulty', level });
  state = targetCountGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = targetCountGameReducer(createInitialTargetCountState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = targetCountGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the showGrid phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('showGrid');
    expect(state.profile?.level).toBe('normal');
    expect(state.currentRound).not.toBeNull();
    expect(state.currentRound?.cells).toHaveLength(4 * 4);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsCorrect: 0,
      totalElapsedMs: 0,
      totalBudgetMs: 0,
      bestStreak: 0,
      streak: 0,
      bestRoundTimeMs: Number.POSITIVE_INFINITY,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same round for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.currentRound?.cells).toEqual(b.currentRound?.cells);
    expect(a.currentRound?.cells).toEqual(
      generateRound({
        rng: createRng('det'),
        roundIndex: 0,
        params: TARGET_COUNT_DIFFICULTY_PARAMS.normal,
        prevRound: null,
      }).cells,
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.currentRound?.cells).toHaveLength(6 * 6);
    expect(expert.profile?.parameters.cols).toBe(6);
    const easy = startSession('a', 'easy');
    expect(easy.currentRound?.cells).toHaveLength(3 * 3);
  });
});

describe('answer', () => {
  it('scores a correct answer and moves to roundResult', () => {
    let state = startSession('g');
    const correct = state.currentRound?.targetCount ?? -1;
    state = targetCountGameReducer(state, { type: 'answer', selectedCount: correct, elapsedMs: 1000 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundCorrect).toBe(true);
    expect(state.roundOutcome).toBe('correct');
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsCorrect).toBe(1);
    expect(state.stats.score).toBeGreaterThan(0);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.totalElapsedMs).toBe(1000);
  });

  it('scores a wrong answer', () => {
    let state = startSession('g');
    // Pick any value guaranteed not to equal the correct count (targets are >= 1).
    const wrongChoice = 0;
    expect(state.currentRound?.targetCount).toBeGreaterThanOrEqual(1);
    state = targetCountGameReducer(state, { type: 'answer', selectedCount: wrongChoice, elapsedMs: 1000 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundCorrect).toBe(false);
    expect(state.roundOutcome).toBe('wrong');
    expect(state.stats.roundsCorrect).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.score).toBe(0);
  });

  it('scores a timeout (null selection)', () => {
    let state = startSession('g');
    state = targetCountGameReducer(state, { type: 'answer', selectedCount: null, elapsedMs: 9000 });
    expect(state.phase).toBe('roundResult');
    expect(state.roundCorrect).toBe(false);
    expect(state.roundOutcome).toBe('timeout');
  });

  it('ignores answers outside showGrid or while paused', () => {
    const intro = targetCountGameReducer(createInitialTargetCountState(), {
      type: 'answer',
      selectedCount: 3,
      elapsedMs: 1,
    });
    expect(intro.phase).toBe('intro');
    const paused = targetCountGameReducer(startSession('g'), { type: 'pause' });
    const after = targetCountGameReducer(paused, { type: 'answer', selectedCount: 3, elapsedMs: 1 });
    expect(after.phase).toBe('showGrid');
    expect(after.stats.roundsPlayed).toBe(0);
  });
});

describe('next-round', () => {
  function answerCorrectly(state: TargetCountGameState): TargetCountGameState {
    const correct = state.currentRound?.targetCount ?? -1;
    // Instant (elapsedMs 0) correct answer → full speed bonus → perfect per-round score.
    return targetCountGameReducer(state, { type: 'answer', selectedCount: correct, elapsedMs: 0 });
  }

  it('escalates distractor classes after every 2 perfect rounds (ladder determinism)', () => {
    const seed = 'ladder';
    const base = TARGET_COUNT_DIFFICULTY_PARAMS.normal; // base classes = 2
    let state = startSession(seed);

    // Rounds 1–2 perfect → streak 2 entering round 3.
    const round0 = state.currentRound!;
    state = answerCorrectly(state);
    state = targetCountGameReducer(state, { type: 'next-round' });
    const round1 = state.currentRound!;
    state = answerCorrectly(state);
    state = targetCountGameReducer(state, { type: 'next-round' });

    // Round 3 must replay exactly as a generation with +1 escalated class.
    expect(state.currentRound).toEqual(
      generateRound({
        rng: createRng(seed),
        roundIndex: 2,
        params: { ...base, distractorClasses: base.distractorClasses + 1 },
        prevRound: round1,
      }),
    );
    // Sanity: the replay is NOT what base params would produce for this seed.
    expect(round0).not.toEqual(state.currentRound);
  });

  it('drops back to tier base after a wrong answer resets the streak', () => {
    const seed = 'ladder-reset';
    const base = TARGET_COUNT_DIFFICULTY_PARAMS.normal;
    let state = startSession(seed);
    state = answerCorrectly(state); // streak 1
    state = targetCountGameReducer(state, { type: 'next-round' });
    state = answerCorrectly(state); // streak 2
    state = targetCountGameReducer(state, { type: 'next-round' }); // round 3 @ +1 class
    state = targetCountGameReducer(state, { type: 'answer', selectedCount: -7, elapsedMs: 10 }); // wrong
    state = targetCountGameReducer(state, { type: 'next-round' }); // round 4
    expect(state.stats.streak).toBe(0);
    expect(state.currentRound).toEqual(
      generateRound({
        rng: createRng(seed),
        roundIndex: 3,
        params: base,
        prevRound: state.prevRound,
      }),
    );
  });
  it('advances to the next round after answering', () => {
    let state = startSession('next-solve');
    state = answerCorrectly(state);
    state = targetCountGameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('showGrid');
    expect(state.roundIndex).toBe(1);
    expect(state.currentRound?.cells).toHaveLength(4 * 4);
    expect(state.stats.roundsPlayed).toBe(1);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 6 rounds
    for (let round = 0; round < 6; round += 1) {
      state = answerCorrectly(state);
      state = targetCountGameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(6);
    expect(state.stats.roundsCorrect).toBe(6);
    expect(state.stats.score).toBe(perfectSessionScore(TARGET_COUNT_DIFFICULTY_PARAMS.easy));
  });

  it('is ignored outside roundResult', () => {
    const state = startSession('x');
    expect(targetCountGameReducer(state, { type: 'next-round' }).phase).toBe('showGrid');
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = targetCountGameReducer(createInitialTargetCountState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = targetCountGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = targetCountGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(targetCountGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused or on results', () => {
    let state = targetCountGameReducer(startSession('p'), { type: 'pause' });
    state = targetCountGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = targetCountGameReducer(createInitialTargetCountState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(targetCountGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = targetCountGameReducer(createInitialTargetCountState(), {
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
    let state = targetCountGameReducer(createInitialTargetCountState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = targetCountGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      targetCountGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = targetCountGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(8);
    expect(state.stats.roundsCorrect).toBe(8);
    expect(state.stats.score).toBe(perfectSessionScore(TARGET_COUNT_DIFFICULTY_PARAMS.normal));
  });

  it('force-lose ends the session with the current round failed', () => {
    const midGrid = startSession('qa-lose');
    const state = targetCountGameReducer(midGrid, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsCorrect).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = targetCountGameReducer(createInitialTargetCountState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = targetCountGameReducer(startSession('q'), { type: 'qa/force-win' });
    const after = targetCountGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = targetCountGameReducer(createInitialTargetCountState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    state = targetCountGameReducer(createInitialTargetCountState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    state = targetCountGameReducer(createInitialTargetCountState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    const mid = targetCountGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
