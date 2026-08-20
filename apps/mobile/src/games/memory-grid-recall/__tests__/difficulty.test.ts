// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import type { DifficultyLevel } from "@/sdk";

import {
  ADAPTIVE_PARAMS,
  GRID_RECALL_DIFFICULTY_PARAMS,
  gridRecallParamsForLevel,
  gridRecallParamsFromProfile,
  nextTargetCount,
  resolveGridRecallDifficulty,
  sessionChallengeRating,
} from "../difficulty";

describe("gridRecallParamsForLevel / resolve", () => {
  it("returns frozen defaults for fixed levels", () => {
    expect(gridRecallParamsForLevel("easy")).toEqual(
      GRID_RECALL_DIFFICULTY_PARAMS.easy,
    );
    expect(resolveGridRecallDifficulty("normal").level).toBe("normal");
    expect(resolveGridRecallDifficulty("normal").challengeRating).toBe(0.5);
    expect(resolveGridRecallDifficulty("expert").challengeRating).toBe(0.95);
  });
  it("adaptive uses the neutral baseline", () => {
    const profile = resolveGridRecallDifficulty("adaptive");
    expect(profile.level).toBe("adaptive");
    expect(profile.challengeRating).toBe(0.5);
    expect(profile.parameters.gridSize).toBe(ADAPTIVE_PARAMS.gridSize);
  });
});

describe("gridRecallParamsFromProfile", () => {
  it("recovers params and throws on missing numeric fields", () => {
    const profile = resolveGridRecallDifficulty("hard");
    expect(gridRecallParamsFromProfile(profile).gridSize).toBe(25);
    const broken = {
      ...profile,
      parameters: { gridSize: 25 },
    } as typeof profile;
    expect(() => gridRecallParamsFromProfile(broken)).toThrow();
  });
});

describe("nextTargetCount", () => {
  it("escalates by one on a pass (capped at grid size)", () => {
    expect(
      nextTargetCount(5, true, "normal", GRID_RECALL_DIFFICULTY_PARAMS.normal),
    ).toBe(6);
    expect(
      nextTargetCount(35, true, "expert", GRID_RECALL_DIFFICULTY_PARAMS.expert),
    ).toBe(36); // capped at grid size 36
  });
  it("holds on a failure", () => {
    expect(
      nextTargetCount(5, false, "normal", GRID_RECALL_DIFFICULTY_PARAMS.normal),
    ).toBe(5);
  });
  it("adaptive moves within bounds", () => {
    const a = nextTargetCount(3, true, "adaptive", ADAPTIVE_PARAMS);
    expect(a).toBe(4);
    const b = nextTargetCount(2, false, "adaptive", ADAPTIVE_PARAMS);
    expect(b).toBe(3); // floored at minTargetCount 3
    const c = nextTargetCount(12, true, "adaptive", ADAPTIVE_PARAMS);
    expect(c).toBe(12); // capped at maxTargetCount
  });
});

describe("sessionChallengeRating", () => {
  it("returns the SDK default for fixed levels", () => {
    expect(
      sessionChallengeRating("hard", resolveGridRecallDifficulty("hard"), 8),
    ).toBe(0.8);
  });
  it("maps the final target count into [0,1] for adaptive", () => {
    const profile = resolveGridRecallDifficulty("adaptive");
    expect(sessionChallengeRating("adaptive", profile, 2)).toBeCloseTo(0);
    expect(sessionChallengeRating("adaptive", profile, 12)).toBeCloseTo(1);
    expect(sessionChallengeRating("adaptive", profile, 7)).toBeCloseTo(
      4 / 9,
      1,
    );
  });
});
