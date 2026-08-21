import { beforeEach, describe, expect, it } from "@jest/globals";
import type { SQLiteAdapter } from "../adapter";
import { LedgerRepository } from "../ledger";
import { ProfileRepository } from "../profile";
import { INITIAL_RATING, RatingRepository } from "../rating";
import { SessionRepository } from "../sessions";
import type { CompleteSessionInput, GameSessionRecord } from "../types";
import { createMigratedDb } from "./helpers";

const T0 = 1_700_000_000_000;

function makeSession(
  overrides: Partial<GameSessionRecord> = {},
): GameSessionRecord {
  return {
    id: "session-1",
    gameId: "game-memoria",
    gameVersion: 1000000,
    generatorVersion: 2,
    scoringVersion: 1000000,
    seed: 42,
    difficulty: { mode: "normal" },
    rawResult: { score: 120, accuracy: 0.87 },
    normalizedResult: 0.75,
    xp: 50,
    startedAt: T0,
    completedAt: T0 + 90_000,
    durationMs: 90_000,
    ...overrides,
  };
}

describe("completeSession", () => {
  it("commits session + ledger + profile touch atomically", async () => {
    const adapter = await createMigratedDb();
    let now = T0;
    const sessions = new SessionRepository(adapter, () => now);
    const profile = new ProfileRepository(adapter, () => now);
    const ledger = new LedgerRepository(adapter, () => now);
    await profile.ensureExists();

    const input: CompleteSessionInput = {
      session: makeSession(),
      currency: { amount: 25, reason: "session_reward" },
    };
    now = T0 + 90_000 + 5_000; // profile touch happens after completion
    const result = await sessions.completeSession(input);

    // Session row persisted with JSON round-trip intact.
    const stored = await sessions.getById("session-1");
    expect(stored).toEqual(input.session);
    expect(stored?.difficulty).toEqual({ mode: "normal" });
    expect(stored?.rawResult).toEqual({ score: 120, accuracy: 0.87 });

    // Ledger entry references the session and is timestamped with completion.
    expect(result.ledgerEntry).toEqual({
      id: 1,
      amount: 25,
      reason: "session_reward",
      sessionId: "session-1",
      createdAt: T0 + 90_000,
    });
    expect(await ledger.list()).toHaveLength(1);
    expect(result.balance).toBe(25);
    expect(await ledger.getBalance()).toBe(25);

    // Profile touched with the injectable clock.
    expect((await profile.get())?.updatedAt).toBe(T0 + 95_000);
  });

  it("works without a currency entry (session + profile touch only)", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0);
    const ledger = new LedgerRepository(adapter);
    const profile = new ProfileRepository(adapter, () => T0);

    const result = await sessions.completeSession({ session: makeSession() });

    expect(result.ledgerEntry).toBeNull();
    expect(result.balance).toBe(0);
    expect(await ledger.list()).toHaveLength(0);
    // Profile row was created by the touch even though it never existed.
    expect((await profile.get())?.updatedAt).toBe(T0);
  });

  it("rolls back everything when the transaction fails mid-way", async () => {
    const adapter = await createMigratedDb();
    let now = T0;
    const sessions = new SessionRepository(adapter, () => now);
    const ledger = new LedgerRepository(adapter, () => now);
    const profile = new ProfileRepository(adapter, () => now);
    await profile.ensureExists();
    const updatedAtBefore = (await profile.get())?.updatedAt;

    const invalid = makeSession({ completedAt: T0 - 1 }); // violates CHECK
    await expect(
      sessions.completeSession({
        session: invalid,
        currency: { amount: 100, reason: "should never persist" },
      }),
    ).rejects.toThrow(/completedAt/);

    // No partial session, no ledger entry, balance untouched, profile untouched.
    expect(await sessions.getById("session-1")).toBeNull();
    expect(await ledger.list()).toHaveLength(0);
    expect(await ledger.getBalance()).toBe(0);
    expect((await profile.get())?.updatedAt).toBe(updatedAtBefore);

    // The database is still fully usable afterwards.
    const ok = await sessions.completeSession({
      session: makeSession({ id: "session-2" }),
      currency: { amount: 10, reason: "session_reward" },
    });
    expect(ok.balance).toBe(10);
    expect(await sessions.getById("session-2")).not.toBeNull();
  });

  it("rolls back a partially-written transaction on a mid-transaction failure", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0);
    const ledger = new LedgerRepository(adapter, () => T0);
    const profile = new ProfileRepository(adapter, () => T0);
    await profile.ensureExists();
    const updatedAtBefore = (await profile.get())?.updatedAt;

    // Inject a failure AFTER the session INSERT succeeds: any ledger INSERT
    // aborts, forcing a mid-transaction error like a crash would.
    await adapter.exec(
      "CREATE TRIGGER trg_test_block_ledger BEFORE INSERT ON currency_ledger " +
        "BEGIN SELECT RAISE(ABORT, 'test block'); END",
    );

    await expect(
      sessions.completeSession({
        session: makeSession(),
        currency: { amount: 25, reason: "session_reward" },
      }),
    ).rejects.toThrow(/test block/);

    // The session row written earlier in the same transaction is gone too.
    expect(await sessions.getById("session-1")).toBeNull();
    expect(await ledger.list()).toHaveLength(0);
    expect(await ledger.getBalance()).toBe(0);
    expect((await profile.get())?.updatedAt).toBe(updatedAtBefore);
  });

  it("is idempotent for duplicate session ids: returns the original row, awards nothing extra", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter);
    const first = await sessions.completeSession({ session: makeSession() });
    const balanceAfterFirst = first.balance;
    const ledgerCountAfterFirst = (
      await adapter.all("SELECT * FROM currency_ledger")
    ).length;

    // A retried/replayed completion of the same session id must NOT throw,
    // must NOT re-award currency or ratings, and must return the stored row.
    const second = await sessions.completeSession({
      session: makeSession(),
      currency: { amount: 5, reason: "dup" },
    });
    expect(second.session.id).toBe("session-1");
    expect(second.session.xp).toBe(50); // original, not overwritten
    expect(second.completionOutcome).toBeNull(); // nothing freshly applied
    expect(second.balance).toBe(balanceAfterFirst);
    expect(second.ledgerEntry).toBeNull(); // replay grants nothing extra

    const stored = await sessions.getById("session-1");
    expect(stored?.xp).toBe(50); // original, not overwritten
    // No extra ledger entry and no extra session row from the replay.
    expect(await adapter.all("SELECT * FROM currency_ledger")).toHaveLength(
      ledgerCountAfterFirst,
    );
    expect(await adapter.all("SELECT * FROM game_sessions")).toHaveLength(1);
    expect(await adapter.all("SELECT * FROM rating_history")).toHaveLength(0);
  });

  it("is idempotent when the first completion granted currency: a replay grants nothing extra", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter);
    const first = await sessions.completeSession({
      session: makeSession(),
      currency: { amount: 25, reason: "first" },
    });
    expect(first.ledgerEntry?.amount).toBe(25);
    expect(first.balance).toBe(25);

    // A crash/retry that replays the SAME session id must not double-award
    // currency or create a second row (economy correctness, §A).
    const second = await sessions.completeSession({
      session: makeSession(),
      currency: { amount: 5, reason: "dup" },
    });
    expect(second.ledgerEntry).toBeNull();
    expect(second.balance).toBe(25); // unchanged
    expect(second.session.xp).toBe(50); // original row reflected
    expect((await adapter.all("SELECT * FROM currency_ledger"))).toHaveLength(1); // only the first
  });

  it("is idempotent for a replayed session even without a currency entry", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter);
    await sessions.completeSession({ session: makeSession() });
    const replay = await sessions.completeSession({ session: makeSession() });
    expect(replay.ledgerEntry).toBeNull();
    expect(replay.session.id).toBe("session-1");
    expect(await sessions.getById("session-1")).not.toBeNull();
  });

  it("stamps the gameplay currency award with a stable operation_id for idempotent import", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter);
    await sessions.completeSession({
      session: makeSession(),
      currency: { amount: 5, reason: "session_reward" },
    });
    const row = await adapter.get<{ operation_id: string | null }>(
      "SELECT operation_id FROM currency_ledger WHERE session_id = ?",
      ["session-1"],
    );
    expect(row?.operation_id).toBe("gameplay:session-1");
  });
});

