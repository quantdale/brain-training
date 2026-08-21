// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  ADAPTIVE_PARAMS,
  PAIR_RECALL_DIFFICULTY_PARAMS,
  pairRecallParamsForLevel,
  pairRecallParamsFromProfile,
  resolvePairRecallDifficulty,
  sessionChallengeRating,
} from "../difficulty";
import type { DifficultyProfile } from "@/sdk";

describe("resolvePairRecallDifficulty", () => {
  it("resolves every fixed level with its declared tuning", () => {
    for (const [level, params] of Object.entries(PAIR_RECALL_DIFFICULTY_PARAMS)) {
      const profile = resolvePairRecallDifficulty(level as keyof typeof PAIR_RECALL_DIFFICULTY_PARAMS);
      expect(profile.level).toBe(level);
      expect(profile.parameters.initialPairCount).toBe(params.initialPairCount);
      expect(profile.parameters.studyMs).toBe(params.studyMs);
      expect(profile.parameters.rounds).toBe(params.rounds);
      expect(profile.parameters.maxPairCount).toBe(params.maxPairCount);
    }
  });

  it("resolves the adaptive profile with bounds", () => {
    const profile = resolvePairRecallDifficulty("adaptive");
    expect(profile.level).toBe("adaptive");
    expect(profile.parameters.minPairCount).toBe(ADAPTIVE_PARAMS.minPairCount);
    expect(profile.parameters.maxPairCount).toBe(ADAPTIVE_PARAMS.maxPairCount);
  });

  it("returns fresh parameter objects (never shared frozen defaults)", () => {
    const a = pairRecallParamsForLevel("normal");
    const b = pairRecallParamsForLevel("normal");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("pairRecallParamsFromProfile", () => {
  it("recovers validated parameters", () => {
    const profile = resolvePairRecallDifficulty("hard");
    const params = pairRecallParamsFromProfile(profile);
    expect(params).toEqual(PAIR_RECALL_DIFFICULTY_PARAMS.hard);
  });

  it("throws on a missing numeric parameter instead of producing a broken board", () => {
    const profile = resolvePairRecallDifficulty("normal");
    const broken = {
      ...profile,
      parameters: { ...profile.parameters, studyMs: undefined },
    } as unknown as DifficultyProfile;
    expect(() => pairRecallParamsFromProfile(broken)).toThrow();
  });
});

describe("sessionChallengeRating", () => {
  it("reports the SDK default rating for fixed levels", () => {
    const profile = resolvePairRecallDifficulty("expert");
    expect(sessionChallengeRating("expert", profile, 8)).toBe(
      profile.challengeRating,
    );
  });

  it("maps the final adaptive pair count linearly over [min, max]", () => {
    const profile = resolvePairRecallDifficulty("adaptive");
    const min = ADAPTIVE_PARAMS.minPairCount!;
    const max = ADAPTIVE_PARAMS.maxPairCount;
    expect(sessionChallengeRating("adaptive", profile, min)).toBe(0);
    expect(sessionChallengeRating("adaptive", profile, max)).toBe(1);
    const mid = Math.floor((min + max) / 2);
    expect(sessionChallengeRating("adaptive", profile, mid)).toBeCloseTo(
      (mid - min) / (max - min),
    );
  });
});
