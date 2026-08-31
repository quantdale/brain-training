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
