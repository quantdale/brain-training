/**
 * A workout summary is a record of what happened: replaying one of its games
 * later must not rewrite it. Sessions with workout provenance match their exact
 * leg; sessions without it (pre-provenance history) keep the same-game match,
 * bounded to the instance's own local calendar date.
 */
import { describe, expect, it } from '@jest/globals';

import type { WorkoutInstance } from '@/db';
import { buildWorkoutSummary, type WorkoutSessionRef } from '@/workout/summary';

const KEY = '2026-08-21';
const LOCAL_NOON = new Date(2026, 7, 21, 12).getTime();
const NEXT_DAY = new Date(2026, 7, 22, 9).getTime();

function makeInstance(overrides: Partial<WorkoutInstance> = {}): WorkoutInstance {
  return {
    date: KEY,
    gameIds: ['a', 'b', 'a'],
    status: 'completed',
    currentIndex: 3,
    rerollAttempt: 0,
    seedVersion: 1,
    createdAt: LOCAL_NOON - 60_000,
    updatedAt: LOCAL_NOON + 600_000,
    skippedIndices: [],
    ...overrides,
  };
}

function session(overrides: Partial<WorkoutSessionRef> = {}): WorkoutSessionRef {
  return {
    gameId: 'a',
    normalizedResult: 0.5,
    xp: 10,
    durationMs: 60_000,
    completedAt: LOCAL_NOON,
    ...overrides,
  };
}

const leg = (legIndex: number, gameId = 'a', instanceKey = KEY) => ({
  instanceKey,
  legIndex,
  gameId,
});

describe('buildWorkoutSummary provenance', () => {
  it('keeps the leg session when the game is replayed the next day', () => {
    const played = session({ completedAt: LOCAL_NOON, xp: 7, workoutProvenance: leg(0) });
    const before = buildWorkoutSummary(makeInstance({ currentIndex: 1 }), [played]);
    const after = buildWorkoutSummary(makeInstance({ currentIndex: 1 }), [
      played,
      session({ completedAt: NEXT_DAY, xp: 99, normalizedResult: 1 }),
    ]);

    expect(after).toEqual(before);
    expect(after.totalXp).toBe(7);
    expect(after.finishedAt).toBe(LOCAL_NOON);
  });

  it('prefers the provenance session over a later same-day free play', () => {
    const summary = buildWorkoutSummary(makeInstance({ currentIndex: 1 }), [
      session({ completedAt: LOCAL_NOON, xp: 7, workoutProvenance: leg(0) }),
      session({ completedAt: LOCAL_NOON + 5_000, xp: 99 }),
    ]);

    expect(summary.outcomes[0].session?.xp).toBe(7);
  });

  it('assigns each repeated game to its own leg', () => {
    const summary = buildWorkoutSummary(makeInstance(), [
      session({ completedAt: LOCAL_NOON, xp: 1, workoutProvenance: leg(0) }),
      session({ gameId: 'b', completedAt: LOCAL_NOON + 1_000, xp: 2, workoutProvenance: leg(1, 'b') }),
      session({ completedAt: LOCAL_NOON + 2_000, xp: 3, workoutProvenance: leg(2) }),
    ]);

    expect(summary.outcomes.map((outcome) => outcome.session?.xp)).toEqual([1, 2, 3]);
    expect(summary.totalXp).toBe(6);
  });

  it('keeps the session that settled the leg when the same leg is replayed', () => {
    const summary = buildWorkoutSummary(makeInstance({ currentIndex: 1 }), [
      session({ completedAt: LOCAL_NOON + 5_000, xp: 99, workoutProvenance: leg(0) }),
      session({ completedAt: LOCAL_NOON, xp: 7, workoutProvenance: leg(0) }),
    ]);

    expect(summary.outcomes[0].session?.xp).toBe(7);
  });

  it('ignores a session owned by another workout or leg', () => {
    const summary = buildWorkoutSummary(makeInstance({ currentIndex: 1 }), [
      session({ xp: 50, workoutProvenance: leg(0, 'a', '2026-08-21::focus-memory::standard') }),
      session({ xp: 60, workoutProvenance: leg(2) }),
    ]);

    expect(summary.outcomes[0].session).toBeNull();
    expect(summary.totalXp).toBe(0);
  });

  it('treats provenance naming a different game as standalone', () => {
    const summary = buildWorkoutSummary(makeInstance({ currentIndex: 1 }), [
      session({ completedAt: NEXT_DAY, xp: 50, workoutProvenance: leg(0, 'b') }),
    ]);

    // Standalone sessions only match inside the instance's date window.
    expect(summary.outcomes[0].session).toBeNull();
  });

  it('matches a provenance session even if a clock change put it before createdAt', () => {
    const instance = makeInstance({ currentIndex: 1 });
    const summary = buildWorkoutSummary(instance, [
      session({ completedAt: instance.createdAt - 1_000, xp: 7, workoutProvenance: leg(0) }),
    ]);

    expect(summary.outcomes[0].session?.xp).toBe(7);
  });
});

describe('buildWorkoutSummary sessions without provenance', () => {
  it('still matches the latest same-game session on the instance date', () => {
    const summary = buildWorkoutSummary(makeInstance({ currentIndex: 1 }), [
      session({ completedAt: LOCAL_NOON, xp: 4 }),
      session({ completedAt: LOCAL_NOON + 1_000, xp: 6 }),
    ]);

    expect(summary.outcomes[0].session?.xp).toBe(6);
  });

  it('includes the last instant of the local date and excludes the next day', () => {
    const lastInstant = new Date(2026, 7, 21, 23, 59, 59, 999).getTime();
    const nextMidnight = new Date(2026, 7, 22, 0, 0).getTime();
    const summary = buildWorkoutSummary(makeInstance({ currentIndex: 1 }), [
      session({ completedAt: lastInstant, xp: 4 }),
      session({ completedAt: nextMidnight, xp: 99 }),
    ]);

    expect(summary.outcomes[0].session?.xp).toBe(4);
  });

  it('applies the date bound to template instance keys', () => {
    const summary = buildWorkoutSummary(
      makeInstance({ date: `${KEY}::focus-memory::standard`, currentIndex: 1 }),
      [session({ completedAt: NEXT_DAY, xp: 99 })],
    );

    expect(summary.outcomes[0].session).toBeNull();
  });

  it('does not fabricate a bound from an unparseable instance date', () => {
    const summary = buildWorkoutSummary(
      makeInstance({ date: 'corrupt', currentIndex: 1 }),
      [session({ completedAt: NEXT_DAY, xp: 4 })],
    );

    expect(summary.outcomes[0].session?.xp).toBe(4);
  });
});
