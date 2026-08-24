// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { tapRushGameReducer } from '../reducer';
import { tapRushParamsFromProfile , TAP_RUSH_DIFFICULTY_PARAMS } from '../difficulty';
import { createInitialTapRushState } from '../types';
import type { TapRushGameState } from '../types';
import { generateRoundTargets } from '../generator';
import { perfectSessionScore } from '../scoring';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
  spawnedAtMs = 1000,
): TapRushGameState {
  let state = createInitialTapRushState();
  state = tapRushGameReducer(state, { type: 'select-difficulty', level });
  state = tapRushGameReducer(state, {
    type: 'start-session',
    seed,
    sessionId,
    startedAtMs: 100,
    spawnedAtMs,
  });
  return state;
}

/** Tap the live target's exact center (a deterministic hit). */
function tapLiveTarget(state: TapRushGameState, nowMs: number): TapRushGameState {
  const target = state.targets[state.targetIndex];
  return tapRushGameReducer(state, { type: 'tap', x: target.x, y: target.y, nowMs });
}

/**
 * A point exactly `2 * radius` horizontally away from the live target —
 * always inside the field when the target is (flip direction at the edge),
 * always outside the target's circle.
 */
function outsidePoint(
  target: { x: number; y: number },
  radius: number,
): { x: number; y: number } {
  const dx = target.x + 2 * radius <= 1 ? 2 * radius : -2 * radius;
  return { x: target.x + dx, y: target.y };
}

/** Tap clearly outside the live target (a deterministic wrong tap). */
function tapOutside(state: TapRushGameState, nowMs: number): TapRushGameState {
  const target = state.targets[state.targetIndex];
  const params = tapRushParamsFromProfile(state.profile as NonNullable<TapRushGameState['profile']>);
  const point = outsidePoint(target, params.targetRadius);
  return tapRushGameReducer(state, { type: 'tap', x: point.x, y: point.y, nowMs });
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = tapRushGameReducer(createInitialTapRushState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = tapRushGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 with a live first target', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('active');
    expect(state.profile?.level).toBe('normal');
    expect(state.windowMs).toBe(1100);
    expect(state.targets).toHaveLength(10);
    expect(state.targetIndex).toBe(0);
    expect(state.spawnedAtMs).toBe(1000);
    expect(state.deadlineMs).toBe(2100);
    expect(state.stats).toEqual({
      score: 0,
      targetsHit: 0,
      targetsMissed: 0,
      wrongTaps: 0,
      reactions: [],
      speedFactors: [],
      bestStreak: 0,
      streak: 0,
      roundsPlayed: 0,
      roundsPassed: 0,
      perfectRounds: 0,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same placement for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.targets).toEqual(b.targets);
    expect(a.targets).toEqual(
      generateRoundTargets({
        rng: createRng('det'),
        roundIndex: 0,
        count: 10,
        radius: 0.075,
      }),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.windowMs).toBe(700);
    expect(expert.targets).toHaveLength(14);
    const adaptive = startSession('a', 'adaptive');
    expect(adaptive.windowMs).toBe(1100);
    expect(adaptive.profile?.level).toBe('adaptive');
  });
});

describe('tap', () => {
  it('scores a hit with the reaction-derived speed factor', () => {
    let state = startSession('tap');
    state = tapLiveTarget(state, 1100); // reaction 100 ms
    expect(state.stats.targetsHit).toBe(1);
    expect(state.stats.reactions).toEqual([100]);
    expect(state.stats.speedFactors[0]).toBeCloseTo(1000 / 1100);
    expect(state.stats.score).toBeCloseTo(100 + 50 * (1000 / 1100));
    expect(state.stats.streak).toBe(1);
    expect(state.stats.bestStreak).toBe(1);
    expect(state.targetIndex).toBe(1);
    expect(state.spawnedAtMs).toBe(1100);
    expect(state.deadlineMs).toBe(2200);
    expect(state.phase).toBe('active');
  });

  it('counts an outside tap as a wrong tap that loses the target', () => {
    let state = startSession('tap-wrong');
    state = tapOutside(state, 1000);
    expect(state.stats.targetsMissed).toBe(1);
    expect(state.stats.wrongTaps).toBe(1);
    expect(state.stats.streak).toBe(0);
    expect(state.roundMisses).toBe(1);
    expect(state.roundWrongs).toBe(1);
    expect(state.targetIndex).toBe(1);
  });

  it('ignores taps after the window closed (the expiry timer owns that)', () => {
    const state = startSession('late-tap');
    expect(state.deadlineMs).toBe(2100);
    const after = tapRushGameReducer(state, { type: 'tap', x: 0.5, y: 0.5, nowMs: 2200 });
    expect(after.stats.targetsHit).toBe(0);
    expect(after.targetIndex).toBe(0);
  });

  it('is ignored outside the active phase or while paused', () => {
    const roundResult = tapRushGameReducer(startSession('x'), { type: 'pause' });
    expect(tapRushGameReducer(roundResult, { type: 'tap', x: 0.5, y: 0.5, nowMs: 1500 }).paused).toBe(true);
    const intro = tapRushGameReducer(createInitialTapRushState(), { type: 'tap', x: 0.5, y: 0.5, nowMs: 0 });
    expect(intro.phase).toBe('intro');
  });
});

