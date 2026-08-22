/**
 * /results workout-CTA regression (campaign 011 closure).
 *
 * DEVICE-FOUND CRITICAL DEFECT THIS PINS: the `results-next-game` /
 * recent-session Pressables sat inside `<Link asChild>` with LITERAL ARRAY
 * styles. expo-router's Radix Slot shim throws
 * `[expo-router]: You are passing an array of styles to a child of <Slot>`
 * during render in dev builds — the /results route crashed on device the
 * moment it tried to render the next-game CTA, which is why the durable
 * Workout V2 journey could never complete in any campaign (009/010/011).
 *
 * The Slot shim's guard runs whenever NODE_ENV !== 'production', so this
 * render-level test fails loudly if anyone reintroduces an array style into
 * an asChild Link child on this route.
 *
 * Renders the REAL route tree via expo-router testing-library with `@/db`
 * mocked to a fake AppDatabase (same pattern as progress-detail.test.tsx).
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderRouter, screen } from "expo-router/testing-library";

import type { AppDatabase, GameSessionRecord, WorkoutInstance } from "@/db";
import { registerGameDefinitions } from "@/registry/registry";
import { registry as generatedRegistry } from "@/registry/registry.generated";

/** Test-only db state holder served by the mocked `@/db` module below. */
const mockDbState: { db: AppDatabase | null } = { db: null };

jest.mock("@/db", () => {
  const actual = jest.requireActual("@/db") as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => mockDbState.db,
    initDatabase: jest.fn(async () => undefined),
  };
});

const SESSION_ID = "ctx-fit-mt470wji-92ps0g";
const GAME_ID = "language-context-fit";
const COMPLETED_AT = 1_787_391_306_144;

function makeSession(): GameSessionRecord {
  return {
    id: SESSION_ID,
    gameId: GAME_ID,
    gameVersion: "1.0.0",
    seed: "seed",
    difficultyProfile: { level: "normal" },
    durationMs: 45_000,
    normalizedResult: 0.86,
    rawResult: {},
    xp: 50,
    startedAtMs: COMPLETED_AT - 60_000,
    completedAt: COMPLETED_AT,
    forced: false,
  } as unknown as GameSessionRecord;
}

function makeWorkout(
  overrides: Partial<WorkoutInstance> = {},
): WorkoutInstance {
  return {
    date: "2026-08-22",
    gameIds: [
      GAME_ID,
      "speed-color-match",
      "memory-running-order",
      "attention-odd-one-out",
    ],
    status: "active",
    currentIndex: 0,
    rerollAttempt: 0,
    seedVersion: 1,
    createdAt: COMPLETED_AT - 3_600_000,
    updatedAt: COMPLETED_AT - 120_000,
    ...overrides,
  };
}

function makeFakeDb(workout: WorkoutInstance | null): AppDatabase {
  const session = makeSession();
  return {
    sessions: {
      getById: async (id: string) => (id === SESSION_ID ? session : null),
      listRecent: async () => [session],
    },
    ratings: { getHistoryForSession: async () => [] },
    workouts: {
      findActiveInstanceForGame: async () => workout,
      // Mirror the real repository: advancing past the last game completes
      // the workout; otherwise currentIndex moves to the next position.
      advance: jest.fn(async () => {
        if (!workout) return null;
        const nextIndex = workout.currentIndex + 1;
        const finished = nextIndex >= workout.gameIds.length;
        return {
          ...workout,
          currentIndex: nextIndex,
          status: finished ? "completed" : workout.status,
        };
      }),
    },
    ledger: { getBalance: async () => 0 },
    xpAwards: { getTotalAwardedXp: async () => 0 },
  } as unknown as AppDatabase;
}

beforeEach(() => {
  // The real app registers the catalog in _layout.tsx before first render;
  // this minimal route map must do it explicitly or the advance hook's
  // reconcile step nulls the workout (empty eligible set) and the CTA
  // never mounts.
  registerGameDefinitions(generatedRegistry);
  mockDbState.db = null;
});

describe("/results workout CTA (Slot array-style crash regression)", () => {
  it("renders results-next-game when the session advances an active workout", async () => {
    mockDbState.db = makeFakeDb(makeWorkout());

    await act(async () => {
      renderRouter(
        {
          index: () => null,
          results: require("@/app/results").default,
        },
        { initialUrl: `/results?id=${SESSION_ID}` },
      );
    });

    // THE regression assertion: with the array style present, expo-router's
    // Slot shim throws during render and this CTA never mounts (device:
    // full-screen Render Error instead of the results page).
    expect(
      await screen.findByTestId("results-next-game", {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId("results-score")).toBeOnTheScreen();
  });

  it("renders results-workout-complete when the finished session closes the workout", async () => {
    // The closing session's game must sit at the CURRENT resume position
    // (index 3) — the advance guard only fires for the active slot.
    const done = makeWorkout({
      currentIndex: 3,
      gameIds: [
        "speed-color-match",
        "memory-running-order",
        "attention-odd-one-out",
        GAME_ID,
      ],
    });
    mockDbState.db = makeFakeDb(done);

    await act(async () => {
      renderRouter(
        {
          index: () => null,
          results: require("@/app/results").default,
        },
        { initialUrl: `/results?id=${SESSION_ID}` },
      );
    });

    expect(
      await screen.findByTestId(
        "results-workout-complete",
        {},
        { timeout: 5000 },
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId("results-next-game")).toBeNull();
  });
});
