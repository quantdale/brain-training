/**
 * /results hero-anatomy regression (campaign 024).
 *
 * Pins the reference structure: score hero (ring + normalized numeral), then
 * headline, then a metric row of StatBlocks with metric identity values, then
 * rating movement, then ONE primary CTA (play again) with the workout
 * next-game action as a ghost. Also pins celebration discipline: a personal
 * best renders the celebration treatment exactly once per session (even
 * across remounts), while routine completions stay quiet.
 *
 * Renders the REAL route tree via expo-router testing-library with `@/db`
 * mocked to a fake AppDatabase (same pattern as results-workout-cta.test.tsx).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderRouter, screen } from "expo-router/testing-library";

import type { AppDatabase, GameSessionRecord, WorkoutInstance } from "@/db";
import ResultsScreen from "@/app/results";
import { registerGameDefinitions } from "@/registry/registry";
import { registry as generatedRegistry } from "@/registry/registry.generated";
import { liveAudioHaptics } from "@/sdk";
import { formatRelativeDay } from "@/components/shell/format";

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

const GAME_ID = "language-context-fit";
const COMPLETED_AT = 1_787_391_306_144;

function makeSession(id: string): GameSessionRecord {
  return {
    id,
    gameId: GAME_ID,
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 7,
    difficulty: { level: "hard" },
    rawResult: { score: 320, accuracy: 0.8 },
    normalizedResult: 0.86,
    xp: 50,
    startedAt: COMPLETED_AT - 60_000,
    completedAt: COMPLETED_AT,
    durationMs: 45_000,
    forced: false,
  } as unknown as GameSessionRecord;
}

/**
 * Fake db. `earlierAtOrAbove` stands in for the COUNT pushdown behind
 * personal-best detection: 1 means only the session itself matches (a best),
 * more means an earlier session beat or tied it (routine).
 */
function makeFakeDb(
  session: GameSessionRecord,
  options: {
    earlierAtOrAbove?: number;
    workout?: WorkoutInstance | null;
    onCountSessions?: (query: Record<string, unknown>) => void;
  } = {},
): AppDatabase {
  const { earlierAtOrAbove = 1, workout = null, onCountSessions } = options;
  return {
    sessions: {
      getById: async (id: string) => (id === session.id ? session : null),
      listRecent: async () => [session],
      countSessions: async (query: Record<string, unknown>) => {
        onCountSessions?.(query);
        return earlierAtOrAbove;
      },
    },
    ratings: { getHistoryForSession: async () => [] },
    workouts: {
      findActiveInstanceForSession: async () => workout,
      advanceForSession: jest.fn(async () => ({
        advanced: false,
        instance: workout,
      })),
      // Repair hook for active workouts after an advance (called only when
      // the advance returns an instance, so null-workout cases never reach
      // it).
      reconcile: jest.fn(async () => workout),
    },
    ledger: { getBalance: async () => 0 },
    xpAwards: { getTotalAwardedXp: async () => 0 },
  } as unknown as AppDatabase;
}

