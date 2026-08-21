// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import type { DifficultyLevel } from '@/sdk';

import {
  ADAPTIVE_PARAMS,
  DIFFICULTY_PARAMS,
  resolveSpatialFoldMatchDifficulty,
} from '../difficulty';
import { gameReducer } from '../reducer';
import { perfectSessionScore } from '../scoring';
import { FOLD_LABELS, createInitialSpatialFoldMatchState } from '../types';
import type { SpatialFoldMatchGameState } from '../types';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): SpatialFoldMatchGameState {
  let state = createInitialSpatialFoldMatchState();
  state = gameReducer(state, { type: 'select-difficulty', level });
  state = gameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
  });
  return state;
}

function toChoice(seed = 'choice'): SpatialFoldMatchGameState {
  return gameReducer(startSession(seed), { type: 'source-tick' });
}

function answerCorrect(state: SpatialFoldMatchGameState, answerMs = 0): SpatialFoldMatchGameState {
  return gameReducer(state, {
    type: 'select-option',
    index: state.correctOptionIndex,
    answerMs,
  });
}

function answerWrong(state: SpatialFoldMatchGameState): SpatialFoldMatchGameState {
  const wrongIndex = (state.correctOptionIndex + 1) % state.options.length;
  return gameReducer(state, { type: 'select-option', index: wrongIndex, answerMs: 10 });
}

/** Plays an entire easy session (all correct) to reach the results phase. */
function toResults(seed: string): SpatialFoldMatchGameState {
  let state = startSession(seed, 'easy');
  for (let round = 0; round < DIFFICULTY_PARAMS.easy.rounds; round += 1) {
    state = gameReducer(state, { type: 'source-tick' });
    state = answerCorrect(state);
    state = gameReducer(state, { type: 'next-round' });
  }
  return state;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = gameReducer(createInitialSpatialFoldMatchState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = gameReducer(startSession('x'), {
      type: 'select-difficulty',
      level: 'easy',
    });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('opens round 1 in the source phase with a valid round', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('source');
    expect(state.profile?.level).toBe('normal');
    expect(state.roundIndex).toBe(0);
    expect(state.sourceGrid.length).toBe(3);
    expect(state.options.length).toBeGreaterThan(1);
    expect(state.correctOptionIndex).toBeGreaterThanOrEqual(0);
    expect(state.correctOptionIndex).toBeLessThan(state.options.length);
    expect(state.foldLabel).toBe(FOLD_LABELS[state.foldType]);
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
    expect(state.stats.roundsPlayed).toBe(0);
  });

  it('determinism: same seed → same round data', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.sourceGrid).toEqual(b.sourceGrid);
    expect(a.options).toEqual(b.options);
    expect(a.correctOptionIndex).toBe(b.correctOptionIndex);
  });
});

describe('restart determinism', () => {
  it('round 0 is identical after a mid-session restart with the same seed', () => {
    const fresh = startSession('again');
    // Play into the session so prevSourceGrid/prevFoldType are populated.
    let mid = gameReducer(fresh, { type: 'source-tick' });
    mid = answerCorrect(mid);
    mid = gameReducer(mid, { type: 'next-round' });
    expect(mid.roundIndex).toBe(1);
    // Restarting must not leak the previous round's anchors into round 0.
    const restarted = gameReducer(mid, {
      type: 'start-session',
      seed: 'again',
      sessionId: 's2',
      startedAtMs: 200,
    });
    expect(restarted.roundIndex).toBe(0);
    expect(restarted.sourceGrid).toEqual(fresh.sourceGrid);
    expect(restarted.options).toEqual(fresh.options);
    expect(restarted.correctOptionIndex).toBe(fresh.correctOptionIndex);
    expect(restarted.prevSourceGrid).toBeNull();
    expect(restarted.prevFoldType).toBeNull();
  });
});

