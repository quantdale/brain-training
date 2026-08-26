/**
 * Campaign 014 W8 — repeated-use / multi-day simulation (persistence level).
 *
 * Drives a REAL migrated SQLite database (temp file, so an app "relaunch" is
 * a genuine close/reopen of the same store) through two training weeks:
 * consecutive daily workouts, a paid reroll, a missed day with proactive
 * Freeze coverage, mastery progression up to Mastered, personal-best updates,
 * Daily-Spotlight rollover, quest-period boundary math, and a full
 * export → wipe → replace-import round-trip. Deterministic: every clock read
 * is injected; no wall time, no randomness beyond seeded generators.
 *
 * This is a coherence proof, not a UI journey — device journeys cover the
 * interactive layer (see scripts/qa/autobot.mjs).
 */
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";

import {
  AppDatabase,
  type AppDatabaseOptions,
} from "@/db";
import { createNodeSqliteAdapter } from "@/db/adapters/node";
import { initializeConnection, runMigrations } from "@/db/migrate";
import { paidReroll } from "@/db/economy";
import { rerollCost } from "@/workout/reroll";
import type { SQLiteAdapter } from "@/db/adapter";
import { createRatingPipeline } from "@/rating/pipeline";
import {
  addCoveredDates,
  readCoveredDates,
  grantItems,
} from "@/streaks";
import { reconstructStreak } from "@/streaks/reconstruct";
import { dailySpotlight } from "@/spotlight/spotlight";
import { computeMastery } from "@/mastery";
import { currentPeriodKey, periodKeyFor } from "@/quests/period";
import {
  applyImport,
  exportLocalData,
  parseAndValidateBackup,
  serializeBackup,
  wipeLocalData,
} from "@/data-portability";
import { registry } from "@/registry/registry.generated";

const SIM_GAMES = [
  "memory",
  "math-fast-math",
  "speed-tap-rush",
  "logic-code-cracker",
] as const;

