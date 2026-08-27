/**
 * Workout ownership and one-shot advance matrix (campaign 015 task 8A).
 *
 * The old timestamp/recent-instance heuristic is deliberately absent from
 * these tests. Ownership is an exact persisted `(instanceKey, legIndex,
 * gameId)` tuple, and the repository repeats the check at the write boundary.
 */
import { beforeEach, describe, expect, it } from "@jest/globals";

import type { SQLiteAdapter } from "@/db/adapter";
import { createMigratedDb } from "@/db/__tests__/helpers";
import { SessionRepository } from "@/db/sessions";
import { WorkoutRepository } from "@/db/workout";
import type { WorkoutInstance } from "@/db";
import { nextWorkoutGameId, shouldAdvanceWorkout } from "@/workout/advance";
import {
  registerWorkoutSessionLaunch,
  type WorkoutSessionProvenance,
} from "@/workout/session-provenance";

const GAMES = ["memory", "speed-tap-rush", "logic-next-sequence", "math-fast-math"];

function makeInstance(overrides: Partial<WorkoutInstance> = {}): WorkoutInstance {
  return {
    date: "2026-08-20",
    gameIds: GAMES,
    status: "active",
    currentIndex: 0,
    rerollAttempt: 0,
    seedVersion: 1,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function ownership(
  instance: WorkoutInstance,
  legIndex = instance.currentIndex,
): WorkoutSessionProvenance {
  return {
    instanceKey: instance.date,
    legIndex,
    gameId: instance.gameIds[legIndex],
  };
}

describe("shouldAdvanceWorkout", () => {
  it("accepts an exact current-leg ownership tuple", () => {
    const instance = makeInstance();
    expect(
      shouldAdvanceWorkout(
        { gameId: "memory", workoutProvenance: ownership(instance) },
        instance,
      ),
    ).toBe(true);
  });

  it("rejects legacy/standalone sessions even when the game id matches", () => {
    expect(shouldAdvanceWorkout({ gameId: "memory" }, makeInstance())).toBe(false);
  });

  it("rejects historical/equal-timestamp sessions inside the former grace window without provenance", () => {
    const instance = makeInstance({ createdAt: 20_000, updatedAt: 20_000 });
    const ambiguous = { gameId: "memory", completedAt: 20_000 };
    expect(shouldAdvanceWorkout(ambiguous, instance)).toBe(false);
  });

  it("does not use timestamps, so clock skew cannot change exact ownership", () => {
    const instance = makeInstance({ createdAt: 10_000, updatedAt: 10_000 });
    expect(
      shouldAdvanceWorkout(
        { gameId: "memory", workoutProvenance: ownership(instance) },
        instance,
      ),
    ).toBe(true);
  });

  it("rejects a missing instance or completed instance", () => {
    const instance = makeInstance();
    const signal = { gameId: "memory", workoutProvenance: ownership(instance) };
    expect(shouldAdvanceWorkout(signal, null)).toBe(false);
    expect(shouldAdvanceWorkout(signal, makeInstance({ status: "completed" }))).toBe(false);
  });

  it("rejects wrong game, instance key and leg", () => {
    const instance = makeInstance();
    expect(
      shouldAdvanceWorkout(
        {
          gameId: "speed-tap-rush",
          workoutProvenance: {
            instanceKey: instance.date,
            legIndex: 0,
            gameId: "speed-tap-rush",
          },
        },
        instance,
      ),
    ).toBe(false);
    expect(
      shouldAdvanceWorkout(
        {
          gameId: "memory",
          workoutProvenance: {
            instanceKey: "other-instance",
            legIndex: 0,
            gameId: "memory",
          },
        },
        instance,
      ),
    ).toBe(false);
    expect(
      shouldAdvanceWorkout(
        {
          gameId: "speed-tap-rush",
          workoutProvenance: {
            instanceKey: instance.date,
            legIndex: 1,
            gameId: "speed-tap-rush",
          },
        },
        instance,
      ),
    ).toBe(false);
  });

  it("rejects a tuple after the instance has moved past that leg", () => {
    const original = makeInstance();
    const advanced = makeInstance({ currentIndex: 1, updatedAt: 9000 });
    expect(
      shouldAdvanceWorkout(
        { gameId: "memory", workoutProvenance: ownership(original) },
        advanced,
      ),
    ).toBe(false);
  });

  it("distinguishes repeated game ids by leg index", () => {
    const instance = makeInstance({ gameIds: ["memory", "memory"], currentIndex: 1 });
    expect(
      shouldAdvanceWorkout(
        { gameId: "memory", workoutProvenance: ownership(instance) },
        instance,
      ),
    ).toBe(true);
    expect(
      shouldAdvanceWorkout(
        {
          gameId: "memory",
          workoutProvenance: ownership(instance, 0),
        },
        instance,
      ),
    ).toBe(false);
  });
});
describe("nextWorkoutGameId", () => {
  it("returns the current resume game id", () => {
    expect(nextWorkoutGameId(makeInstance({ currentIndex: 1 }))).toBe("speed-tap-rush");
  });

  it("returns null once the workout is exhausted", () => {
    expect(nextWorkoutGameId(makeInstance({ currentIndex: GAMES.length, status: "completed" }))).toBeNull();
  });

  it("returns null for a missing instance", () => {
    expect(nextWorkoutGameId(null)).toBeNull();
  });
});

describe("durable ownership-checked advance", () => {
  let adapter: SQLiteAdapter;
  let workouts: WorkoutRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    workouts = new WorkoutRepository(adapter, () => 1000);
  });

  it("persists the exact leg transition and refuses a duplicate after relaunch", async () => {
    const created = await workouts.getOrCreate("2026-08-20", {
      gameIds: GAMES,
      seedVersion: 1,
    });
    const session = {
      gameId: GAMES[0],
      workoutProvenance: ownership(created),
    };

    expect(await workouts.findActiveInstanceForSession(session)).not.toBeNull();
    const first = await workouts.advanceForSession(session);
    expect(first.advanced).toBe(true);
    expect(first.instance?.currentIndex).toBe(1);
    expect(nextWorkoutGameId(first.instance)).toBe(GAMES[1]);

    // A new repository represents process relaunch; durable state, not an
    // in-memory ref, rejects the same session from advancing a second time.
    const relaunched = new WorkoutRepository(adapter, () => 2000);
    const replay = await relaunched.advanceForSession(session);
    expect(replay.advanced).toBe(false);
    expect(replay.instance?.currentIndex).toBe(1);
    expect((await relaunched.getByDate(created.date))?.currentIndex).toBe(1);
  });

  it("reopens persisted session ownership before advancing after process death", async () => {
    const created = await workouts.getOrCreate("2026-08-20", {
      gameIds: GAMES,
      seedVersion: 1,
    });
    const provenance = ownership(created);
    registerWorkoutSessionLaunch("relaunch-session", provenance);

    const sessions = new SessionRepository(adapter, () => 1_000);
    await sessions.completeSession({
      session: {
        id: "relaunch-session",
        gameId: GAMES[0],
        gameVersion: 1,
        generatorVersion: 1,
        scoringVersion: 1,
        seed: 42,
        difficulty: "normal",
        rawResult: { score: 1 },
        normalizedResult: 1,
        xp: 1,
        startedAt: 900,
        completedAt: 1_000,
        durationMs: 100,
      },
    });

    // A new results process must reconstruct ownership from durable session
    // JSON; no route/local launch map is needed after completion commits.
    const reopenedSession = await new SessionRepository(adapter).getById(
      "relaunch-session",
    );
    expect(reopenedSession?.workoutProvenance).toEqual(provenance);

    const relaunchedWorkouts = new WorkoutRepository(adapter, () => 2_000);
    const first = await relaunchedWorkouts.advanceForSession(reopenedSession!);
    const replay = await relaunchedWorkouts.advanceForSession(reopenedSession!);
    expect(first.advanced).toBe(true);
    expect(replay.advanced).toBe(false);
    expect((await relaunchedWorkouts.getByDate(created.date))?.currentIndex).toBe(1);
  });

  it("rejects missing provenance before opening a write transaction", async () => {
    await workouts.getOrCreate("2026-08-20", { gameIds: GAMES });
    const result = await workouts.advanceForSession({ gameId: GAMES[0] });
    expect(result).toEqual({ advanced: false, instance: null });
    expect((await workouts.getByDate("2026-08-20"))?.currentIndex).toBe(0);
  });

  it("routes two active instances independently even when they share a game", async () => {
    const daily = await workouts.getOrCreate("2026-08-20", {
      gameIds: ["memory", "daily-next"],
    });
    const focus = await workouts.getOrCreate("2026-08-20::focus-memory::short", {
      gameIds: ["memory", "focus-next"],
    });
    const dailyResult = await workouts.advanceForSession({
      gameId: "memory",
      workoutProvenance: ownership(daily),
    });
    const focusResult = await workouts.advanceForSession({
      gameId: "memory",
      workoutProvenance: ownership(focus),
    });
    expect(dailyResult.advanced).toBe(true);
    expect(focusResult.advanced).toBe(true);
    expect(dailyResult.instance?.date).toBe(daily.date);
    expect(focusResult.instance?.date).toBe(focus.date);
  });
});
