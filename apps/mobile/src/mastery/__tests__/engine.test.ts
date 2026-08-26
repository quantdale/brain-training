import { describe, expect, it } from "@jest/globals";

import {
  computeMastery,
  EXPERT_STRONG_MIN,
  HARD_STRONG_MIN,
  MASTERY_TIERS,
  MASTERY_VERSION,
  type MasteryInput,
} from "../engine";

function input(overrides: Partial<MasteryInput> = {}): MasteryInput {
  return {
    gameId: "game-x",
    sessions: 0,
    bestNormalized: 0,
    avgNormalized: 0,
    hardStrong: 0,
    expertStrong: 0,
    lastCompletedAt: 0,
    ...overrides,
  };
}

describe("mastery engine", () => {
  it("versions its semantics", () => {
    expect(MASTERY_VERSION).toBe(1);
  });

  it("orders the ladder and ranks tiers", () => {
    expect(MASTERY_TIERS).toEqual([
      "unplayed",
      "learning",
      "developing",
      "proficient",
      "advanced",
      "mastered",
    ]);
    expect(computeMastery(input()).rank).toBe(0);
    expect(computeMastery(input({ sessions: 3 })).rank).toBe(1);
    expect(computeMastery(input({ sessions: 6, bestNormalized: 0.6 })).rank).toBe(2);
  });

  it("never promotes tiny volumes regardless of luck", () => {
    // One perfect Expert-fluke session is still "learning": the volume gate
    // precedes the strength gates by design.
    const s = computeMastery(
      input({
        sessions: 2,
        bestNormalized: 1,
        avgNormalized: 1,
        expertStrong: 1,
        hardStrong: 5,
      }),
    );
    expect(s.tier).toBe("learning");
  });

  it("walks developing → proficient on two strong Hard rounds", () => {
    const base = input({ sessions: 6, bestNormalized: 0.62 });
    expect(computeMastery(base).tier).toBe("developing");
    const proficient = computeMastery({
      ...base,
      hardStrong: 2,
    });
    expect(proficient.tier).toBe("proficient");
    expect(proficient.nextMilestone).toContain("Clear Expert");
  });

  it("reaches proficient via consistency without any Hard clears", () => {
    const s = computeMastery(
      input({ sessions: 9, bestNormalized: 0.7, avgNormalized: 0.72 }),
    );
    expect(s.tier).toBe("proficient");
  });

  it("promotes to advanced on one strong Expert clear", () => {
    const s = computeMastery(
      input({
        sessions: 8,
        bestNormalized: 0.8,
        avgNormalized: 0.6,
        expertStrong: 1,
        hardStrong: 2,
      }),
    );
    expect(s.tier).toBe("advanced");
    expect(s.nextMilestone).toContain("Clear Expert 1 more time");
  });

  it("masters on two strong Expert clears plus an 80% best", () => {
    const s = computeMastery(
      input({
        sessions: 12,
        bestNormalized: 0.85,
        avgNormalized: 0.7,
        expertStrong: 2,
        hardStrong: 4,
      }),
    );
    expect(s.tier).toBe("mastered");
    expect(s.nextMilestone).toBeNull();
  });

  it("withholds mastery when the Expert clears were weak", () => {
    const s = computeMastery(
      input({
        sessions: 12,
        bestNormalized: 0.7, // below the 0.8 best gate
        expertStrong: 5, // clears above EXPERT_STRONG_MIN but not 80%
      }),
    );
    expect(s.tier).toBe("advanced");
    expect(s.nextMilestone).toContain("80%");
  });

  it("uses the documented strength floors", () => {
    expect(HARD_STRONG_MIN).toBe(0.6);
    expect(EXPERT_STRONG_MIN).toBe(0.65);
  });

  it("phrases learning milestones from stored counts only", () => {
    const s = computeMastery(input({ sessions: 3, bestNormalized: 0.4 }));
    expect(s.nextMilestone).toBe("Play 2 more sessions to leave the basics");
    const weakBest = computeMastery(input({ sessions: 7, bestNormalized: 0.4 }));
    expect(weakBest.tier).toBe("learning");
    expect(weakBest.nextMilestone).toBe("Reach 50% on any round");
  });
});
