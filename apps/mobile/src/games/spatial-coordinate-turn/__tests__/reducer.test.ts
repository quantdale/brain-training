// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { gameReducer } from '../reducer';
import { createInitialSpatialCoordinateTurnState } from '../types';
import type { SpatialCoordinateTurnGameState } from '../types';
import { generateSession } from '../generator';
import { perfectSessionScore } from '../scoring';
import { DIFFICULTY_PARAMS } from '../difficulty';
import type { DifficultyLevel } from '@/sdk';

function startSession(
  seed: string,
  level: 'easy' | 'normal' | 'hard' | 'expert' | 'adaptive' = 'normal',
  sessionId = 's1',
): SpatialCoordinateTurnGameState {
  let state = createInitialSpatialCoordinateTurnState();
  state = gameReducer(state, { type: 'select-difficulty', level });
  state = gameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
  });
  return state;
}

/** Advance to the choice phase of the current round. */
function toChoice(state: SpatialCoordinateTurnGameState): SpatialCoordinateTurnGameState {
  return gameReducer(state, { type: 'next-round' });
}

/** Answer the current round (any index) and move to the next brief. */
function answerAndAdvance(
  state: SpatialCoordinateTurnGameState,
  index: number,
  answerMs = 0,
): SpatialCoordinateTurnGameState {
  const answered = gameReducer(state, { type: 'select-answer', index, answerMs });
  return gameReducer(answered, { type: 'next-round' });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = gameReducer(createInitialSpatialCoordinateTurnState(), {
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
  it('opens round 1 in the brief phase with a generated plan', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('brief');
    expect(state.profile?.level).toBe('normal');
    expect(state.rounds).toBe(DIFFICULTY_PARAMS.normal.rounds);
    expect(state.plan).toHaveLength(DIFFICULTY_PARAMS.normal.rounds);
    expect(state.roundIndex).toBe(0);
    expect(state.round).toEqual(state.plan[0]);
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
    expect(state.paused).toBe(false);
  });

  it('determinism: same seed → same plan', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.plan).toEqual(b.plan);
    expect(a.plan).toEqual(generateSession('det', DIFFICULTY_PARAMS.normal));
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.profile?.parameters.directions).toBe(8);
    expect(expert.rounds).toBe(12);
    const easy = startSession('e2', 'easy');
    expect(easy.profile?.parameters.rounds).toBe(8);
  });
});