describe("completeSession with rating service", () => {
  const ratingService = {
    async compute() {
      return {
        xp: 77,
        currency: 15,
        deltas: [
          { domain: "Memory", delta: 6 },
          { domain: "Attention", delta: 3 },
        ],
      };
    },
  };

  it("applies the outcome atomically: xp override, currency award, rating history", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0, ratingService);
    const ratings = new RatingRepository(adapter, () => T0);
    const ledger = new LedgerRepository(adapter, () => T0);

    const result = await sessions.completeSession({ session: makeSession() });

    // XP is the rating service's authoritative value, not the game-reported 50.
    expect(result.session.xp).toBe(77);
    expect(result.rating).toEqual({
      xp: 77,
      currency: 15,
      deltas: [
        { domain: "Memory", delta: 6 },
        { domain: "Attention", delta: 3 },
      ],
      balance: 15,
    });
    expect((await sessions.getById("session-1"))?.xp).toBe(77);

    // Currency award appended with the session's completion timestamp.
    expect(result.ledgerEntry).toEqual({
      id: 1,
      amount: 15,
      reason: "gameplay",
      sessionId: "session-1",
      createdAt: T0 + 90_000,
    });
    expect(await ledger.getBalance()).toBe(15);

    // Domain ratings moved and history recorded per delta.
    expect(await ratings.getRating("Memory")).toMatchObject({
      domain: "Memory",
      rating: INITIAL_RATING + 6,
      sessions: 1,
    });
    expect(await ratings.getRating("Attention")).toMatchObject({
      domain: "Attention",
      rating: INITIAL_RATING + 3,
      sessions: 1,
    });
    const history = await ratings.getHistory();
    expect(history.map((h) => ({ domain: h.domain, delta: h.delta }))).toEqual([
      { domain: "Attention", delta: 3 },
      { domain: "Memory", delta: 6 },
    ]);

    // completionOutcome contains the authoritative result for UI rendering.
    expect(result.completionOutcome).toEqual({
      session: result.session,
      xp: 77,
      currency: 15,
      deltas: [
        { domain: "Memory", delta: 6, ratingAfter: INITIAL_RATING + 6 },
        { domain: "Attention", delta: 3, ratingAfter: INITIAL_RATING + 3 },
      ],
      balance: 15,
    });
  });

  it("ignores ambiguous caller currency when a rating service awards currency (task 7.6)", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0, ratingService);
    const ledger = new LedgerRepository(adapter, () => T0);

    const result = await sessions.completeSession({
      session: makeSession(),
      currency: { amount: 5, reason: "quest" },
    });

    // Ownership is unambiguous: with a rating service present it owns the
    // gameplay currency award and the caller-supplied entry is ignored, so the
    // same completion event is never double-awarded.
    const entries = await ledger.list();
    expect(
      entries.map((e) => ({ amount: e.amount, reason: e.reason })),
    ).toEqual([{ amount: 15, reason: "gameplay" }]);
    expect(await ledger.getBalance()).toBe(15);
    expect(result.ledgerEntry).toMatchObject({
      amount: 15,
      reason: "gameplay",
    });
  });

  it("rolls back everything when the rating service throws", async () => {
    const adapter = await createMigratedDb();
    const failing = {
      async compute() {
        throw new Error("rating boom");
      },
    };
    const sessions = new SessionRepository(adapter, () => T0, failing);
    const ledger = new LedgerRepository(adapter, () => T0);
    const ratings = new RatingRepository(adapter, () => T0);

    await expect(
      sessions.completeSession({ session: makeSession() }),
    ).rejects.toThrow("rating boom");

    expect(await sessions.getById("session-1")).toBeNull();
    expect(await ledger.getBalance()).toBe(0);
    expect(await adapter.all("SELECT * FROM rating_history")).toHaveLength(0);
    expect(await adapter.all("SELECT * FROM domain_ratings")).toHaveLength(0);
    expect(await ratings.getHistory()).toHaveLength(0);
  });

  it("reports rating null and keeps the game xp without a rating service", async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0);

    const result = await sessions.completeSession({ session: makeSession() });
    expect(result.rating).toBeNull();
    expect(result.session.xp).toBe(50);
    expect(await adapter.all("SELECT * FROM rating_history")).toHaveLength(0);
  });
});

