import { describe, expect, it } from "@jest/globals";

import {
  attachWorkoutProvenance,
  clearWorkoutSessionLaunch,
  extractWorkoutProvenance,
  isWorkoutSessionProvenance,
  parseWorkoutLaunchProvenance,
  peekWorkoutSessionLaunch,
  registerWorkoutSessionLaunch,
} from "@/workout/session-provenance";
import { gameHref } from "@/workout/routing";

const PROVENANCE = {
  instanceKey: "2026-08-28::focus-memory::short",
  legIndex: 2,
  gameId: "memory-grid-recall",
} as const;

describe("workout session provenance", () => {
  it("accepts only a complete non-negative integer tuple", () => {
    expect(isWorkoutSessionProvenance(PROVENANCE)).toBe(true);
    expect(isWorkoutSessionProvenance({ ...PROVENANCE, legIndex: 1.5 })).toBe(false);
    expect(isWorkoutSessionProvenance({ ...PROVENANCE, legIndex: Number.MAX_SAFE_INTEGER + 1 })).toBe(false);
    expect(isWorkoutSessionProvenance({ ...PROVENANCE, legIndex: -1 })).toBe(false);
    expect(isWorkoutSessionProvenance({ ...PROVENANCE, gameId: "" })).toBe(false);
    expect(isWorkoutSessionProvenance({ ...PROVENANCE, gameId: "  " })).toBe(false);
    expect(isWorkoutSessionProvenance(null)).toBe(false);
  });

  it("056: rejects leg indices no real workout can own and oversized strings", () => {
    // Longest workout is 6 games (extended) → max leg index 5.
    expect(isWorkoutSessionProvenance({ ...PROVENANCE, legIndex: 5 })).toBe(true);
    expect(isWorkoutSessionProvenance({ ...PROVENANCE, legIndex: 6 })).toBe(false);
    expect(isWorkoutSessionProvenance({ ...PROVENANCE, legIndex: 31 })).toBe(false);
    expect(
      isWorkoutSessionProvenance({ ...PROVENANCE, gameId: "a".repeat(129) }),
    ).toBe(false);
    expect(
      isWorkoutSessionProvenance({
        ...PROVENANCE,
        instanceKey: "a".repeat(129),
      }),
    ).toBe(false);
    // Same bound through the route parser: unownable legs degrade to
    // standalone instead of claiming a workout leg.
    expect(
      parseWorkoutLaunchProvenance({
        gameId: PROVENANCE.gameId,
        instanceKey: PROVENANCE.instanceKey,
        legIndex: "6",
      }),
    ).toBeNull();
    expect(
      parseWorkoutLaunchProvenance({
        gameId: PROVENANCE.gameId,
        instanceKey: PROVENANCE.instanceKey,
        legIndex: "5",
      }),
    ).toEqual({ ...PROVENANCE, legIndex: 5 });
  });

  it("056: re-registration after a map loss restores launch ownership (restart recovery)", () => {
    // A process restart drops the in-memory map; beginning the session again
    // from the same route params must re-establish ownership so the
    // completion still decorates and advances. This test goes through the
    // real route parser, not a recycled object, to pin the actual path.
    const fromRoute = parseWorkoutLaunchProvenance({
      gameId: PROVENANCE.gameId,
      instanceKey: PROVENANCE.instanceKey,
      legIndex: String(PROVENANCE.legIndex),
    });
    expect(fromRoute).toEqual(PROVENANCE);
    registerWorkoutSessionLaunch("restart-session", fromRoute!);
    expect(peekWorkoutSessionLaunch("restart-session")).toEqual(PROVENANCE);
    // Simulate the restart: drop the entry without completing.
    clearWorkoutSessionLaunch("restart-session");
    expect(peekWorkoutSessionLaunch("restart-session")).toBeUndefined();
    // Re-begin from route params re-registers the identical tuple.
    const relaunched = parseWorkoutLaunchProvenance({
      gameId: PROVENANCE.gameId,
      instanceKey: PROVENANCE.instanceKey,
      legIndex: String(PROVENANCE.legIndex),
    });
    registerWorkoutSessionLaunch("restart-session", relaunched!);
    expect(peekWorkoutSessionLaunch("restart-session")).toEqual(PROVENANCE);
    clearWorkoutSessionLaunch("restart-session");
  });

  it("parses valid route values and degrades malformed routes to standalone", () => {
    expect(
      parseWorkoutLaunchProvenance({
        gameId: [PROVENANCE.gameId],
        instanceKey: [PROVENANCE.instanceKey],
        legIndex: String(PROVENANCE.legIndex),
      }),
    ).toEqual(PROVENANCE);
    expect(
      parseWorkoutLaunchProvenance({
        gameId: PROVENANCE.gameId,
        instanceKey: PROVENANCE.instanceKey,
        legIndex: "not-an-index",
      }),
    ).toBeNull();
    expect(
      parseWorkoutLaunchProvenance({
        gameId: PROVENANCE.gameId,
        instanceKey: PROVENANCE.instanceKey,
      }),
    ).toBeNull();
  });

  it("round-trips object and primitive raw results without losing ownership", () => {
    const objectResult = attachWorkoutProvenance({ score: 4 }, PROVENANCE);
    expect(objectResult).toMatchObject({ score: 4 });
    expect(extractWorkoutProvenance(objectResult)).toEqual(PROVENANCE);

    const primitiveResult = attachWorkoutProvenance(null, PROVENANCE);
    expect(primitiveResult).toMatchObject({ value: null });
    expect(extractWorkoutProvenance(primitiveResult)).toEqual(PROVENANCE);
  });

  it("keeps launch ownership available for retry and clears it only explicitly", () => {
    registerWorkoutSessionLaunch("session-provenance-test", PROVENANCE);
    expect(peekWorkoutSessionLaunch("session-provenance-test")).toEqual(PROVENANCE);
    clearWorkoutSessionLaunch("session-provenance-test");
    expect(peekWorkoutSessionLaunch("session-provenance-test")).toBeUndefined();
  });

  it("encodes the instance key and leg in workout game links", () => {
    expect(gameHref(PROVENANCE.gameId, PROVENANCE)).toBe(
      "/game/memory-grid-recall?workoutKey=2026-08-28%3A%3Afocus-memory%3A%3Ashort&workoutIndex=2",
    );
    expect(gameHref("other-game", PROVENANCE)).toBe("/game/other-game");
  });
});
