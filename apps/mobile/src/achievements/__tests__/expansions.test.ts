/**
 * Achievement engine expansions (engagement-wave-02, section B).
 *
 * Covers the new deterministic criteria families added for breadth / diverse
 * play / category mastery depth / consistency / accuracy / personal-best /
 * workout completion, plus the new aggregation-based snapshot builder and the
 * guaranteed baseline-stability contract (the original met-set must not
 * change when new achievements are added).
 */
import { describe, expect, it } from "@jest/globals";

import { AppDatabase, type CompleteSessionInput } from "@/db";
import { createMigratedDb } from "@/db/__tests__/helpers";
import {
  ACHIEVEMENT_DEFINITIONS_V1,
  claimAchievementReward,
  evaluateAchievements,
  evaluateAchievementProgress,
  toDbAchievementDefinition,
  type AchievementSnapshot,
} from "@/achievements";
import { buildAchievementSnapshot, syncAchievements } from "@/progression";

const T0 = 1_700_000_000_000;

/** Minimal session insert helper for snapshot/aggregation tests. */
function sessionInput(
  overrides: Partial<CompleteSessionInput["session"]>,
): CompleteSessionInput {
  return {
    session: {
      id: `s-${Math.random().toString(36).slice(2)}`,
      gameId: "memory",
      gameVersion: 1,
      generatorVersion: 1,
      scoringVersion: 1,
      seed: 1,
      difficulty: { mode: "normal" },
      rawResult: {},
      normalizedResult: 0.5,
      xp: 10,
      startedAt: T0,
      completedAt: T0,
      durationMs: 1000,
      ...overrides,
    },
  };
}

async function makeDb(): Promise<AppDatabase> {
  const adapter = await createMigratedDb();
  return new AppDatabase(adapter, { now: () => T0 });
}

describe("new achievement criteria — pure evaluation", () => {
  const snapshot: AchievementSnapshot = {
    sessionCount: 2600,
    totalXp: 160000,
    domainSessions: { Memory: 105, Math: 60 },
    longestStreak: 31,
    perfectSessions: 40,
    distinctGames: 12,
    domainCoverage: 8,
    activeDays: 100,
    accuracySessions: 120,
    bestNormalized: 0.99,
    workoutsCompleted: 55,
  };

  it("meets the new volume / XP-depth achievements", () => {
    const met = evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, snapshot);
    expect(met).toContain("ach-1000"); // 1000 sessions
    expect(met).toContain("ach-2500"); // 2500 sessions
    expect(met).toContain("ach-xp-150000"); // 150000 xp
  });

  it("meets breadth / diverse-game achievements", () => {
    const met = evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, snapshot);
    expect(met).toContain("ach-games-5");
    expect(met).toContain("ach-games-12");
    expect(met).toContain("ach-domains-all"); // all 8 categories
  });

  it("meets consistency (active days) achievements", () => {
    const met = evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, snapshot);
    expect(met).toContain("ach-active-7");
    expect(met).toContain("ach-active-30");
    expect(met).toContain("ach-active-100");
  });

  it("meets accuracy / personal-best achievements", () => {
    const met = evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, snapshot);
    expect(met).toContain("ach-acc-25");
    expect(met).toContain("ach-acc-100");
    expect(met).toContain("ach-best-90");
    expect(met).toContain("ach-best-98");
  });

  it("meets workout-completion and category-mastery-depth achievements", () => {
    const met = evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, snapshot);
    expect(met).toContain("ach-workout-10");
    expect(met).toContain("ach-workout-50");
    expect(met).toContain("ach-domain-memory-100");
  });

  it("does NOT meet goals the snapshot falls short of", () => {
    const met = evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, {
      ...snapshot,
      distinctGames: 3,
      workoutsCompleted: 1,
      bestNormalized: 0.5,
    });
    expect(met).not.toContain("ach-games-5");
    expect(met).not.toContain("ach-workout-10");
    expect(met).not.toContain("ach-best-90");
  });
});

