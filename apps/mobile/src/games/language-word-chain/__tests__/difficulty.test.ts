// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";
import type { DifficultyLevel } from "@/sdk";

import {
  ADAPTIVE_PARAMS,
  TIER_BITS,
  WORD_CHAIN_DIFFICULTY_PARAMS,
  nextRoundParams,
  resolveWordChainDifficulty,
  sessionChallengeRating,
  tierNumber,
  tierOfNumber,
  tiersFromMask,
  wordChainParamsForLevel,
  wordChainParamsFromProfile,
} from "../difficulty";

describe("wordChainParamsForLevel / resolve", () => {
  it("returns the frozen defaults for fixed levels", () => {
    expect(wordChainParamsForLevel("easy")).toEqual(
      WORD_CHAIN_DIFFICULTY_PARAMS.easy,
    );
    expect(wordChainParamsForLevel("expert")).toEqual(
      WORD_CHAIN_DIFFICULTY_PARAMS.expert,
    );
  });

  it("resolves fixed levels with the SDK default challenge ratings", () => {
    const normal = resolveWordChainDifficulty("normal");
    expect(normal.level).toBe("normal");
    expect(normal.challengeRating).toBe(0.5);
    expect(resolveWordChainDifficulty("expert").challengeRating).toBe(0.95);
    // The profile parameters carry the game tuning.
    expect(normal.parameters.rounds).toBe(
      WORD_CHAIN_DIFFICULTY_PARAMS.normal.rounds,
    );
    expect(normal.parameters.tierMask).toBe(TIER_BITS.t1 | TIER_BITS.t2);
  });

  it("adaptive uses the neutral baseline and carries its bounds", () => {
    const profile = resolveWordChainDifficulty("adaptive");
    expect(profile.level).toBe("adaptive");
    expect(profile.challengeRating).toBe(0.5);
    expect(profile.parameters.timePerRoundMs).toBe(
      ADAPTIVE_PARAMS.timePerRoundMs,
    );
    expect(profile.parameters.minTimePerRoundMs).toBe(7_000);
    expect(profile.parameters.maxTimePerRoundMs).toBe(14_000);
  });

  it("scales difficulty monotonically across the fixed levels", () => {
    const levels: Exclude<DifficultyLevel, "adaptive">[] = [
      "easy",
      "normal",
      "hard",
      "expert",
    ];
    for (let i = 1; i < levels.length; i += 1) {
      const lo = WORD_CHAIN_DIFFICULTY_PARAMS[levels[i - 1]];
      const hi = WORD_CHAIN_DIFFICULTY_PARAMS[levels[i]];
      expect(hi.rounds).toBeGreaterThanOrEqual(lo.rounds);
      expect(hi.timePerRoundMs).toBeLessThanOrEqual(lo.timePerRoundMs);
      expect(hi.maxBlanks).toBeGreaterThanOrEqual(lo.maxBlanks);
    }
  });
});

describe("tiersFromMask / tier helpers", () => {
  it("decodes bitmasks into ordered tier lists", () => {
    expect(tiersFromMask(1)).toEqual(["t1"]);
    expect(tiersFromMask(2)).toEqual(["t2"]);
    expect(tiersFromMask(3)).toEqual(["t1", "t2"]);
    expect(tiersFromMask(7)).toEqual(["t1", "t2", "t3"]);
  });

  it("rejects invalid masks", () => {
    expect(() => tiersFromMask(0)).toThrow(RangeError);
    expect(() => tiersFromMask(8)).toThrow(RangeError);
    expect(() => tiersFromMask(1.5)).toThrow(RangeError);
  });

  it("converts between tiers and 1-based ordinals", () => {
    expect(tierNumber("t1")).toBe(1);
    expect(tierNumber("t3")).toBe(3);
    expect(tierOfNumber(2)).toBe("t2");
    expect(() => tierOfNumber(0)).toThrow(RangeError);
    expect(() => tierOfNumber(4)).toThrow(RangeError);
  });
});