describe('source-tick', () => {
  it('moves the source phase to choice', () => {
    const state = gameReducer(startSession('r'), { type: 'source-tick' });
    expect(state.phase).toBe('choice');
    expect(state.selectedOptionIndex).toBeNull();
  });

  it('is ignored outside source or while paused', () => {
    const intro = gameReducer(createInitialSpatialFoldMatchState(), { type: 'source-tick' });
    expect(intro.phase).toBe('intro');
    const paused = gameReducer(startSession('r'), { type: 'pause' });
    expect(gameReducer(paused, { type: 'source-tick' }).phase).toBe('source');
    const choice = toChoice('r');
    expect(gameReducer(choice, { type: 'source-tick' }).phase).toBe('choice');
  });
});

describe('select-option', () => {
  it('passes on the correct option and scores with a speed bonus', () => {
    const state = answerCorrect(toChoice('perfect'), 0);
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.selectedOptionIndex).toBe(state.correctOptionIndex);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.stats.score).toBe(150); // instant answer → base + full bonus
    expect(state.stats.totalAnswerMs).toBe(0);
  });

  it('fails on a wrong option and resets the streak without scoring', () => {
    let state = answerCorrect(toChoice('wrong'), 0);
    state = gameReducer(state, { type: 'next-round' });
    state = gameReducer(state, { type: 'source-tick' });
    state = answerWrong(state);
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.stats.roundsPlayed).toBe(2);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.score).toBe(150); // unchanged by the failure
    expect(state.stats.streak).toBe(0);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.selectedOptionIndex).not.toBe(state.correctOptionIndex);
  });

  it('guards: ignored outside choice or while paused', () => {
    const source = startSession('guard');
    expect(answerCorrect(source).phase).toBe('source');
    const paused = gameReducer(toChoice('guard'), { type: 'pause' });
    expect(answerCorrect(paused)).toBe(paused); // no state change at all
    const results = toResults('guard');
    expect(results.phase).toBe('results');
    expect(answerCorrect(results)).toBe(results);
  });
});