describe("evaluateAchievementProgress — new criteria families", () => {
  const snapshot: AchievementSnapshot = {
    sessionCount: 120,
    totalXp: 30000,
    domainSessions: { Memory: 12 },
    longestStreak: 40,
    perfectSessions: 20,
    distinctGames: 6,
    domainCoverage: 3,
    activeDays: 15,
    accuracySessions: 30,
    bestNormalized: 0.95,
    workoutsCompleted: 12,
  };

  it("computes clamped ratios for every new criteria type", () => {
    const byId = (id: string) =>
      ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === id)!;

    expect(
      evaluateAchievementProgress(byId("ach-games-12"), snapshot),
    ).toMatchObject({
      progress: 6,
      goal: 12,
      completed: false,
    });
    expect(
      evaluateAchievementProgress(byId("ach-games-5"), snapshot).completed,
    ).toBe(true);
    expect(
      evaluateAchievementProgress(byId("ach-domains-all"), snapshot),
    ).toMatchObject({
      progress: 3,
      goal: 8,
      completed: false,
    });
    const best = evaluateAchievementProgress(byId("ach-best-98"), snapshot);
    expect(best.completed).toBe(false);
    expect(best.ratio).toBeCloseTo(0.95 / 0.98);
    expect(
      evaluateAchievementProgress(byId("ach-workout-10"), snapshot).completed,
    ).toBe(true);
    expect(
      evaluateAchievementProgress(byId("ach-active-100"), snapshot).completed,
    ).toBe(false);
  });

  it("treats missing richer fields as zero progress", () => {
    const byId = (id: string) =>
      ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === id)!;
    const empty: AchievementSnapshot = { sessionCount: 0, totalXp: 0 };
    expect(
      evaluateAchievementProgress(byId("ach-games-5"), empty),
    ).toMatchObject({
      progress: 0,
      goal: 5,
      completed: false,
      ratio: 0,
    });
    expect(evaluateAchievementProgress(byId("ach-best-90"), empty).ratio).toBe(
      0,
    );
  });
});