describe("wordChainParamsFromProfile", () => {
  it("recovers validated params from a resolved profile", () => {
    const profile = resolveWordChainDifficulty("hard");
    const params = wordChainParamsFromProfile(profile);
    expect(params).toEqual(WORD_CHAIN_DIFFICULTY_PARAMS.hard);
  });

  it("recovers adaptive bounds", () => {
    const params = wordChainParamsFromProfile(
      resolveWordChainDifficulty("adaptive"),
    );
    expect(params.initialTier).toBe(ADAPTIVE_PARAMS.initialTier);
    expect(params.timeStepMs).toBe(ADAPTIVE_PARAMS.timeStepMs);
  });

  it("throws on missing or nonsensical fields", () => {
    const profile = resolveWordChainDifficulty("normal");
    expect(() =>
      wordChainParamsFromProfile({
        ...profile,
        parameters: { tierMask: 3 },
      } as typeof profile),
    ).toThrow(/rounds/);
    expect(() =>
      wordChainParamsFromProfile({
        ...profile,
        parameters: { ...profile.parameters, tierMask: 9 },
      } as typeof profile),
    ).toThrow(/tierMask/);
    expect(() =>
      wordChainParamsFromProfile({
        ...profile,
        parameters: { ...profile.parameters, minBlanks: 4, maxBlanks: 2 },
      } as typeof profile),
    ).toThrow(/maxBlanks/);
    expect(() =>
      wordChainParamsFromProfile({
        ...profile,
        parameters: { ...profile.parameters, initialTier: 7 },
      } as typeof profile),
    ).toThrow(/initialTier/);
  });
});

describe("nextRoundParams", () => {
  it("fixed levels keep their tier pool and budget", () => {
    const params = WORD_CHAIN_DIFFICULTY_PARAMS.normal;
    const tuning = nextRoundParams("normal", params, null, 12_000, true);
    expect(tuning.tiers).toEqual(["t1", "t2"]);
    expect(tuning.timePerRoundMs).toBe(params.timePerRoundMs);
    expect(tuning.currentTier).toBeNull();
  });

  it("adaptive escalates tier and tightens budget on a pass", () => {
    const tuning = nextRoundParams("adaptive", ADAPTIVE_PARAMS, "t1", 9_000, true);
    expect(tuning.currentTier).toBe("t2");
    expect(tuning.tiers).toEqual(["t2"]);
    expect(tuning.timePerRoundMs).toBe(8_000);
  });

  it("adaptive eases tier and widens budget on a fail", () => {
    const tuning = nextRoundParams("adaptive", ADAPTIVE_PARAMS, "t2", 8_000, false);
    expect(tuning.currentTier).toBe("t1");
    expect(tuning.timePerRoundMs).toBe(9_000);
  });

  it("adaptive clamps at both extremes", () => {
    // Pass at the floor keeps the floor budget; tier caps at t3.
    const top = nextRoundParams("adaptive", ADAPTIVE_PARAMS, "t3", 7_000, true);
    expect(top.currentTier).toBe("t3");
    expect(top.timePerRoundMs).toBe(7_000);
    // Fail at the ceiling keeps the ceiling budget; tier floors at t1.
    const bottom = nextRoundParams(
      "adaptive",
      ADAPTIVE_PARAMS,
      "t1",
      14_000,
      false,
    );
    expect(bottom.currentTier).toBe("t1");
    expect(bottom.timePerRoundMs).toBe(14_000);
  });

  it("falls back to initialTier when no tier is active yet", () => {
    const tuning = nextRoundParams("adaptive", ADAPTIVE_PARAMS, null, 9_000, true);
    expect(tuning.currentTier).toBe("t2");
  });
});

describe("sessionChallengeRating", () => {
  it("returns the SDK default rating for fixed levels", () => {
    expect(
      sessionChallengeRating(
        "hard",
        resolveWordChainDifficulty("hard"),
        null,
      ),
    ).toBe(0.8);
  });

  it("maps the final adaptive tier linearly into [0, 1]", () => {
    const profile = resolveWordChainDifficulty("adaptive");
    expect(sessionChallengeRating("adaptive", profile, "t1")).toBeCloseTo(0);
    expect(sessionChallengeRating("adaptive", profile, "t2")).toBeCloseTo(0.5);
    expect(sessionChallengeRating("adaptive", profile, "t3")).toBeCloseTo(1);
  });

  it("falls back to the profile rating when no tier was reached", () => {
    const profile = resolveWordChainDifficulty("adaptive");
    expect(sessionChallengeRating("adaptive", profile, null)).toBe(0.5);
  });
});
