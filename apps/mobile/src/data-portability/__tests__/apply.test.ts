import { describe, expect, it } from "@jest/globals";
import type { SQLiteAdapter, SQLiteRunResult } from "@/db";
import type { SQLiteValue } from "@/db";
import { AppDatabase } from "@/db";
import { createMigratedDb } from "../../db/__tests__/helpers";
import { createNodeSqliteAdapter } from "../../db/adapters/node";
import { buildDatabaseFromBackup } from "../apply";
import {
  exportLocalData,
  serializeBackup,
  parseAndValidateBackup,
  applyImport,
} from "../index";
import { canonicalString } from "../canonical-json";
import { makeDb, seedFixture, T0 } from "./helpers";

/** Fault-injecting adapter: throws once write (`run`) calls exceed a budget. */
class FaultInjectingAdapter implements SQLiteAdapter {
  private mutations = 0;
  constructor(
    private readonly inner: SQLiteAdapter,
    private readonly maxMutations: number,
  ) {}
  exec(sql: string): Promise<void> {
    return this.inner.exec(sql);
  }
  run(sql: string, params: SQLiteValue[] = []): Promise<SQLiteRunResult> {
    this.mutations += 1;
    if (this.mutations > this.maxMutations) {
      throw new Error(
        `injected fault: exceeded ${this.maxMutations} mutations`,
      );
    }
    return this.inner.run(sql, params);
  }
  get<T>(sql: string, params: SQLiteValue[] = []): Promise<T | null> {
    return this.inner.get<T>(sql, params);
  }
  all<T>(sql: string, params: SQLiteValue[] = []): Promise<T[]> {
    return this.inner.all<T>(sql, params);
  }
  transaction<T>(fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T> {
    return this.inner.transaction((realTxn) =>
      fn(new FaultInjectingAdapter(realTxn, this.maxMutations)),
    );
  }
  close(): Promise<void> {
    return this.inner.close();
  }
}

async function exportParsed(src: AppDatabase) {
  const env = await exportLocalData(src, { now: () => T0 + 1 });
  return parseAndValidateBackup(serializeBackup(env));
}

describe("merge import", () => {
  it("is idempotent — re-importing the same backup adds nothing", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const parsed = await exportParsed(src);

    const target = await makeDb();
    const first = await applyImport(target, parsed, "merge");
    expect(first.sessionsAdded).toBe(2);
    expect(first.ledgerAdded).toBe(2);

    const second = await applyImport(target, parsed, "merge");
    expect(second.sessionsAdded).toBe(0);
    expect(second.sessionsSkipped).toBe(2);
    expect(second.ledgerAdded).toBe(0);
    expect(second.xpAwardsAdded).toBe(0);
    expect(second.ratingHistoryAdded).toBe(0);
  });

  it("keeps both completed sessions when merging a second backup", async () => {
    const src1 = await makeDb();
    await seedFixture(src1); // s1, s2
    const parsed1 = await exportParsed(src1);

    const target = await makeDb();
    await applyImport(target, parsed1, "merge");

    // A second device backup that adds a new session s3 (different id).
    const src2 = await makeDb();
    await seedFixture(src2);
    await src2.transaction(async (txn) => {
      await txn.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "s3",
          "attention",
          1,
          1,
          1,
          99,
          "{}",
          "{}",
          0.7,
          40,
          T0 + 10,
          T0 + 20,
          500,
        ],
      );
    });
    const parsed2 = await exportParsed(src2);

    const result = await applyImport(target, parsed2, "merge");
    expect(result.sessionsAdded).toBe(1); // only s3 is new
    expect(result.sessionsSkipped).toBe(2); // s1, s2 already present

    const after = await exportParsed(target);
    const ids = after.data.gameSessions.map((s) => s.id).sort();
    expect(ids).toEqual(["s1", "s2", "s3"]);
  });

  it("preserves target-only data not present in the backup", async () => {
    const target = await makeDb();
    await target.transaction(async (txn) => {
      await txn.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ["st", "logic", 1, 1, 1, 7, "{}", "{}", 0.5, 30, T0, T0 + 1, 400],
      );
    });

    const src = await makeDb();
    await seedFixture(src); // s1, s2
    const parsed = await exportParsed(src);
    await applyImport(target, parsed, "merge");

    const after = await exportParsed(target);
    const ids = after.data.gameSessions.map((s) => s.id).sort();
    expect(ids).toEqual(["s1", "s2", "st"]); // target session kept
  });

  it("takes the valid best rating on conflict (merge semantics)", async () => {
    const target = await makeDb();
    await target.transaction(async (txn) => {
      await txn.run(
        "INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)",
        ["Memory", 900, 1, T0],
      );
    });
    const src = await makeDb();
    await seedFixture(src); // Memory rating 1050
    const parsed = await exportParsed(src);
    await applyImport(target, parsed, "merge");
    const ratings = (await target.ratings.getRatings()).find(
      (r) => r.domain === "Memory",
    )!;
    expect(ratings.rating).toBe(1050); // max preserved
    expect(ratings.sessions).toBe(2);
  });
});