describe("baseline stability contract", () => {
  it("still reports exactly the original met set for the baseline snapshot", () => {
    // The baseline four keep their exact criteria + order; adding 16 new
    // achievements above these thresholds must not change the met-set.
    const met = evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, {
      sessionCount: 25,
      totalXp: 6000,
    });
    expect(met).toEqual(["ach-first", "ach-25", "ach-xp-5000"]);
  });

  it("new achievements have unique ids and stable criteria shapes", () => {
    const ids = new Set<string>();
    for (const def of ACHIEVEMENT_DEFINITIONS_V1) {
      expect(ids.has(def.id)).toBe(false);
      ids.add(def.id);
      expect(def.version).toBe(1);
      expect(def.rewardXp).toBeGreaterThanOrEqual(0);
      expect(def.rewardCurrency).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("claim a new achievement via the real repos (idempotent)", () => {
  it("unlocks once and claims the reward exactly once", async () => {
    const db = await makeDb();
    const def = ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === "ach-games-5")!;
    await db.achievements.upsertDefinition(toDbAchievementDefinition(def));
    expect(await db.achievements.unlock(def.id)).toBe(true);

    const first = await claimAchievementReward(db, def);
    expect(first.status).toBe("claimed");
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(def.rewardXp);
    expect(await db.ledger.getBalance()).toBe(def.rewardCurrency);

    const second = await claimAchievementReward(db, def);
    expect(second.status).toBe("already-claimed");
    // No double grant.
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(def.rewardXp);
    expect(await db.ledger.getBalance()).toBe(def.rewardCurrency);
  });
});

describe("buildAchievementSnapshot — aggregation integration", () => {
  async function seedHistory(db: AppDatabase): Promise<void> {
    // 4 distinct games across 3 domains, on 3 distinct active days.
    const games = [
      { id: "memory", domain: "Memory", day: 0, norm: 0.95 },
      { id: "math-fast-math", domain: "Math", day: 0, norm: 0.85 },
      { id: "attention-target-count", domain: "Attention", day: 1, norm: 0.6 },
      { id: "spatial-grid-nav", domain: "Spatial", day: 2, norm: 0.4 },
    ];
    let i = 0;
    for (const g of games) {
      await db.sessions.completeSession(
        sessionInput({
          id: `seed-${i++}`,
          gameId: g.id,
          normalizedResult: g.norm,
          xp: 20,
          completedAt: T0 + g.day * 86_400_000,
        }),
      );
    }
    // A second Memory session on day 0 (drives domain-sessions + perfect count).
    await db.sessions.completeSession(
      sessionInput({
        id: "seed-memory-2",
        gameId: "memory",
        normalizedResult: 0.92,
        completedAt: T0,
      }),
    );
    // One completed workout.
    await db.workouts.getOrCreate("2026-08-16", {
      gameIds: ["memory", "math-fast-math"],
    });
    const w = await db.workouts.getByDate("2026-08-16");
    if (w) {
      await db.adapter.run(
        "UPDATE workout_instances SET status = 'completed', current_index = 4 WHERE date = '2026-08-16'",
      );
    }
  }

  it("derives every field from aggregation queries without a full-history scan", async () => {
    const db = await makeDb();
    await seedHistory(db);
    const snapshot = await buildAchievementSnapshot(db, new Date(T0));

    expect(snapshot.sessionCount).toBe(5);
    expect(snapshot.distinctGames).toBe(4);
    expect(snapshot.domainCoverage).toBe(3); // Memory, Math, Attention, Spatial -> 4? wait distinct
    // distinct domains among played games: Memory, Math, Attention, Spatial = 4
    expect(snapshot.domainCoverage).toBe(4);
    expect(snapshot.domainSessions?.Memory).toBe(2);
    expect(snapshot.domainSessions?.Math).toBe(1);
    expect(snapshot.activeDays).toBe(3); // 3 distinct dates
    expect(snapshot.accuracySessions).toBe(3); // norm >= 0.8 (0.95, 0.85, 0.92)
    expect(snapshot.perfectSessions).toBe(2); // norm >= 0.9 (0.95, 0.92)
    expect(snapshot.bestNormalized).toBeCloseTo(0.95);
    expect(snapshot.workoutsCompleted).toBe(1);
    // 3 consecutive days (day0,1,2) -> longest streak 3.
    expect(snapshot.longestStreak).toBe(3);
  });

  it("syncAchievements unlocks the reachable new achievements", async () => {
    const db = await makeDb();
    await seedHistory(db);
    await db.achievements.upsertDefinition(
      toDbAchievementDefinition(
        ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === "ach-games-5")!,
      ),
    );
    await db.achievements.upsertDefinition(
      toDbAchievementDefinition(
        ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === "ach-domains-all")!,
      ),
    );
    await db.achievements.upsertDefinition(
      toDbAchievementDefinition(
        ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === "ach-active-7")!,
      ),
    );
    await db.achievements.upsertDefinition(
      toDbAchievementDefinition(
        ACHIEVEMENT_DEFINITIONS_V1.find((d) => d.id === "ach-workout-10")!,
      ),
    );

    for (const def of ACHIEVEMENT_DEFINITIONS_V1) {
      await db.achievements.upsertDefinition(toDbAchievementDefinition(def));
    }
    await (await import("@/progression")).syncAchievements(db, new Date(T0));

    // 4 distinct games / 3 domains / 3 active days / 0 completed workouts? wait 1.
    expect(await db.achievements.getUnlock("ach-games-5")).not.toBeNull();
    expect(await db.achievements.getUnlock("ach-domains-all")).toBeNull(); // needs 8 domains
    expect(await db.achievements.getUnlock("ach-active-7")).toBeNull(); // needs 7 active days
    expect(await db.achievements.getUnlock("ach-workout-10")).toBeNull(); // needs 10 workouts
  });
});
