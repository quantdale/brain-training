/**
 * Rollback proofs + durability guarantees (campaign 011, W12).
 *
 * Stronger than the projection-length checks in `apply.test.ts`: a restore
 * that fails MIDWAY (after several sections were already written) must leave
 * the database BYTE-IDENTICAL to its pre-import state — every user table,
 * the autoincrement sequence state, and the trigger DDL — not merely
 * "same session count". This pins the transaction-abort contract against any
 * future code that sneaks a non-transactional or second-connection write into
 * the import path.
 *
 * Also pins cross-backup ledger replay: re-restoring a backup whose
 * `operation_id`s already exist (older/newer export of the same history) must
 * never double-apply economy events.
 */
import { describe, expect, it } from '@jest/globals';
import type { SQLiteAdapter, SQLiteRunResult, SQLiteValue } from '@/db';
import { AppDatabase } from '@/db';
import { createMigratedDb } from '../../db/__tests__/helpers';
import {
  applyImport,
  exportLocalData,
  parseAndValidateBackup,
  serializeBackup,
  wipeLocalData,
} from '../index';
import { canonicalString } from '../canonical-json';
import { buildEnvelope , emptyData , makeDb, seedFixture, T0 } from './helpers';

/**
 * Fault-injecting adapter: throws once counted write calls exceed a budget.
 * Each transaction gets a FRESH counter (mirrors apply.test.ts), so the
 * budget expresses "fail after N writes inside the import transaction" —
 * a genuine mid-import failure, not a pre-flight one.
 *
 * `countExec` extends counting to `exec` statements: `wipeLocalData` clears
 * tables via `txn.exec("DELETE ...")`, so its midway failures must be aimed
 * at the clear itself.
 */
class FaultInjectingAdapter implements SQLiteAdapter {
  private mutations = 0;
  private fired = false;
  constructor(
    private readonly inner: SQLiteAdapter,
    private readonly maxMutations: number,
    private readonly countExec = false,
  ) {}
  private gate(): void {
    // ONE-SHOT fault: once fired, later calls (notably the trigger
    // recreation inside `finally`) pass through — otherwise the injected
    // error would destroy the very recovery mechanism under test.
    if (this.fired) {
      return;
    }
    this.mutations += 1;
    if (this.mutations > this.maxMutations) {
      this.fired = true;
      throw new Error(`injected fault: exceeded ${this.maxMutations} mutations`);
    }
  }
  exec(sql: string): Promise<void> {
    if (this.countExec) {
      this.gate();
    }
    return this.inner.exec(sql);
  }
  run(sql: string, params: SQLiteValue[] = []): Promise<SQLiteRunResult> {
    this.gate();
    return this.inner.run(sql, params);
  }
  get<T>(sql: string, params?: SQLiteValue[]): Promise<T | null> {
    return this.inner.get<T>(sql, params);
  }
  all<T>(sql: string, params?: SQLiteValue[]): Promise<T[]> {
    return this.inner.all<T>(sql, params);
  }
  transaction<T>(fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T> {
    return this.inner.transaction(
      (realTxn) => fn(new FaultInjectingAdapter(realTxn, this.maxMutations, this.countExec)),
    );
  }
  close(): Promise<void> {
    return this.inner.close();
  }
}

/** Everything user-visible in the physical DB, captured canonically. */
interface DbDump {
  /** table name -> full rows ordered by rowid (insertion order). */
  tables: Record<string, unknown[]>;
  /** sqlite_sequence rows (autoincrement counters), if the schema uses any. */
  sequence: { name: string; seq: number }[];
  /** trigger DDL — proves append-only guards survive a failed replace. */
  triggers: { name: string; sql: string | null }[];
}

async function dumpDb(db: AppDatabase): Promise<DbDump> {
  return db.transaction(async (txn) => {
    const tableNames = (
      await txn.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
    ).map((r) => r.name);

    const tables: Record<string, unknown[]> = {};
    for (const name of tableNames) {
      tables[name] = await txn.all<unknown[]>(`SELECT * FROM "${name}" ORDER BY rowid`);
    }

    const seqTable = await txn.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'",
    );
    const sequence =
      seqTable && seqTable.n > 0
        ? await txn.all<{ name: string; seq: number }>(
            'SELECT name, seq FROM sqlite_sequence ORDER BY name',
          )
        : [];

    const triggers = await txn.all<{ name: string; sql: string | null }>(
      'SELECT name, sql FROM sqlite_master WHERE type = ? ORDER BY name',
      ['trigger'],
    );

    return { tables, sequence, triggers };
  });
}

