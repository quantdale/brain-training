/**
 * Shared durable workout advance (frontier audit `in-game-workout-next-leg`).
 *
 * Both the in-game results chrome and `/results` call `advanceWorkoutForSession`
 * so a workout-launched session advances exactly once: the repository's
 * conditional transaction rejects duplicates/relaunches, and a non-owning call
 * resolves the current leg without writing.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AppDatabase } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { registerGameDefinitions } from '@/registry/registry';
import type { GameDefinition } from '@/sdk';
import { gameHref } from '@/workout/routing';
import { advanceWorkoutForSession } from '@/workout/session-advance';
import type { WorkoutSessionProvenance } from '@/workout/session-provenance';

const T0 = 1_700_000_000_000;
const KEY = '2026-09-14';
const GAMES = ['memory', 'speed-tap-rush', 'logic-next-sequence', 'math-fast-math'];

/** Test-controlled db served by the mocked `@/db` module below. */
const mockDbState: { db: AppDatabase | null } = { db: null };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return { ...actual, getDb: () => mockDbState.db };
});

function definition(id: string): GameDefinition {
  return {
    id,
    name: id,
    primaryCategory: 'Memory',
    description: 'probe',
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    contentVersion: null,
    hasTutorial: true,
  };
}

function ownership(legIndex: number): WorkoutSessionProvenance {
  return { instanceKey: KEY, legIndex, gameId: GAMES[legIndex] };
}

async function makeDb(): Promise<AppDatabase> {
  const adapter = await createMigratedDb();
  return new AppDatabase(adapter, { now: () => T0 });
}

beforeEach(() => {
  // Reconcile drops game ids missing from the registered catalog; register the
  // fixture games so the tested instances stay eligible.
  registerGameDefinitions(GAMES.map(definition));
  mockDbState.db = null;
});

describe('advanceWorkoutForSession', () => {
  it('advances the owned leg once and resolves the next leg for an already-advanced relaunch', async () => {
    const db = await makeDb();
    mockDbState.db = db;
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });

    const signal = { gameId: GAMES[0], workoutProvenance: ownership(0) };
    const first = await advanceWorkoutForSession(signal);

    expect(first.advanced).toBe(true);
    expect(first.completed).toBe(false);
    expect(first.nextGameId).toBe(GAMES[1]);
    expect(first.nextProvenance).toEqual(ownership(1));
    expect((await db.workouts.getByDate(KEY))?.currentIndex).toBe(1);

    // A later `/results` view of the SAME session must not advance again, but
    // still points the surface at the true current leg.
    const replay = await advanceWorkoutForSession(signal);
    expect(replay.advanced).toBe(false);
    expect(replay.nextGameId).toBe(GAMES[1]);
    expect((await db.workouts.getByDate(KEY))?.currentIndex).toBe(1);
  });

  it('completes the workout on the last leg and offers no next game', async () => {
    const db = await makeDb();
    mockDbState.db = db;
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });
    // Move the durable index to the last leg (previous legs already played).
    await db.workouts.advanceForSession({ gameId: GAMES[0], workoutProvenance: ownership(0) });
    await db.workouts.advanceForSession({ gameId: GAMES[1], workoutProvenance: ownership(1) });
    await db.workouts.advanceForSession({ gameId: GAMES[2], workoutProvenance: ownership(2) });

    const result = await advanceWorkoutForSession({
      gameId: GAMES[3],
      workoutProvenance: ownership(3),
    });

    expect(result.advanced).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.nextGameId).toBeNull();
    expect(result.nextProvenance).toBeNull();
    expect((await db.workouts.getByDate(KEY))?.status).toBe('completed');
  });

  it('never advances a standalone (provenance-less) session', async () => {
    const db = await makeDb();
    mockDbState.db = db;
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });

    const result = await advanceWorkoutForSession({ gameId: GAMES[0] });

    expect(result.advanced).toBe(false);
    expect(result.nextGameId).toBeNull();
    expect(result.completed).toBe(false);
    expect((await db.workouts.getByDate(KEY))?.currentIndex).toBe(0);
  });

  it('points Home Continue at the next leg after an in-game persist+advance', async () => {
    const db = await makeDb();
    mockDbState.db = db;
    await db.workouts.getOrCreate(KEY, { gameIds: GAMES, seedVersion: 1 });

    const result = await advanceWorkoutForSession({
      gameId: GAMES[0],
      workoutProvenance: ownership(0),
    });

    // Home's `useWorkout` reads the durable row on focus: the resume position
    // is the new current leg, never the game just finished.
    const persisted = await db.workouts.getByDate(KEY);
    expect(persisted?.gameIds[persisted.currentIndex]).toBe(GAMES[1]);

    // The Next Game launch carries the next leg's exact ownership tuple.
    expect(String(gameHref(result.nextGameId!, result.nextProvenance))).toBe(
      `/game/${GAMES[1]}?workoutKey=${encodeURIComponent(KEY)}&workoutIndex=1`,
    );
  });

  it('056: non-owning navigation persists the drift repair (no display/durable skew)', async () => {
    const db = await makeDb();
    mockDbState.db = db;
    // Drifted row: a retired ghost sits in the future legs.
    await db.workouts.getOrCreate(KEY, {
      gameIds: [GAMES[0]!, 'ghost-retired-game', GAMES[2]!, GAMES[3]!],
      seedVersion: 1,
    });

    // A stale (non-owning) signal: leg 1 claimed, but the resume point is 0.
    const result = await advanceWorkoutForSession({
      gameId: GAMES[0],
      workoutProvenance: { instanceKey: KEY, legIndex: 1, gameId: GAMES[0]! },
    });

    expect(result.advanced).toBe(false);
    expect(result.completed).toBe(false);
    // Navigation and the durable row converge on the repaired list: the
    // ghost's slot is substituted, length preserved, resume still at leg 0.
    const persisted = await db.workouts.getByDate(KEY);
    expect(persisted?.gameIds).toHaveLength(4);
    expect(persisted?.gameIds).not.toContain('ghost-retired-game');
    expect(persisted?.gameIds[0]).toBe(GAMES[0]);
    expect(persisted?.currentIndex).toBe(0);
    expect(result.nextGameId).toBe(persisted?.gameIds[0] ?? null);
    expect(result.nextProvenance).toEqual({
      instanceKey: KEY,
      legIndex: 0,
      gameId: persisted?.gameIds[0],
    });
  });

  it('resolves completion without writing when the workout is already completed', async () => {
    const db = await makeDb();
    mockDbState.db = db;
    await db.workouts.getOrCreate(KEY, {
      gameIds: GAMES,
      seedVersion: 1,
    });

    const result = await advanceWorkoutForSession({
      gameId: GAMES[0],
      workoutProvenance: ownership(0),
    });
    expect(result.advanced).toBe(true);

    // Simulate the completed state through the repository's own transitions.
    await db.workouts.advanceForSession({ gameId: GAMES[1], workoutProvenance: ownership(1) });
    await db.workouts.advanceForSession({ gameId: GAMES[2], workoutProvenance: ownership(2) });
    await db.workouts.advanceForSession({ gameId: GAMES[3], workoutProvenance: ownership(3) });

    const afterCompletion = await advanceWorkoutForSession({
      gameId: GAMES[3],
      workoutProvenance: ownership(3),
    });
    expect(afterCompletion.advanced).toBe(false);
    expect(afterCompletion.completed).toBe(true);
    expect(afterCompletion.nextGameId).toBeNull();
  });
});
