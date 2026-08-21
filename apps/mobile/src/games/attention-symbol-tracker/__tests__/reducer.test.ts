// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { symbolTrackerGameReducer } from '../reducer';
import { createInitialSymbolTrackerState } from '../types';
import type { QaForceStatePatch, SymbolTrackerGameState } from '../types';
import { EMPTY, generateRound } from '../generator';
import {
  perfectSessionScore,
  referenceMaxRecall as refMax,
} from '../scoring';
import { SYMBOL_TRACKER_DIFFICULTY_PARAMS } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): SymbolTrackerGameState {
  let state = createInitialSymbolTrackerState();
  state = symbolTrackerGameReducer(state, { type: 'select-difficulty', level });
  state = symbolTrackerGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
  });
  return state;
}

function toRespond(state: SymbolTrackerGameState): SymbolTrackerGameState {
  return symbolTrackerGameReducer(state, { type: 'observe-tick' });
}

/** Respond-board cell indexes holding the given symbol ids. */
function cellsForSymbols(
  state: SymbolTrackerGameState,
  symbolIds: readonly number[],
): number[] {
  const wanted = new Set(symbolIds);
  const cells: number[] = [];
  state.respondBoard.forEach((id, index) => {
    if (id !== EMPTY && wanted.has(id)) {
      cells.push(index);
    }
  });
  return cells;
}

/** First respond-board cell holding a non-tracked token (a wrong pick). */
function wrongTokenCell(state: SymbolTrackerGameState): number {
  const tracked = new Set(state.trackedSymbolIds);
  const index = state.respondBoard.findIndex(
    (id) => id !== EMPTY && !tracked.has(id),
  );
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = symbolTrackerGameReducer(createInitialSymbolTrackerState(), {
      type: 'select-difficulty',
      level: 'hard',
    });
    expect(state.difficulty).toBe('hard');
  });
  it('ignores selection mid-session', () => {
    const state = symbolTrackerGameReducer(startSession('x'), {
      type: 'select-difficulty',
      level: 'easy',
    });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('opens round 1 in the observe phase with a valid board', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('observe');
    expect(state.profile?.level).toBe('normal');
    expect(state.trackCount).toBe(2);
    expect(state.observeBoard.filter((id) => id !== EMPTY)).toHaveLength(6);
    expect(state.trackedSymbolIds).toHaveLength(2);
    const tokens = new Set(state.observeBoard.filter((id) => id !== EMPTY));
    for (const id of state.trackedSymbolIds) {
      expect(tokens.has(id)).toBe(true);
    }
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('determinism: same seed → same boards and tracked set', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.observeBoard).toEqual(b.observeBoard);
    expect(a.respondBoard).toEqual(b.respondBoard);
    expect(a.trackedSymbolIds).toEqual(b.trackedSymbolIds);
    const expected = generateRound({
      rng: createRng('det'),
      roundIndex: 0,
      gridSize: 9,
      tokenCount: 6,
      trackCount: 2,
      distractors: 0,
      prevTracked: null,
    });
    expect(a.observeBoard).toEqual(expected.observeBoard);
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.trackCount).toBe(3);
    expect(expert.profile?.parameters.gridSize).toBe(16);
    expect(expert.observeBoard.filter((id) => id !== EMPTY)).toHaveLength(9);
    const easy = startSession('e2', 'easy');
    expect(easy.trackCount).toBe(1);
  });
});

describe('observe-tick', () => {
  it('reveals the scrambled respond board after the observe window', () => {
    let state = startSession('r');
    expect(state.phase).toBe('observe');
    state = symbolTrackerGameReducer(state, { type: 'observe-tick' });
    expect(state.phase).toBe('respond');
    expect(state.selections).toEqual([]);
  });
  it('is ignored outside observe or while paused', () => {
    const responded = toRespond(startSession('r'));
    expect(
      symbolTrackerGameReducer(responded, { type: 'observe-tick' }).phase,
    ).toBe('respond');
    const paused = symbolTrackerGameReducer(startSession('r'), { type: 'pause' });
    expect(
      symbolTrackerGameReducer(paused, { type: 'observe-tick' }).phase,
    ).toBe('observe');
  });
});