describe('select-answer', () => {
  it('scores a correct pick with speed bonus and updates streaks', () => {
    const state = toChoice(startSession('correct'));
    const round = state.round!;
    const answered = gameReducer(state, {
      type: 'select-answer',
      index: round.correctIndex,
      answerMs: 0,
    });
    expect(answered.phase).toBe('roundResult');
    expect(answered.roundOutcome).toBe('correct');
    expect(answered.selectedOptionIndex).toBe(round.correctIndex);
    expect(answered.stats.score).toBe(perfectSessionScore({ ...DIFFICULTY_PARAMS.normal, rounds: 1 }));
    expect(answered.stats.roundsPlayed).toBe(1);
    expect(answered.stats.correctPicks).toBe(1);
    expect(answered.stats.streak).toBe(1);
    expect(answered.stats.bestStreak).toBe(1);
    expect(answered.stats.mistakes).toBe(0);
  });

  it('counts a wrong pick as a mistake and resets the streak', () => {
    const state = toChoice(startSession('wrong'));
    const round = state.round!;
    const wrongIndex = (round.correctIndex + 1) % round.options.length;
    const answered = gameReducer(state, {
      type: 'select-answer',
      index: wrongIndex,
      answerMs: 1200,
    });
    expect(answered.phase).toBe('roundResult');
    expect(answered.roundOutcome).toBe('wrong');
    expect(answered.stats.mistakes).toBe(1);
    expect(answered.stats.correctPicks).toBe(0);
    expect(answered.stats.streak).toBe(0);
    expect(answered.stats.score).toBe(0);
    expect(answered.stats.totalResponseMs).toBe(1200);
  });

  it('counts position trials separately on expert sessions', () => {
    // Drive an expert session until a position round is reached.
    let state = startSession('pos-trials', 'expert');
    let guard = 0;
    while (state.round!.task !== 'position' && guard < 20) {
      state = answerAndAdvance(toChoice(state), state.round!.correctIndex); // play correctly
      guard += 1;
    }
    expect(state.round!.task).toBe('position');
    const before = state.stats;
    const answered = gameReducer(toChoice(state), {
      type: 'select-answer',
      index: state.round!.correctIndex,
      answerMs: 100,
    });
    expect(answered.stats.positionTrials).toBe(before.positionTrials + 1);
    expect(answered.stats.positionCorrect).toBe(before.positionCorrect + 1);
  });

  it('is ignored outside choice, while paused, or after answering', () => {
    const brief = startSession('guards');
    const untouched = gameReducer(brief, { type: 'select-answer', index: 0, answerMs: 0 });
    expect(untouched.phase).toBe('brief');
    expect(untouched.stats.roundsPlayed).toBe(0);

    const paused = gameReducer(toChoice(startSession('guards')), { type: 'pause' });
    const stillChoice = gameReducer(paused, { type: 'select-answer', index: 0, answerMs: 0 });
    expect(stillChoice.phase).toBe('choice');
    expect(stillChoice.paused).toBe(true);
    expect(stillChoice.stats.roundsPlayed).toBe(0);

    const chosen = toChoice(startSession('guards'));
    const answered = gameReducer(chosen, { type: 'select-answer', index: 0, answerMs: 0 });
    const again = gameReducer(answered, { type: 'select-answer', index: 1, answerMs: 0 });
    expect(again.stats.roundsPlayed).toBe(1); // no double counting
  });
});