function dumpText(dump: DbDump): string {
  return canonicalString(dump);
}

/**
 * Budget 8 lands the injected failure around the currency-ledger writes for
 * the standard fixture (profile+favorites+ratings+2 sessions precede it), so
 * several sections are genuinely WRITTEN before the abort — a real midway
 * failure, not a pre-flight one.
 */
const MID_IMPORT_BUDGET = 8;

describe('midway-failure restore leaves the database byte-identical', () => {
  it('replace mode: abort after partial writes restores the exact prior bytes', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const text = serializeBackup(await exportLocalData(src, { now: () => T0 + 1 }));

    const real = await createMigratedDb();
    const target = new AppDatabase(real);
    await target.profile.ensureExists();
    await seedFixture(target);

    const before = dumpText(await dumpDb(target));
    expect(before.length).toBeGreaterThan(0); // the dump itself is non-trivial

    const faulty = new AppDatabase(new FaultInjectingAdapter(real, MID_IMPORT_BUDGET));
    await expect(applyImport(faulty, parseAndValidateBackup(text), 'replace')).rejects.toThrow(
      /injected fault/,
    );

    const after = dumpText(await dumpDb(target));
    expect(after).toBe(before); // BYTE-identical: every table, sequence, trigger DDL

    // Belt-and-braces on top of the dump: append-only guards really active.
    await expect(
      target.transaction(async (txn) => txn.exec('DELETE FROM currency_ledger')),
    ).rejects.toThrow(/append-only/);
  });

  it('merge mode: abort after partial writes leaves every table untouched', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const text = serializeBackup(await exportLocalData(src, { now: () => T0 + 1 }));

    const real = await createMigratedDb();
    const target = new AppDatabase(real);
    await target.profile.ensureExists(); // empty-but-initialized target

    const before = dumpText(await dumpDb(target));

    const faulty = new AppDatabase(new FaultInjectingAdapter(real, MID_IMPORT_BUDGET));
    await expect(applyImport(faulty, parseAndValidateBackup(text), 'merge')).rejects.toThrow(
      /injected fault/,
    );

    expect(dumpText(await dumpDb(target))).toBe(before);
  });

  it('a wipe that fails midway — even mid-trigger-DDL — keeps data AND guards intact', async () => {
    // Budget 6 lands INSIDE dropTriggers (11 trigger DDL statements run before
    // any DELETE). Pre-fix, that skipped recreation entirely and permanently
    // stripped append-only guards; the byte-identical dump below proves both
    // data and trigger definitions survive ANY midway failure point.
    const real = await createMigratedDb();
    const db = new AppDatabase(real);
    await db.profile.ensureExists();
    await seedFixture(db);
    const before = dumpText(await dumpDb(db));

    const faulty = new AppDatabase(new FaultInjectingAdapter(real, 6, true));
    await expect(wipeLocalData(faulty)).rejects.toThrow(/injected fault/);

    expect(dumpText(await dumpDb(db))).toBe(before);
  });
});

describe('cross-backup ledger operationId replay never doubles the economy', () => {
  it('merging a different envelope with already-known operationIds adds nothing', async () => {
    const src = await makeDb();
    await seedFixture(src);
    const textA = serializeBackup(await exportLocalData(src, { now: () => T0 + 1 }));
    const parsedA = parseAndValidateBackup(textA);

    // A DIFFERENT backup carrying the SAME operation ids but mutated payloads
    // (an older/newer export of the same device history). Only the opId-bearing
    // entry is mutated so the null-opId entry keeps its natural key.
    const mutatedData = emptyData();
    Object.assign(mutatedData, parsedA.data, {
      currencyLedger: parsedA.data.currencyLedger.map((e) =>
        e.operationId ? { ...e, amount: e.amount * 100 } : e,
      ),
    });
    const textB = serializeBackup(buildEnvelope(mutatedData, { createdAt: T0 + 777 }));
    expect(textB).not.toBe(textA); // genuinely a different envelope
    const parsedB = parseAndValidateBackup(textB);

    const target = await makeDb();
    await applyImport(target, parsedA, 'merge');
    const replay = await applyImport(target, parsedB, 'merge');

    expect(replay.ledgerAdded).toBe(0);
    expect(await target.ledger.getBalance()).toBe(15); // exactly the original 10 + 5
    expect(await target.ledger.list(10000)).toHaveLength(2);
  });
});