describe('tap-cell + submit', () => {
  function toRespondState(seed = 'tap'): SymbolTrackerGameState {
    return toRespond(startSession(seed));
  }

  it('toggles a symbol selection by identity', () => {
    let state = toRespondState();
    const cell = cellsForSymbols(state, state.trackedSymbolIds)[0];
    const symbolId = state.respondBoard[cell];
    state = symbolTrackerGameReducer(state, { type: 'tap-cell', index: cell });
    expect(state.selections).toContain(symbolId);
    state = symbolTrackerGameReducer(state, { type: 'tap-cell', index: cell });
    expect(state.selections).not.toContain(symbolId);
  });

  it('ignores taps on empty cells and outside the respond phase', () => {
    let state = toRespondState();
    const emptyCell = state.respondBoard.indexOf(EMPTY);
    expect(emptyCell).toBeGreaterThanOrEqual(0); // normal has 9 cells / 6 tokens
    state = symbolTrackerGameReducer(state, { type: 'tap-cell', index: emptyCell });
    expect(state.selections).toEqual([]);
    // observe-phase taps are ignored entirely
    const observing = startSession('obs');
    const anyTrackedCell = observing.observeBoard.indexOf(observing.trackedSymbolIds[0]);
    const afterObserveTap = symbolTrackerGameReducer(observing, {
      type: 'tap-cell',
      index: anyTrackedCell,
    });
    expect(afterObserveTap.selections).toEqual([]);
  });

  it('passes when all tracked symbols are selected with no wrong picks', () => {
    let state = toRespondState('perfect');
    const targets = state.trackedSymbolIds;
    for (const cell of cellsForSymbols(state, targets)) {
      state = symbolTrackerGameReducer(state, { type: 'tap-cell', index: cell });
    }
    state = symbolTrackerGameReducer(state, { type: 'submit' });
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.roundCorrectTargets).toBe(targets.length);
    expect(state.roundWrongTaps).toBe(0);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.bestRecall).toBe(targets.length);
    expect(state.stats.score).toBeGreaterThan(0);
  });

  it('fails but gives partial credit when some tracked symbols are missed', () => {
    let state = toRespondState('partial');
    const firstTargetCell = cellsForSymbols(state, state.trackedSymbolIds)[0];
    state = symbolTrackerGameReducer(state, {
      type: 'tap-cell',
      index: firstTargetCell,
    });
    state = symbolTrackerGameReducer(state, { type: 'submit' });
    expect(state.roundOutcome).toBe('failed');
    expect(state.roundCorrectTargets).toBe(1);
    expect(state.stats.correctTargets).toBe(1);
    expect(state.stats.score).toBeGreaterThan(0); // partial credit
  });

  it('penalizes wrong picks', () => {
    let state = toRespondState('wrong');
    state = symbolTrackerGameReducer(state, {
      type: 'tap-cell',
      index: wrongTokenCell(state),
    });
    state = symbolTrackerGameReducer(state, { type: 'submit' });
    expect(state.roundWrongTaps).toBe(1);
    expect(state.stats.wrongTaps).toBe(1);
    expect(state.stats.score).toBe(0); // fraction 0 minus penalty floors at 0
  });

  it('cannot submit or tap after submit (no double counting)', () => {
    let state = toRespondState('double');
    for (const cell of cellsForSymbols(state, state.trackedSymbolIds)) {
      state = symbolTrackerGameReducer(state, { type: 'tap-cell', index: cell });
    }
    state = symbolTrackerGameReducer(state, { type: 'submit' });
    const before = state.stats.roundsPlayed;
    state = symbolTrackerGameReducer(state, { type: 'tap-cell', index: 0 });
    state = symbolTrackerGameReducer(state, { type: 'submit' });
    expect(state.stats.roundsPlayed).toBe(before);
  });
});

