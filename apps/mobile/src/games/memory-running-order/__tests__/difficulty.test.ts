// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from "@jest/globals";

import {
  ADAPTIVE_PARAMS,
  RUNNING_ORDER_DIFFICULTY_PARAMS,
  nextRecallLength,
  resolveRunningOrderDifficulty,
  runningOrderParamsForLevel,
  runningOrderParamsFromProfile,
  sessionChallengeRating,
} from "../difficulty";

describe("runningOrderParamsForLevel / resolve", () => {
  it("returns the tuning table for fixed levels", () => {
    expect(runningOrderParamsForLevel("easy")).toEqual(
      RUNNING_ORDER_DIFFICULTY_PARAMS.easy,
    );
    expect(resolveRunningOrderDifficulty("normal").level).toBe("normal");
    expect(resolveRunningOrderDifficulty("normal").challengeRating).toBe(0.5);
    expect(resolveRunningOrderDifficulty("expert").challengeRating).toBe(0.95);
  });
  it("carries the game tuning into the resolved profile parameters", () => {
    const profile = resolveRunningOrderDifficulty("hard");
    expect(profile.parameters.streamLen).toBe(6);
    expect(profile.parameters.initialRecallLength).toBe(3);
    expect(profile.parameters.flashMs).toBe(700);
    expect(profile.parameters.rounds).toBe(6);
  });
  it("adaptive uses the neutral baseline with bounded recall length", () => {
    const profile = resolveRunningOrderDifficulty("adaptive");
    expect(profile.level).toBe("adaptive");
    expect(profile.challengeRating).toBe(0.5);
    expect(profile.parameters.streamLen).toBe(ADAPTIVE_PARAMS.streamLen);
    expect(profile.parameters.minRecallLength).toBe(
      ADAPTIVE_PARAMS.minRecallLength,
    );
    expect(profile.parameters.maxRecallLength).toBe(
      ADAPTIVE_PARAMS.maxRecallLength,
    );
  });
});

describe("runningOrderParamsFromProfile", () => {
  it("recovers params and throws on missing numeric fields", () => {
    const profile = resolveRunningOrderDifficulty("hard");
    expect(runningOrderParamsFromProfile(profile).streamLen).toBe(6);
    const broken = {
      ...profile,
      parameters: { streamLen: 6 },
    } as typeof profile;
    expect(() => runningOrderParamsFromProfile(broken)).toThrow();
  });
  it("keeps the optional adaptive bounds when present", () => {
    const params = runningOrderParamsFromProfile(
      resolveRunningOrderDifficulty("adaptive"),
    );
    expect(params.minRecallLength).toBe(2);
    expect(params.maxRecallLength).toBe(5);
  });
});

describe("nextRecallLength", () => {
  it("escalates by one on a pass (capped at the stream length)", () => {
    expect(
      nextRecallLength(
        3,
        true,
        "normal",
        RUNNING_ORDER_DIFFICULTY_PARAMS.normal,
      ),
    ).toBe(4);
    expect(
      nextRecallLength(
        4,
        true,
        "normal",
        RUNNING_ORDER_DIFFICULTY_PARAMS.normal,
      ),
    ).toBe(4); // capped at streamLen
  });
  it("holds on a failure", () => {
    expect(
      nextRecallLength(
        3,
        false,
        "normal",
        RUNNING_ORDER_DIFFICULTY_PARAMS.normal,
      ),
    ).toBe(3);
  });
  it("adaptive moves ±1 within [minRecallLength, maxRecallLength]", () => {
    expect(nextRecallLength(3, true, "adaptive", ADAPTIVE_PARAMS)).toBe(4);
    expect(nextRecallLength(2, false, "adaptive", ADAPTIVE_PARAMS)).toBe(2); // floored at min
    expect(nextRecallLength(5, true, "adaptive", ADAPTIVE_PARAMS)).toBe(5); // capped at max
  });
});

describe("sessionChallengeRating", () => {
  it("returns the SDK default for fixed levels", () => {
    expect(
      sessionChallengeRating(
        "hard",
        resolveRunningOrderDifficulty("hard"),
        5,
      ),
    ).toBe(0.8);
  });
  it("maps the final recall length into [0,1] for adaptive", () => {
    const profile = resolveRunningOrderDifficulty("adaptive");
    expect(sessionChallengeRating("adaptive", profile, 2)).toBeCloseTo(0);
    expect(sessionChallengeRating("adaptive", profile, 5)).toBeCloseTo(1);
    expect(sessionChallengeRating("adaptive", profile, 3)).toBeCloseTo(1 / 3);
  });
});