describe("replace import", () => {
  it("overwrites existing data with the backup", async () => {
    const target = await makeDb();
    await seedFixture(target); // has s1,s2 and profile 'Tester'

    const src = await makeDb();
    await src.transaction(async (txn) => {
      await txn.run(
        `INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ["replaced", "speed", 1, 1, 1, 5, "{}", "{}", 0.6, 35, T0, T0 + 1, 300],
      );
    });
    const parsed = await exportParsed(src);

    const result = await applyImport(target, parsed, "replace");
    expect(result.sessionsAdded).toBe(1);
    expect(result.sessionsSkipped).toBe(0);

    const after = await exportParsed(target);
    expect(after.data.gameSessions.map((s) => s.id)).toEqual(["replaced"]);
  });

  it("leaves append-only triggers ENABLED after a successful replace", async () => {
    const target = await makeDb();
    await seedFixture(target);
    const parsed = await exportParsed(target);
    await applyImport(target, parsed, "replace");

    // The trigger must still forbid DELETE on the ledger (proves re-enable).
    await expect(
      target.transaction(async (txn) =>
        txn.exec("DELETE FROM currency_ledger"),
      ),
    ).rejects.toThrow(/append-only/);
  });
});

describe("transactional safety / failure injection", () => {
  it("rolls back a merge on a mid-transaction fault (no partial state)", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const parsed = await exportParsed(src);

    const real = await createMigratedDb();
    await new AppDatabase(real).profile.ensureExists();
    await seedFixture(new AppDatabase(real)); // seed on clean connection
    const before = (await new AppDatabase(real).sessions.listRecent(1000))
      .length;
    expect(before).toBe(2);

    const faulty = new AppDatabase(new FaultInjectingAdapter(real, 0));
    await expect(applyImport(faulty, parsed, "merge")).rejects.toThrow(
      /injected fault/,
    );

    const after = (await new AppDatabase(real).sessions.listRecent(1000))
      .length;
    expect(after).toBe(2); // unchanged
  });

  it("rolls back a replace on a mid-transaction fault and restores triggers", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const parsed = await exportParsed(src);

    const real = await createMigratedDb();
    await new AppDatabase(real).profile.ensureExists();
    await seedFixture(new AppDatabase(real));
    const before = (await new AppDatabase(real).sessions.listRecent(1000))
      .length;
    expect(before).toBe(2);

    const faulty = new AppDatabase(new FaultInjectingAdapter(real, 0));
    await expect(applyImport(faulty, parsed, "replace")).rejects.toThrow(
      /injected fault/,
    );

    const after = (await new AppDatabase(real).sessions.listRecent(1000))
      .length;
    expect(after).toBe(2); // clear was rolled back

    // Triggers must be ON again on the shared connection.
    await expect(
      new AppDatabase(real).transaction(async (txn) =>
        txn.exec("DELETE FROM currency_ledger"),
      ),
    ).rejects.toThrow(/append-only/);
  });
});

describe("buildDatabaseFromBackup (file-swap path)", () => {
  it("produces a fully-populated migrated database from the backup", async () => {
    const src = await makeDb();
    await seedFixture(src);
    const parsed = await exportParsed(src);

    const built = await buildDatabaseFromBackup(parsed, () =>
      createNodeSqliteAdapter(":memory:"),
    );
    const rebuilt = new AppDatabase(built);
    const exported = canonicalString((await exportParsed(rebuilt)).data);
    const original = canonicalString(parsed.data);
    expect(exported).toBe(original);
    await built.close();
  });
});