describe('next-round', () => {
  it('escalates after a pass and regenerates a distinct round', () => {
    let state = toRespond(startSession('esc'));
    for (const cell of cellsForSymbols(state, state.trackedSymbolIds)) {
      state = symbolTrackerGameReducer(state, { type: 'tap-cell', index: cell });
    }
    state = symbolTrackerGameReducer(state, { type: 'submit' });
    const prevTracked = state.trackedSymbolIds;
    state = symbolTrackerGameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('observe');
    expect(state.roundIndex).toBe(1);
    expect(state.trackCount).toBe(3);
    expect(state.prevTracked).toEqual(prevTracked);
    expect(state.trackedSymbolIds).not.toEqual(prevTracked);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 4 rounds, track 1
    for (let round = 0; round < 4; round += 1) {
      state = symbolTrackerGameReducer(state, { type: 'observe-tick' });
      for (const cell of cellsForSymbols(state, state.trackedSymbolIds)) {
        state = symbolTrackerGameReducer(state, { type: 'tap-cell', index: cell });
      }
      state = symbolTrackerGameReducer(state, { type: 'submit' });
      state = symbolTrackerGameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
    expect(state.stats.score).toBe(
      perfectSessionScore(SYMBOL_TRACKER_DIFFICULTY_PARAMS.easy),
    );
    expect(state.stats.bestRecall).toBe(
      refMax(SYMBOL_TRACKER_DIFFICULTY_PARAMS.easy),
    );
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const intro = symbolTrackerGameReducer(createInitialSymbolTrackerState(), {
      type: 'pause',
    });
    expect(intro.paused).toBe(false);
    let state = symbolTrackerGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = symbolTrackerGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(symbolTrackerGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = symbolTrackerGameReducer(createInitialSymbolTrackerState(), {
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
    let state = symbolTrackerGameReducer(createInitialSymbolTrackerState(), {
      type: 'persistence-started',
    });
    expect(state.persistState).toBe('started');
    state = symbolTrackerGameReducer(state, {
      type: 'persistence-failed',
      message: 'boom',
    });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      symbolTrackerGameReducer(state, { type: 'persistence-succeeded' })
        .persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = symbolTrackerGameReducer(startSession('qa-win'), {
      type: 'qa/force-win',
    });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(5);
    expect(state.stats.roundsPassed).toBe(5);
    expect(state.stats.score).toBe(
      perfectSessionScore(SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal),
    );
    expect(state.stats.bestRecall).toBe(
      refMax(SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal),
    );
    expect(state.stats.wrongTaps).toBe(0);
  });

  it('force-lose ends the session with the current round failed', () => {
    const state = symbolTrackerGameReducer(startSession('qa-lose'), {
      type: 'qa/force-lose',
    });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
  });

  it('force-lose does not double-count an already-scored round', () => {
    let state = toRespond(startSession('qa-lose-2'));
    for (const cell of cellsForSymbols(state, state.trackedSymbolIds)) {
      state = symbolTrackerGameReducer(state, { type: 'tap-cell', index: cell });
    }
    state = symbolTrackerGameReducer(state, { type: 'submit' });
    expect(state.stats.roundsPlayed).toBe(1);
    state = symbolTrackerGameReducer(state, { type: 'qa/force-lose' });
    expect(state.stats.roundsPlayed).toBe(1);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = symbolTrackerGameReducer(createInitialSymbolTrackerState(), {
      type: 'qa/force-win',
    });
    expect(intro.phase).toBe('intro');
    const results = symbolTrackerGameReducer(startSession('done'), {
      type: 'qa/force-win',
    });
    // force-win from observe jumps straight to results; a second one is a no-op.
    const again = symbolTrackerGameReducer(results, { type: 'qa/force-lose' });
    expect(again.stats.roundsPlayed).toBe(results.stats.roundsPlayed);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = symbolTrackerGameReducer(createInitialSymbolTrackerState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // Invalid difficulty strings are rejected by the isDifficultyLevel guard
    // (the patch travels untyped through the QA surface, hence the cast).
    state = symbolTrackerGameReducer(state, {
      type: 'qa/force-state',
      patch: { difficulty: 'bogus' } as unknown as QaForceStatePatch,
    });
    expect(state.difficulty).toBe('expert');
    const mid = symbolTrackerGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