describe("session queries", () => {
  let adapter: SQLiteAdapter;
  let sessions: SessionRepository;

  beforeEach(async () => {
    adapter = await createMigratedDb();
    sessions = new SessionRepository(adapter);
  });

  it("getTotalXp sums all completed sessions", async () => {
    expect(await sessions.getTotalXp()).toBe(0);
    await sessions.completeSession({
      session: makeSession({ id: "a", xp: 50 }),
    });
    await sessions.completeSession({
      session: makeSession({ id: "b", xp: 80 }),
    });
    await sessions.completeSession({
      session: makeSession({ id: "c", xp: 30 }),
    });
    expect(await sessions.getTotalXp()).toBe(160);
  });

  it("listByGame returns newest-first sessions for one game only", async () => {
    await sessions.completeSession({
      session: makeSession({ id: "a", gameId: "g1", completedAt: T0 + 1_000 }),
    });
    await sessions.completeSession({
      session: makeSession({ id: "b", gameId: "g1", completedAt: T0 + 2_000 }),
    });
    await sessions.completeSession({
      session: makeSession({ id: "c", gameId: "g2", completedAt: T0 + 3_000 }),
    });

    const g1 = await sessions.listByGame("g1");
    expect(g1.map((s) => s.id)).toEqual(["b", "a"]);
    const g2 = await sessions.listByGame("g2");
    expect(g2.map((s) => s.id)).toEqual(["c"]);
  });

  it("listRecent returns newest-first sessions across games", async () => {
    await sessions.completeSession({
      session: makeSession({ id: "a", gameId: "g1", completedAt: T0 + 1_000 }),
    });
    await sessions.completeSession({
      session: makeSession({ id: "b", gameId: "g1", completedAt: T0 + 2_000 }),
    });
    await sessions.completeSession({
      session: makeSession({ id: "c", gameId: "g2", completedAt: T0 + 3_000 }),
    });

    expect((await sessions.listRecent()).map((s) => s.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect((await sessions.listRecent(2)).map((s) => s.id)).toEqual(["c", "b"]);
  });

  it("getAggregates summarizes per-game analytics", async () => {
    await sessions.completeSession({
      session: makeSession({
        id: "a",
        gameId: "g1",
        normalizedResult: 0.5,
        completedAt: T0 + 1_000,
      }),
    });
    await sessions.completeSession({
      session: makeSession({
        id: "b",
        gameId: "g1",
        normalizedResult: 0.8,
        completedAt: T0 + 2_000,
      }),
    });
    await sessions.completeSession({
      session: makeSession({
        id: "c",
        gameId: "g2",
        normalizedResult: 0.9,
        completedAt: T0 + 3_000,
      }),
    });

    const aggregates = await sessions.getAggregates();
    expect(aggregates).toHaveLength(2);
    expect(aggregates[0]).toEqual({
      gameId: "g2",
      count: 1,
      avgNormalized: 0.9,
      bestNormalized: 0.9,
      lastCompletedAt: T0 + 3_000,
    });
    expect(aggregates[1]).toEqual({
      gameId: "g1",
      count: 2,
      avgNormalized: 0.65,
      bestNormalized: 0.8,
      lastCompletedAt: T0 + 2_000,
    });

    expect(await sessions.getGameAggregate("g1")).toEqual(aggregates[1]);
    expect(await sessions.getGameAggregate("never-played")).toBeNull();
  });
});

describe("ledger queries", () => {
  it("balance matches the sum of all entries, including debits", async () => {
    const adapter = await createMigratedDb();
    const ledger = new LedgerRepository(adapter, () => T0);
    await ledger.append({ amount: 10, reason: "reward" });
    await ledger.append({ amount: -3, reason: "reroll" });
    await ledger.append({ amount: 5, reason: "quest" });

    expect(await ledger.getBalance()).toBe(12);
    const entries = await ledger.list();
    expect(entries.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(entries[1].amount).toBe(-3);
  });
});
