/**
 * `shouldAdvanceWorkout` / `nextWorkoutGameId` — the cross-feature advance guard
 * that closes the 006R hardening gap (result screen advancing the durable
 * workout). These are pure so the gate conditions are exhaustively covered
 * without a database or renderer.
 */
import { beforeEach, describe, expect, it } from '@jest/globals';

import type { SQLiteAdapter } from '@/db/adapter';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { WorkoutRepository } from '@/db/workout';
import type { WorkoutInstance } from '@/db';
import { nextWorkoutGameId, shouldAdvanceWorkout } from '@/workout/advance';

const GAMES = ['memory', 'speed-tap-rush', 'logic-next-sequence', 'math-fast-math'];

function makeInstance(overrides: Partial<WorkoutInstance> = {}): WorkoutInstance {
  return {
    date: '2026-08-20',
    gameIds: GAMES,
    status: 'active',
    currentIndex: 0,
    rerollAttempt: 0,
    seedVersion: 1,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

/** A session that finished the current (index 0) game after the instance existed. */
const currentSession = { gameId: 'memory', completedAt: 3000 };

describe('shouldAdvanceWorkout', () => {
  it('advances when the completed game is the current active position and finished after creation', () => {
    expect(shouldAdvanceWorkout(currentSession, makeInstance())).toBe(true);
  });

  it('does not advance when there is no instance', () => {
    expect(shouldAdvanceWorkout(currentSession, null)).toBe(false);
  });

  it('does not advance when the workout is already completed', () => {
    expect(shouldAdvanceWorkout(currentSession, makeInstance({ status: 'completed' }))).toBe(false);
  });

  it('does not advance when the completed game is not the current position', () => {
    // The instance is at index 0 (memory), but the finished game is a different one.
    expect(shouldAdvanceWorkout({ gameId: 'speed-tap-rush', completedAt: 3000 }, makeInstance())).toBe(false);
  });

  it('does not advance a historical session whose game coincides with the current game', () => {
    // Yesterday's memory session finished (completedAt 500) before today's
    // instance was created (updatedAt 1000) — idempotency gate must block it.
    expect(shouldAdvanceWorkout({ gameId: 'memory', completedAt: 500 }, makeInstance())).toBe(false);
  });

  it('does not re-advance after the instance was already advanced past this game', () => {
    // Instance already advanced to index 1 (updatedAt bumped to 9000); the
    // session at index 0 finished at 3000 — must not advance again.
    const advanced = makeInstance({ currentIndex: 1, updatedAt: 9000 });
    expect(shouldAdvanceWorkout(currentSession, advanced)).toBe(false);
  });

  it('advances exactly the game at the current index after a prior advance', () => {
    const atNext = makeInstance({ currentIndex: 1, updatedAt: 9000 });
    expect(shouldAdvanceWorkout({ gameId: 'speed-tap-rush', completedAt: 9500 }, atNext)).toBe(true);
  });
});

describe('nextWorkoutGameId', () => {
  it('returns the current resume game id', () => {
    expect(nextWorkoutGameId(makeInstance({ currentIndex: 1 }))).toBe('speed-tap-rush');
  });

  it('returns null once the workout is exhausted (index == length)', () => {
    expect(nextWorkoutGameId(makeInstance({ currentIndex: GAMES.length, status: 'completed' }))).toBeNull();
  });

  it('returns null for a missing instance', () => {
    expect(nextWorkoutGameId(null)).toBeNull();
  });
});

describe('workout advance wiring (helper composed with the real repository)', () => {
  let adapter: SQLiteAdapter;
  let workouts: WorkoutRepository;
  const today = '2026-08-20';

  beforeEach(async () => {
    adapter = await createMigratedDb();
    workouts = new WorkoutRepository(adapter, () => 1000);
  });

  it('completing the current game advances the durable instance and yields the next id', async () => {
    const created = await workouts.getOrCreate(today, { gameIds: GAMES, seedVersion: 1 });
    const session = { gameId: GAMES[0], completedAt: 3000 };

    // The result screen calls exactly this before advancing.
    expect(shouldAdvanceWorkout(session, created)).toBe(true);

    const updated = await workouts.advance(today);
    expect(updated.currentIndex).toBe(1);
    expect(updated.status).toBe('active');
    expect(nextWorkoutGameId(updated)).toBe(GAMES[1]);

    // Idempotency: re-viewing the same completed session must not advance again.
    expect(shouldAdvanceWorkout(session, updated)).toBe(false);
  });

  it('does not advance when the workout is already completed', async () => {
    await workouts.getOrCreate(today, { gameIds: GAMES, seedVersion: 1 });
    await workouts.advance(today);
    await workouts.advance(today);
    await workouts.advance(today);
    const completed = await workouts.advance(today);
    expect(completed.status).toBe('completed');

    expect(shouldAdvanceWorkout({ gameId: GAMES[0], completedAt: 3000 }, completed)).toBe(false);
  });
});