describe('next-round', () => {
  it('reveals options from the brief phase', () => {
    const state = gameReducer(startSession('reveal'), { type: 'next-round' });
    expect(state.phase).toBe('choice');
  });

  it('advances to the next brief and clears the selection', () => {
    const chosen = toChoice(startSession('advance'));
    const answered = gameReducer(chosen, {
      type: 'select-answer',
      index: chosen.round!.correctIndex,
      answerMs: 0,
    });
    const next = gameReducer(answered, { type: 'next-round' });
    expect(next.phase).toBe('brief');
    expect(next.roundIndex).toBe(1);
    expect(next.round).toEqual(next.plan[1]);
    expect(next.selectedOptionIndex).toBeNull();
    expect(next.roundOutcome).toBeNull();
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 8 rounds
    for (let i = 0; i < DIFFICULTY_PARAMS.easy.rounds; i += 1) {
      state = answerAndAdvance(toChoice(state), state.round!.correctIndex);
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(DIFFICULTY_PARAMS.easy.rounds);
    expect(state.stats.score).toBe(
      perfectSessionScore(DIFFICULTY_PARAMS.easy),
    );
  });

  it('is ignored outside brief/roundResult', () => {
    const intro = gameReducer(createInitialSpatialCoordinateTurnState(), { type: 'next-round' });
    expect(intro.phase).toBe('intro');
    const chosen = toChoice(startSession('noop'));
    expect(gameReducer(chosen, { type: 'next-round' }).phase).toBe('choice');
    const done = gameReducer(startSession('noop'), { type: 'qa/force-lose' });
    expect(done.phase).toBe('results');
    expect(gameReducer(done, { type: 'next-round' }).phase).toBe('results');
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const intro = gameReducer(createInitialSpatialCoordinateTurnState(), { type: 'pause' });
    expect(intro.paused).toBe(false);

    let state = gameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = gameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(gameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('does not pause in results', () => {
    let state = startSession('pr2', 'easy');
    for (let i = 0; i < DIFFICULTY_PARAMS.easy.rounds; i += 1) {
      state = answerAndAdvance(toChoice(state), state.round!.correctIndex);
    }
    expect(state.phase).toBe('results');
    expect(gameReducer(state, { type: 'pause' }).paused).toBe(false);
  });

  it('blocks answering while paused', () => {
    const paused = gameReducer(toChoice(startSession('block')), { type: 'pause' });
    const answered = gameReducer(paused, {
      type: 'select-answer',
      index: paused.round!.correctIndex,
      answerMs: 0,
    });
    expect(answered.phase).toBe('choice');
    expect(answered.stats.roundsPlayed).toBe(0);
  });
});

describe('tutorial open / close', () => {
  it('toggles the tutorial overlay from any phase', () => {
    let state = gameReducer(createInitialSpatialCoordinateTurnState(), { type: 'tutorial-open' });
    expect(state.tutorialOpen).toBe(true);
    state = gameReducer(state, { type: 'tutorial-close' });
    expect(state.tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = gameReducer(createInitialSpatialCoordinateTurnState(), {
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

  it('tracks persistence progress and failure detail', () => {
    let state = gameReducer(createInitialSpatialCoordinateTurnState(), {
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

  it('stores the authoritative completion outcome', () => {
    const state = gameReducer(createInitialSpatialCoordinateTurnState(), {
      type: 'completion-outcome-received',
      xp: 42,
      currency: 7,
      deltas: [{ domain: 'Spatial', delta: 1, ratingAfter: 51 }],
    });
    expect(state.authoritativeXp).toBe(42);
    expect(state.authoritativeCurrency).toBe(7);
    expect(state.authoritativeDeltas).toEqual([
      { domain: 'Spatial', delta: 1, ratingAfter: 51 },
    ]);
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = gameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats.correctPicks).toBe(DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats.mistakes).toBe(0);
    expect(state.stats.bestStreak).toBe(DIFFICULTY_PARAMS.normal.rounds);
    expect(state.stats.score).toBe(perfectSessionScore(DIFFICULTY_PARAMS.normal));
    // normal never asks position trials.
    expect(state.stats.positionTrials).toBe(0);
  });

  it('force-lose counts the in-flight round as a mistake', () => {
    const state = gameReducer(startSession('qa-lose'), { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.mistakes).toBe(1);
    expect(state.stats.correctPicks).toBe(0);
  });

  it('force-lose keeps already-scored stats when between rounds', () => {
    const answered = gameReducer(toChoice(startSession('qa-lose2')), {
      type: 'select-answer',
      index: 0, // wrong on purpose
      answerMs: 10,
    });
    const state = gameReducer(answered, { type: 'qa/force-lose' });
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1); // not double counted
    expect(state.stats.mistakes).toBe(1);
  });

  it('force-timeout ends the session without scoring the in-flight round', () => {
    const state = gameReducer(startSession('qa-to'), { type: 'qa/force-timeout' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.paused).toBe(false);
    expect(state.round).toBeNull();
    expect(state.stats.roundsPlayed).toBe(0);
    expect(state.stats.mistakes).toBe(0);
  });

  it('force actions are no-ops in intro and results', () => {
    const initial = createInitialSpatialCoordinateTurnState();
    for (const action of [
      { type: 'qa/force-win' },
      { type: 'qa/force-lose' },
      { type: 'qa/force-timeout' },
    ] as const) {
      expect(gameReducer(initial, action).phase).toBe('intro');
    }
    let done = startSession('done', 'easy');
    for (let i = 0; i < DIFFICULTY_PARAMS.easy.rounds; i += 1) {
      done = answerAndAdvance(toChoice(done), done.round!.correctIndex);
    }
    expect(gameReducer(done, { type: 'qa/force-win' }).stats.roundsPlayed).toBe(
      DIFFICULTY_PARAMS.easy.rounds,
    );
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = gameReducer(createInitialSpatialCoordinateTurnState(), {
      type: 'qa/force-state',
      patch: { seed: 42, difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('42'); // numbers are stringified
    expect(state.difficulty).toBe('expert');

    state = gameReducer(state, {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert'); // unchanged

    // Unknown difficulty values are ignored.
    state = gameReducer(state, {
      type: 'qa/force-state',
      patch: { difficulty: 'impossible' as unknown as DifficultyLevel },
    });
    expect(state.difficulty).toBe('expert');

    // Mid-session the patch is refused.
    const mid = gameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