beforeEach(() => {
  // Same registration requirement as results-workout-cta.test.tsx: the real
  // app registers the catalog in _layout.tsx before first render.
  registerGameDefinitions(generatedRegistry);
  mockDbState.db = null;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("/results hero anatomy (campaign 024)", () => {
  it("renders hero, headline, metric row, single primary CTA", async () => {
    const session = makeSession("hero-anatomy");
    mockDbState.db = makeFakeDb(session);

    await act(async () => {
      renderRouter(
        { index: () => null, results: ResultsScreen },
        { initialUrl: `/results?id=${session.id}` },
      );
    });

    // Score hero: ring with the normalized score as the hero numeral.
    expect(
      await screen.findByTestId("results-ring", {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId("results-score")).toHaveTextContent("86%");
    // Headline, then game identity.
    expect(screen.getByTestId("results-band")).toBeOnTheScreen();
    expect(screen.getByTestId("results-game")).toBeOnTheScreen();
    // Metric row with identity values (StatBlock exposes the value node as
    // `<testID>-value`; the bare testID covers label + value together).
    expect(screen.getByTestId("results-metric-score-value")).toHaveTextContent("320");
    expect(screen.getByTestId("results-metric-accuracy-value")).toHaveTextContent("80%");
    expect(screen.getByTestId("results-metric-time-value")).toHaveTextContent("45s");
    // Player-facing label ("Hard"), not the stored slug (Campaign 026 visual-QA).
    expect(screen.getByTestId("results-metric-difficulty-value")).toHaveTextContent("Hard");
    expect(screen.getByTestId("results-xp")).toHaveTextContent("+50 XP");
    // The session date stands apart from the XP reward (Campaign 026
    // visual-QA: the glued row read as "+50 XP Yesterday").
    expect(screen.getByTestId("results-timestamp")).toHaveTextContent(
      `Played ${formatRelativeDay(COMPLETED_AT, Date.now())}`,
    );
    // Rating movement section still present (empty copy, no history).
    expect(screen.getByTestId("results-rating")).toBeOnTheScreen();
    // ONE primary CTA; no workout means no ghost next-game action.
    expect(screen.getByTestId("results-play-again")).toBeOnTheScreen();
    expect(screen.queryByTestId("results-next-game")).toBeNull();
    // Recent sessions list under its harness testID.
    expect(screen.getByTestId("results-recent-sessions")).toBeOnTheScreen();
    expect(
      screen.getByTestId(`results-session-${session.id}`),
    ).toBeOnTheScreen();
  });

  it("celebrates a personal best exactly once, across remounts", async () => {
    const session = makeSession("hero-pb-once");
    mockDbState.db = makeFakeDb(session, { earlierAtOrAbove: 1 });
    const feedback = jest.spyOn(liveAudioHaptics, "feedback");

    const first = await act(async () =>
      renderRouter(
        { index: () => null, results: ResultsScreen },
        { initialUrl: `/results?id=${session.id}` },
      ),
    );
    expect(
      await screen.findByTestId("results-personal-best", {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    await act(async () => {});
    expect(feedback).toHaveBeenCalledTimes(1);
    expect(feedback).toHaveBeenCalledWith("success");

    // A remount (same JS session, e.g. navigating back to this result) must
    // not replay the celebration for the same session id.
    await act(async () => {
      first.unmount();
    });
    await act(async () => {
      renderRouter(
        { index: () => null, results: ResultsScreen },
        { initialUrl: `/results?id=${session.id}` },
      );
    });
    await screen.findByTestId("results-personal-best", {}, { timeout: 5000 });
    await act(async () => {});
    expect(feedback).toHaveBeenCalledTimes(1);
  });

  it("stays quiet for routine completions", async () => {
    const session = makeSession("hero-quiet");
    // Three earlier sessions already reach this score: not a best.
    mockDbState.db = makeFakeDb(session, { earlierAtOrAbove: 4 });
    const feedback = jest.spyOn(liveAudioHaptics, "feedback");

    await act(async () => {
      renderRouter(
        { index: () => null, results: ResultsScreen },
        { initialUrl: `/results?id=${session.id}` },
      );
    });

    await screen.findByTestId("results-score", {}, { timeout: 5000 });
    await act(async () => {});
    expect(screen.queryByTestId("results-personal-best")).toBeNull();
    expect(feedback).not.toHaveBeenCalled();
  });

  it("057: clamps the personal-best comparison to now for future-dated sessions", async () => {
    // Clock skew: the session claims a completion a day in the future. The
    // PB pushdown must compare within the displayed time universe, and an
    // earlier stronger session must still win (no skewed best).
    const testStart = Date.now();
    const futureAt = testStart + 24 * 3_600_000;
    const session = {
      ...makeSession("hero-future-skew"),
      startedAt: futureAt - 60_000,
      completedAt: futureAt,
      normalizedResult: 0.7, // mid-band: passes the honesty gate on its own
    };
    let seenToMs: unknown = null;
    // Two sessions reach 0.7 (self + a genuinely earlier best): not a best.
    mockDbState.db = makeFakeDb(session, {
      earlierAtOrAbove: 2,
      onCountSessions: (query) => {
        seenToMs = query.toMs;
      },
    });

    await act(async () => {
      renderRouter(
        { index: () => null, results: ResultsScreen },
        { initialUrl: `/results?id=${session.id}` },
      );
    });

    await screen.findByTestId("results-score", {}, { timeout: 5000 });
    await act(async () => {});
    // Bound is exactly min(completedAt, now): inside the test window, never
    // the future timestamp.
    expect(typeof seenToMs).toBe("number");
    expect(seenToMs as number).toBeGreaterThanOrEqual(testStart);
    expect(seenToMs as number).toBeLessThanOrEqual(Date.now());
    expect(seenToMs as number).toBeLessThan(futureAt);
    // Outcome: the earlier best wins, so no PB badge despite mid-band play.
    expect(screen.queryByTestId("results-personal-best")).toBeNull();
  });

  it("demotes the workout next game to a ghost beside the primary CTA", async () => {
    const session = makeSession("hero-next-game");
    const workout: WorkoutInstance = {
      date: "2026-08-22",
      gameIds: [GAME_ID, "speed-color-match"],
      status: "active",
      currentIndex: 0,
      rerollAttempt: 0,
      seedVersion: 1,
      createdAt: COMPLETED_AT - 3_600_000,
      updatedAt: COMPLETED_AT - 120_000,
    };
    const withProvenance = {
      ...session,
      workoutProvenance: {
        instanceKey: workout.date,
        legIndex: 0,
        gameId: GAME_ID,
      },
    } as unknown as GameSessionRecord;
    mockDbState.db = makeFakeDb(withProvenance, { workout });

    await act(async () => {
      renderRouter(
        { index: () => null, results: ResultsScreen },
        { initialUrl: `/results?id=${withProvenance.id}` },
      );
    });

    expect(
      await screen.findByTestId("results-next-game", {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    // The primary CTA is still play-again: exactly one primary per viewport.
    expect(screen.getByTestId("results-play-again")).toBeOnTheScreen();
  });
});
