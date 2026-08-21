// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import type { DifficultyLevel } from "@/sdk";

import {
  ADAPTIVE_PARAMS,
  LOGIC_DEDUCTION_DIFFICULTY_PARAMS,
  adaptiveRoundParams,
  logicDeductionParamsForLevel,
  logicDeductionParamsFromProfile,
  resolveLogicDeductionDifficulty,
  sessionChallengeRating,
} from "../difficulty";

describe("logicDeductionParamsForLevel / resolve", () => {
  it("returns the fixed tuning for fixed levels", () => {
    expect(logicDeductionParamsForLevel("easy")).toEqual(
      LOGIC_DEDUCTION_DIFFICULTY_PARAMS.easy,
    );
    expect(logicDeductionParamsForLevel("expert").entityCount).toBe(5);
  });
  it("resolves profiles with the SDK default challenge ratings", () => {
    expect(resolveLogicDeductionDifficulty("easy").challengeRating).toBe(0.2);
    expect(resolveLogicDeductionDifficulty("normal").level).toBe("normal");
    expect(resolveLogicDeductionDifficulty("normal").challengeRating).toBe(0.5);
    expect(resolveLogicDeductionDifficulty("hard").challengeRating).toBe(0.8);
    expect(resolveLogicDeductionDifficulty("expert").challengeRating).toBe(0.95);
  });
  it("adaptive uses the neutral baseline and carries bounds", () => {
    const profile = resolveLogicDeductionDifficulty("adaptive");
    expect(profile.level).toBe("adaptive");
    expect(profile.challengeRating).toBe(0.5);
    expect(profile.parameters.entityCount).toBe(ADAPTIVE_PARAMS.entityCount);
    expect(profile.parameters.maxEntityCount).toBe(
      ADAPTIVE_PARAMS.maxEntityCount,
    );
  });
});

describe("logicDeductionParamsFromProfile", () => {
  it("recovers params from a resolved profile", () => {
    const profile = resolveLogicDeductionDifficulty("hard");
    const params = logicDeductionParamsFromProfile(profile);
    expect(params.entityCount).toBe(4);
    expect(params.attributeCount).toBe(3);
    expect(params.clueCount).toBe(8);
    expect(params.roundTimeMs).toBe(22_000);
  });
  it("throws on missing or out-of-bounds parameters", () => {
    const profile = resolveLogicDeductionDifficulty("normal");
    const broken = { ...profile, parameters: { entityCount: 3 } } as typeof profile;
    expect(() => logicDeductionParamsFromProfile(broken)).toThrow();
    const badEntity = {
      ...profile,
      parameters: { ...profile.parameters, entityCount: 9 },
    } as typeof profile;
    expect(() => logicDeductionParamsFromProfile(badEntity)).toThrow();
  });
});

describe("adaptiveRoundParams", () => {
  it("leaves fixed levels untouched", () => {
    for (const level of ["easy", "normal", "hard", "expert"] as const) {
      const params = LOGIC_DEDUCTION_DIFFICULTY_PARAMS[level];
      expect(adaptiveRoundParams(level as DifficultyLevel, params, true)).toBe(
        params,
      );
    }
  });
  it("escalates on a pass within bounds", () => {
    const next = adaptiveRoundParams("adaptive", ADAPTIVE_PARAMS, true);
    expect(next.entityCount).toBe(4);
    expect(next.attributeCount).toBe(3);
    expect(next.clueCount).toBe(6);
    expect(next.roundTimeMs).toBe(23_000);
  });
  it("eases on a fail without crossing the floors", () => {
    const next = adaptiveRoundParams("adaptive", ADAPTIVE_PARAMS, false);
    expect(next.entityCount).toBe(3); // floored at minEntityCount
    expect(next.attributeCount).toBe(2); // floored at minAttributeCount
    expect(next.clueCount).toBe(4); // minClueCount
    expect(next.roundTimeMs).toBe(25_000);
  });
  it("holds at the ceilings", () => {
    const maxed: typeof ADAPTIVE_PARAMS = {
      ...ADAPTIVE_PARAMS,
      entityCount: 5,
      attributeCount: 4,
      clueCount: 12,
      roundTimeMs: 10_000,
    };
    const next = adaptiveRoundParams("adaptive", maxed, true);
    expect(next.entityCount).toBe(5);
    expect(next.attributeCount).toBe(4);
    expect(next.clueCount).toBe(12);
    expect(next.roundTimeMs).toBe(10_000); // floor holds even on a pass
  });
});

describe("sessionChallengeRating", () => {
  it("returns the SDK default for fixed levels", () => {
    expect(
      sessionChallengeRating(
        "hard",
        resolveLogicDeductionDifficulty("hard"),
        4,
        3,
      ),
    ).toBe(0.8);
  });
  it("maps the final entity×attribute footprint into [0,1] for adaptive", () => {
    const profile = resolveLogicDeductionDifficulty("adaptive");
    // minC = 3*2 = 6, maxC = 5*4 = 20 → span 14.
    expect(sessionChallengeRating("adaptive", profile, 3, 2)).toBeCloseTo(0);
    expect(sessionChallengeRating("adaptive", profile, 5, 4)).toBeCloseTo(1);
    expect(sessionChallengeRating("adaptive", profile, 4, 3)).toBeCloseTo(
      6 / 14,
    );
  });
});