describe('target-expired', () => {
  it('counts a miss and advances to the next target', () => {
    let state = startSession('expire');
    state = tapRushGameReducer(state, { type: 'target-expired', nowMs: 2100 });
    expect(state.stats.targetsMissed).toBe(1);
    expect(state.stats.streak).toBe(0);
    expect(state.roundMisses).toBe(1);
    expect(state.targetIndex).toBe(1);
    expect(state.spawnedAtMs).toBe(2100);
    expect(state.deadlineMs).toBe(3200);
  });
});

describe('round completion', () => {
  it('passes a round when every target is hit and awards the perfect bonus', () => {
    let state = startSession('round-pass');
    for (let i = 0; i < 10; i += 1) {
      state = tapLiveTarget(state, 1000); // instant hits
    }
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('passed');
    expect(state.roundHits).toBe(10);
    expect(state.roundMisses).toBe(0);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(1);
    expect(state.stats.perfectRounds).toBe(1);
    expect(state.stats.targetsHit).toBe(10);
    // 10 instant hits × 150 pts + 500 perfect-round bonus
    expect(state.stats.score).toBe(2000);
    expect(state.stats.bestStreak).toBe(10);
  });

  it('fails a round with any miss/wrong and skips the bonus', () => {
    let state = startSession('round-fail');
    state = tapOutside(state, 1000); // wrong tap → miss
    for (let i = 1; i < 10; i += 1) {
      state = tapLiveTarget(state, 1000);
    }
    expect(state.phase).toBe('roundResult');
    expect(state.roundOutcome).toBe('failed');
    expect(state.roundMisses).toBe(1);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.perfectRounds).toBe(0);
    expect(state.stats.score).toBe(9 * 150); // no perfect bonus
  });
});