describe('next-round', () => {
  it('advances the round and regenerates from updated anchors', () => {
    let state = answerCorrect(toChoice('advance'));
    const prevSource = state.sourceGrid;
    const prevFold = state.foldType;
    state = gameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('source');
    expect(state.roundIndex).toBe(1);
    expect(state.prevSourceGrid).toEqual(prevSource);
    expect(state.prevFoldType).toBe(prevFold);
    expect(state.selectedOptionIndex).toBeNull();
    expect(state.roundOutcome).toBeNull();
  });

  it('finishes the session after the final round', () => {
    let state = startSession('final', 'easy'); // 5 rounds
    for (let round = 0; round < 5; round += 1) {
      state = gameReducer(state, { type: 'source-tick' });
      state = answerCorrect(state);
      state = gameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.score).toBe(perfectSessionScore(DIFFICULTY_PARAMS.easy));
    expect(state.roundOutcome).toBeNull();
  });

  it('escalates adaptive parameters after a pass and de-escalates after a fail', () => {
    let state = startSession('adaptive', 'adaptive');
    expect(state.profile?.parameters.filledCells).toBe(ADAPTIVE_PARAMS.filledCells);
    state = gameReducer(state, { type: 'source-tick' });
    state = answerCorrect(state);
    state = gameReducer(state, { type: 'next-round' });
    expect(state.profile?.parameters.filledCells).toBe(4);
    expect(state.profile?.parameters.optionCount).toBe(3);
    state = gameReducer(state, { type: 'source-tick' });
    state = answerWrong(state);
    state = gameReducer(state, { type: 'next-round' });
    expect(state.profile?.parameters.filledCells).toBe(3);
    expect(state.profile?.parameters.optionCount).toBe(2);
  });

  it('is ignored outside roundResult', () => {
    const source = startSession('nr-guard');
    expect(gameReducer(source, { type: 'next-round' }).roundIndex).toBe(0);
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const intro = gameReducer(createInitialSpatialFoldMatchState(), { type: 'pause' });
    expect(intro.paused).toBe(false);
    const results = toResults('p');
    expect(gameReducer(results, { type: 'pause' }).paused).toBe(false);
    let state = gameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = gameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(gameReducer(state, { type: 'resume' }).paused).toBe(false);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial overlay', () => {
    let state = gameReducer(createInitialSpatialFoldMatchState(), { type: 'tutorial-open' });
    expect(state.tutorialOpen).toBe(true);
    state = gameReducer(state, { type: 'tutorial-close' });
    expect(state.tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = gameReducer(createInitialSpatialFoldMatchState(), {
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
    let state = gameReducer(createInitialSpatialFoldMatchState(), {
      type: 'persistence-started',
    });
    expect(state.persistState).toBe('started');
    state = gameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      gameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });

  it('stores the authoritative completion outcome when it arrives', () => {
    const state = gameReducer(createInitialSpatialFoldMatchState(), {
      type: 'completion-outcome-received',
      xp: 30,
      currency: 5,
      deltas: [{ domain: 'Memory', delta: 1, ratingAfter: 1200 }],
    });
    expect(state.authoritativeXp).toBe(30);
    expect(state.authoritativeCurrency).toBe(5);
    expect(state.authoritativeDeltas).toEqual([
      { domain: 'Memory', delta: 1, ratingAfter: 1200 },
    ]);
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = gameReducer(toChoice('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.paused).toBe(false);
    expect(state.stats.roundsPlayed).toBe(DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats.roundsPassed).toBe(DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats.bestStreak).toBe(DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats.score).toBe(perfectSessionScore(DIFFICULTY_PARAMS.normal));
  });

  it('force-lose ends the session counting the current round as failed', () => {
    const state = gameReducer(toChoice('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from roundResult does not double-count the answered round', () => {
    const answered = answerCorrect(toChoice('qa-lose-2'));
    const state = gameReducer(answered, { type: 'qa/force-lose' });
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.streak).toBe(1);
  });

  it('force win/lose are no-ops in intro and results', () => {
    const intro = createInitialSpatialFoldMatchState();
    expect(gameReducer(intro, { type: 'qa/force-win' }).phase).toBe('intro');
    expect(gameReducer(intro, { type: 'qa/force-lose' }).phase).toBe('intro');
    const results = gameReducer(toChoice('qa-noop'), { type: 'qa/force-win' });
    expect(gameReducer(results, { type: 'qa/force-win' })).toBe(results);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = gameReducer(createInitialSpatialFoldMatchState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // Numeric seeds are stringified for the canonical seed form.
    state = gameReducer(state, { type: 'qa/force-state', patch: { seed: 42 } });
    expect(state.seedOverride).toBe('42');
    // Unknown difficulty values are ignored (isDifficultyLevel guard).
    state = gameReducer(state, {
      type: 'qa/force-state',
      patch: { difficulty: 'impossible' as unknown as DifficultyLevel },
    });
    expect(state.difficulty).toBe('expert');
    // Mid-session the patch is rejected entirely.
    const mid = gameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});

describe('reducer uses the resolved profile parameters', () => {
  it('expert sessions generate optionCount options on a 4×5 board', () => {
    const state = startSession('expert-board', 'expert');
    expect(state.profile?.parameters.gridRows).toBe(4);
    expect(state.profile?.parameters.gridCols).toBe(5);
    expect(state.sourceGrid).toHaveLength(4);
    expect(state.sourceGrid[0]).toHaveLength(5);
    expect(state.options.length).toBeLessThanOrEqual(DIFFICULTY_PARAMS.expert.optionCount);
  });

  it('resolves through the SDK so profiles are persistence-shaped', () => {
    const state = startSession('profile-shape');
    expect(state.profile).toEqual(resolveSpatialFoldMatchDifficulty('normal'));
  });
});