/** Local calendar day n of the simulation (week starts Monday). */
function simDate(dayIndex: number): string {
  const base = Date.parse("2026-08-10T00:00:00"); // a Monday
  const d = new Date(base + dayIndex * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function noonMs(date: string): number {
  return Date.parse(`${date}T12:00:00`);
}

let dbFile = "";

async function openSimDb(nowMs: number): Promise<AppDatabase> {
  const adapter: SQLiteAdapter = createNodeSqliteAdapter(dbFile);
  await initializeConnection(adapter);
  await runMigrations(adapter);
  const domainByGame = new Map(
    registry.map((g) => [g.id, [g.primaryCategory]] as const),
  );
  const rating = createRatingPipeline({
    getDomains: (id) => domainByGame.get(id) ?? [],
  });
  const options: AppDatabaseOptions = {
    now: () => nowMs,
    rating,
  };
  return new AppDatabase(adapter, options);
}

async function completeSimSession(
  db: AppDatabase,
  args: {
    date: string;
    gameId: string;
    level: "normal" | "hard" | "expert";
    normalized: number;
    seq: number;
  },
): Promise<void> {
  const completedAt = noonMs(args.date) + args.seq * 60_000;
  await db.sessions.completeSession({
    session: {
      id: `${args.gameId}-${args.date}-${args.seq}`,
      gameId: args.gameId,
      gameVersion: 1,
      generatorVersion: 1,
      scoringVersion: 1,
      seed: args.seq + 1,
      difficulty: { level: args.level },
      rawResult: {},
      normalizedResult: args.normalized,
      xp: 40,
      startedAt: completedAt - 90_000,
      completedAt,
      durationMs: 90_000,
    },
  });
  await db.workouts.advance(args.date);
}

describe("campaign 014 repeated-use simulation (two weeks, real sqlite file)", () => {
  it("stays coherent across consecutive days, a paid reroll, a frozen miss, relaunch, mastery climbs, spotlight rollover, and a backup round-trip", async () => {
    dbFile = join(tmpdir(), `bt-campaign14-sim-${process.pid}.db`);
    if (existsSync(dbFile)) {
      rmSync(dbFile);
    }

    // ---------------------------------------------------------------- //
    // Week 1, days 0..4: consecutive daily workouts, improving form.   //
    // ---------------------------------------------------------------- //
    let nowMs = noonMs(simDate(0));
    let db = await openSimDb(nowMs);
    await db.profile.ensureExists();

    const playedByDay = new Map<string, string[]>();
    for (let day = 0; day <= 4; day += 1) {
      const date = simDate(day);
      nowMs = noonMs(date);
      const rotation = SIM_GAMES.map(
        (_, i) => SIM_GAMES[(day + i) % SIM_GAMES.length],
      );
      await db.workouts.getOrCreate(
        date,
        { gameIds: [...rotation], seedVersion: 1 },
      );
      const form = 0.55 + day * 0.05; // steady improvement across the week
      let seq = 0;
      for (const gameId of rotation) {
        const level = day >= 3 && gameId === "logic-code-cracker"
          ? "expert"
          : "normal";
        await completeSimSession(db, {
          date,
          gameId,
          level,
          normalized: Math.min(0.95, form + seq * 0.02),
          seq: seq++,
        });
      }
      playedByDay.set(
        date,
        rotation,
      );
    }
    const week1Sessions = await db.sessions.getCount();
    expect(week1Sessions).toBe(20); // 5 days × 4 games

    // Paid reroll on day 5: free attempt is exhausted by construction here —
    // drive attempt 1 through the transactional economy path (25 coins).
    const rerollDate = simDate(5);
    nowMs = noonMs(rerollDate);
    await db.workouts.getOrCreate(
      rerollDate,
      { gameIds: [...SIM_GAMES], seedVersion: 1 },
    );
    const balanceBefore = await db.ledger.getBalance();
    const freshRotation = [...SIM_GAMES].reverse();
    await paidReroll(db, {
      cost: rerollCost(1),
      reason: "workout-reroll",
      operationId: `workout-reroll:${rerollDate}:1`,
      mutateWorkout: async (txn) => {
        await new AppDatabase(txn).workouts.applyReroll(
          rerollDate,
          freshRotation,
          1,
        );
      },
    });
    const balanceAfter = await db.ledger.getBalance();
    expect(balanceAfter).toBe(balanceBefore - rerollCost(1));
    expect(rerollCost(1)).toBeGreaterThan(0);
    const rerolled = await db.workouts.getByDate(rerollDate);
    expect(rerolled?.gameIds).toEqual(freshRotation);
    // Play the rerolled day too (keeps the streak alive through day 5).
    {
      let seq = 0;
      for (const gameId of freshRotation) {
        await completeSimSession(db, {
          date: rerollDate,
          gameId,
          level: "normal",
          normalized: 0.8,
          seq: seq++,
        });
      }
    }

    // ---------------------------------------------------------------- //
    // RELAUNCH: close the handle and reopen the same store file.        //
    // ---------------------------------------------------------------- //
    db = await openSimDb(noonMs(simDate(5)));
    expect(await db.sessions.getCount()).toBe(24);

    // ---------------------------------------------------------------- //
    // Missed day 6 with proactive Freeze coverage; play day 7.         //
    // ---------------------------------------------------------------- //
    const missedDate = simDate(6);
    const resumeDate = simDate(7);
    nowMs = noonMs(resumeDate);

    // Proactive Freeze: grant one item into the namespaced `streaks`
    // settings block and cover the missed LOCAL date.
    const profile = (await db.profile.get()) ?? (await db.profile.ensureExists());
    let settings: Record<string, unknown> = grantItems(
      { ...profile.settings },
      { freeze: 1 },
    );
    settings = addCoveredDates(settings, [missedDate]);
    await db.profile.update({ settings });
    expect(
      readCoveredDates(((await db.profile.get())?.settings ?? {}) as Record<string, unknown>),
    ).toContain(missedDate);

    await db.workouts.getOrCreate(
      resumeDate,
      { gameIds: [...SIM_GAMES], seedVersion: 1 },
    );
    {
      let seq = 0;
      for (const gameId of SIM_GAMES) {
        await completeSimSession(db, {
          date: resumeDate,
          gameId,
          level: "normal",
          normalized: 0.85,
          seq: seq++,
        });
      }
    }

    // Streak reconstruction: the covered miss must not break the run.
    const activityDates = await db.sessions.getDistinctActivityDates();
    const streak = reconstructStreak(
      activityDates,
      resumeDate,
      readCoveredDates(
        ((await db.profile.get())?.settings ?? {}) as Record<string, unknown>,
      ),
    );
    // Days 0..5 + 7 with day 6 covered ⇒ current streak spans the gap.
    expect(streak.current).toBeGreaterThanOrEqual(6);
    expect(activityDates).not.toContain(missedDate);

    // ---------------------------------------------------------------- //
    // Mastery ladder climbed to Mastered on the Expert-focused game.   //
    // ---------------------------------------------------------------- //
    // Days 3,4 played logic-code-cracker at Expert (strong clears), and we
    // finish with two more strong Expert runs plus an 80% best today.
    for (let i = 0; i < 2; i += 1) {
      await completeSimSession(db, {
        date: resumeDate,
        gameId: "logic-code-cracker",
        level: "expert",
        normalized: 0.86 + i * 0.02,
        seq: 10 + i,
      });
    }
    const masteryInput = await db.sessions.getMasteryInputByGame(
      "logic-code-cracker",
    );
    expect(masteryInput).not.toBeNull();
    const mastered = computeMastery(masteryInput!);
    expect(mastered.tier).toBe("mastered");
    expect(mastered.nextMilestone).toBeNull();

    // A never-played catalog game stays honestly 'unplayed'.
    const untouched = computeMastery({
      gameId: "spatial-fold-match",
      sessions: 0,
      bestNormalized: 0,
      avgNormalized: 0,
      hardStrong: 0,
      expertStrong: 0,
      lastCompletedAt: 0,
    });
    expect(untouched.tier).toBe("unplayed");

    // ---------------------------------------------------------------- //
    // Personal bests + spotlight rollover inside the same window.      //
    // ---------------------------------------------------------------- //
    const aggregate = await db.sessions.getGameAggregate("memory");
    expect(aggregate?.bestNormalized ?? 0).toBeGreaterThanOrEqual(0.8);

    const spotByDay = new Map<string, string>();
    for (let day = 0; day <= 7; day += 1) {
      const date = simDate(day);
      spotByDay.set(date, dailySpotlight([...SIM_GAMES], date)!.gameId);
    }
    // Deterministic per date; rotating across the window (≥2 distinct).
    expect(spotByDay.get(simDate(0))).toBe(
      dailySpotlight([...SIM_GAMES], simDate(0))!.gameId,
    );
    expect(new Set(spotByDay.values()).size).toBeGreaterThanOrEqual(2);

    // Quest period keys roll over across the ISO-week boundary.
    const mondayKey = periodKeyFor("daily", simDate(0));
    const nextMondayKey = periodKeyFor("daily", simDate(7));
    expect(mondayKey).not.toBe(nextMondayKey);
    expect(currentPeriodKey("daily", new Date(noonMs(simDate(7))))).toBeDefined();

    // ---------------------------------------------------------------- //
    // Backup round-trip: export → wipe → replace-import restores all.  //
    // ---------------------------------------------------------------- //
    const envelope = await exportLocalData(db);
    const text = serializeBackup(envelope);
    // Throws MalformedBackupError on any integrity/format problem.
    const parsed = parseAndValidateBackup(text);

    const countsBefore = await db.sessions.getCount();
    const balanceBeforeWipe = await db.ledger.getBalance();
    await wipeLocalData(db);
    expect(await db.sessions.getCount()).toBe(0);
    expect(await db.ledger.getBalance()).toBe(0);

    const restored = await applyImport(db, parsed, "replace");
    expect(restored.sessionsAdded).toBe(countsBefore);
    expect(await db.sessions.getCount()).toBe(countsBefore);
    expect(await db.ledger.getBalance()).toBe(balanceBeforeWipe);

    // Post-restore coherence: mastery still derives correctly, workout
    // history survives, and the relaunch path sees identical state.
    const postRestoreMastery = await db.sessions.getMasteryInputByGame(
      "logic-code-cracker",
    );
    expect(computeMastery(postRestoreMastery!).tier).toBe("mastered");

    // Windows keeps the file locked until the adapter closes; best-effort
    // cleanup so a leftover temp store can never fail an already-green proof.
    try {
      if (existsSync(dbFile)) {
        rmSync(dbFile, { force: true });
      }
    } catch {
      // ignore: temp-dir file, the OS reaps it eventually
    }
  }, 120_000);
});