describe('next-round', () => {
  it('shrinks the window after a passed round and regenerates targets', () => {
    let state = startSession('escalate');
    for (let i = 0; i < 10; i += 1) {
      state = tapLiveTarget(state, 1000);
    }
    state = tapRushGameReducer(state, { type: 'next-round', spawnedAtMs: 2000 });
    expect(state.phase).toBe('active');
    expect(state.roundIndex).toBe(1);
    expect(state.windowMs).toBe(1000);
    expect(state.targets).toHaveLength(10);
    expect(state.targets).not.toEqual(
      generateRoundTargets({ rng: createRng('escalate'), roundIndex: 0, count: 10, radius: 0.075 }),
    );
    expect(state.spawnedAtMs).toBe(2000);
    expect(state.deadlineMs).toBe(3000);
  });

  it('holds the window after a failed round', () => {
    let state = startSession('hold');
    state = tapOutside(state, 1000);
    state = tapRushGameReducer(state, { type: 'next-round', spawnedAtMs: 2000 });
    expect(state.windowMs).toBe(1100);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 3 rounds × 8 targets
    for (let round = 0; round < 3; round += 1) {
      for (let i = 0; i < 8; i += 1) {
        state = tapLiveTarget(state, 1000);
      }
      state = tapRushGameReducer(state, { type: 'next-round', spawnedAtMs: 3000 });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(3);
    expect(state.stats.roundsPassed).toBe(3);
    expect(state.stats.perfectRounds).toBe(3);
    expect(state.stats.score).toBe(perfectSessionScore(TAP_RUSH_DIFFICULTY_PARAMS.easy));
  });
});

describe('adaptive', () => {
  it('shrinks the window on a pass and widens it on a failure', () => {
    let passed = startSession('adaptive-pass', 'adaptive');
    for (let i = 0; i < 10; i += 1) {
      passed = tapLiveTarget(passed, 1000);
    }
    passed = tapRushGameReducer(passed, { type: 'next-round', spawnedAtMs: 2000 });
    expect(passed.windowMs).toBe(1000);

    let failed = startSession('adaptive-fail', 'adaptive');
    failed = tapOutside(failed, 1000);
    for (let i = 1; i < 10; i += 1) {
      failed = tapLiveTarget(failed, 1000);
    }
    failed = tapRushGameReducer(failed, { type: 'next-round', spawnedAtMs: 2000 });
    expect(failed.windowMs).toBe(1200);
  });
});

describe('pause / resume', () => {
  it('pauses during a session and resumes with the window re-anchored', () => {
    const inIntro = tapRushGameReducer(createInitialTapRushState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);

    let state = tapRushGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);

    // Pause at t=1000 with 1100 ms of window left: resume at t=5000 must
    // exclude the 4000 ms of pause from both deadline and reaction.
    state = tapRushGameReducer(state, { type: 'resume', nowMs: 5000, remainingMs: 1100 });
    expect(state.paused).toBe(false);
    expect(state.deadlineMs).toBe(6100);
    expect(state.spawnedAtMs).toBe(5000);

    // A hit right after resume measures only the active time since spawn.
    const target = state.targets[state.targetIndex];
    const hit = tapRushGameReducer(state, { type: 'tap', x: target.x, y: target.y, nowMs: 5200 });
    expect(hit.stats.reactions).toEqual([200]);
  });

  it('cannot pause on results and resumes only from paused', () => {
    let state = startSession('p');
    state = tapRushGameReducer(state, { type: 'pause' });
    expect(tapRushGameReducer(state, { type: 'pause' }).paused).toBe(true);
    expect(tapRushGameReducer(state, { type: 'resume', nowMs: 0, remainingMs: 0 }).paused).toBe(false);
    expect(
      tapRushGameReducer(
        tapRushGameReducer(state, { type: 'resume', nowMs: 0, remainingMs: 0 }),
        { type: 'resume', nowMs: 0, remainingMs: 0 },
      ).paused,
    ).toBe(false);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = tapRushGameReducer(createInitialTapRushState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(tapRushGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = tapRushGameReducer(createInitialTapRushState(), {
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
    let state = tapRushGameReducer(createInitialTapRushState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = tapRushGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(
      tapRushGameReducer(state, { type: 'persistence-succeeded' }).persistState,
    ).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run and marks it forced', () => {
    const state = tapRushGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(4);
    expect(state.stats.roundsPassed).toBe(4);
    expect(state.stats.perfectRounds).toBe(4);
    expect(state.stats.targetsHit).toBe(40);
    expect(state.stats.bestStreak).toBe(10);
    expect(state.stats.score).toBe(perfectSessionScore(TAP_RUSH_DIFFICULTY_PARAMS.normal));
  });

  it('force-lose ends the session with the round unresolved targets missed', () => {
    let state = startSession('qa-lose');
    state = tapLiveTarget(state, 1000); // 1 hit, 9 unresolved
    state = tapRushGameReducer(state, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.targetsHit).toBe(1);
    expect(state.stats.targetsMissed).toBe(9);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.streak).toBe(0);
  });

  it('force-lose from a scored round result keeps the recorded outcome', () => {
    let state = startSession('qa-lose2');
    for (let i = 0; i < 10; i += 1) {
      state = tapLiveTarget(state, 1000);
    }
    expect(state.roundOutcome).toBe('passed');
    const result = tapRushGameReducer(state, { type: 'qa/force-lose' });
    expect(result.stats.roundsPlayed).toBe(1);
    expect(result.stats.roundsPassed).toBe(1);
    expect(result.stats.targetsMissed).toBe(0);
    expect(result.forced).toBe(true);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = tapRushGameReducer(createInitialTapRushState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = tapRushGameReducer(createInitialTapRushState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    // numeric seeds normalize to strings
    state = tapRushGameReducer(createInitialTapRushState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    // invalid difficulty is ignored
    state = tapRushGameReducer(createInitialTapRushState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    // ignored mid-session
    const mid = tapRushGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});