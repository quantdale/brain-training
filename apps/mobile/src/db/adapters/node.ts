import Database from 'better-sqlite3';
import type { SQLiteAdapter, SQLiteRunResult } from '../adapter';
import { REQUIRED_BUSY_TIMEOUT_MS, REQUIRED_JOURNAL_MODE, REQUIRED_SYNCHRONOUS } from '../schema';
import type { SQLiteValue } from '../types';
import {
  TransactionScopeRegistry,
  connectionKeyOf,
  reentrantTransactionError,
  runInTransactionScope,
} from '../transaction-scope';

/**
 * Node test backend: wraps the synchronous better-sqlite3 connection in the
 * async SQLiteAdapter interface. Only tests import this module — the app
 * bundle must never reach it (Metro only bundles the import graph).
 *
 * A BEHAVIOR MODEL, NOT A DEVICE EMULATOR (Change 068). See the note in
 * `adapters/expo.ts` for the full list of deltas. The consequence that matters
 * for this file: the driver has its own in-transaction state, so without an
 * explicit precondition a forgotten `txn` argument here SILENTLY joins the
 * outer transaction and is rolled back with it — the exact opposite failure
 * from the device, where the same mistake hangs the app forever, and a green
 * test suite either way. Raising the SAME error as the device backend is what
 * removes the divergence; leaving the engine's native `cannot start a
 * transaction within a transaction` as the only signal would preserve it.
 */
export function createNodeSqliteAdapter(filename = ':memory:'): SQLiteAdapter {
  const db = new Database(filename);
  // Keyed on the driver handle: one driver object is one connection, which is
  // exactly the scope in which SQLite refuses to nest a transaction.
  const scopes = new TransactionScopeRegistry();
  // SAFETY: `db` is an opaque driver object; the cast only re-types it as a
  // WeakMap key, and no property of it is read.
  const key = connectionKeyOf(db);

  // Apply the SAME connection invariants the device backend applies, at open
  // time, from the SAME shared constants (Change 068). The two backends
  // therefore converge by construction rather than by two lists that happen to
  // agree today — which is the only reason the device's `busy_timeout = 0` and
  // implicit journal mode were ever invisible to this test path.
  // `initializeConnection` still re-applies and ASSERTS them through the
  // adapter; doing both is deliberate, because a caller can construct the
  // adapter directly and never call the initializer.
  //
  // MEASURED 2026-09-30 (raw driver, never through this adapter):
  // `busy_timeout` was already 5000 ms and `foreign_keys` already 1 here, while
  // expo-sqlite opens with 0 ms and SQLite itself defaults foreign keys OFF. The
  // explicit settings are therefore load-bearing on the DEVICE and merely
  // redundant here — `__tests__/storage-parity.test.ts` pins those defaults so
  // this list can never be "simplified" back into an assumption.
  db.pragma('foreign_keys = ON');
  db.pragma(`busy_timeout = ${REQUIRED_BUSY_TIMEOUT_MS}`);
  // `NORMAL` (1) rather than SQLite's `FULL` default (2): WAL already makes
  // commits atomic and durable against process crash, and NORMAL only relaxes
  // durability against an OS/power failure — the right trade for a local,
  // single-device, offline-first product. The driver form is derived from the
  // SAME constant the SQL statement uses so the two cannot drift.
  db.pragma(`synchronous = ${REQUIRED_SYNCHRONOUS}`);
  // A `:memory:` database has no file, so it cannot hold a WAL: SQLite reports
  // `memory` and refuses the change. That is a limitation of the store, not a
  // violation of the app's invariant, so it is not attempted here.
  // `initializeConnection` asserts the effective value and accepts `memory` for
  // an in-memory database — detected from the engine's own
  // `PRAGMA database_list`, not from a guess about the constructor arguments.
  if (filename !== ':memory:') {
    db.pragma(`journal_mode = ${REQUIRED_JOURNAL_MODE.toUpperCase()}`);
  }

  // Unguarded executors. The ROOT adapter wraps each with the re-entrancy
  // precondition; the scope-local adapter receives these directly, so a
  // transaction body can read and write normally while root-adapter calls are
  // rejected. Keeping ONE implementation and two front ends is what stops the
  // backends from drifting into different behaviors again.
  const run = async (sql: string, params: SQLiteValue[] = []): Promise<SQLiteRunResult> => {
    const info = db.prepare(sql).run(...params);
    return {
      changes: info.changes,
      lastInsertRowId: Number(info.lastInsertRowid),
    };
  };

  const get = async <T>(sql: string, params: SQLiteValue[] = []): Promise<T | null> => {
    const row = db.prepare(sql).get(...params);
    return row === undefined ? null : (row as T);
  };

  const all = async <T>(sql: string, params: SQLiteValue[] = []): Promise<T[]> => {
    return db.prepare(sql).all(...params) as T[];
  };

  // The precondition, checked at the CALL SITE before anything touches the
  // driver. Root DML `run` is included for the same reason the device backend
  // includes it: a forgotten `txn` argument reaches the outer adapter through
  // it far more often than through `exec`, and on this backend that mistake
  // silently joins the outer transaction instead of hanging — so the guard is
  // what makes the two backends observably identical. Reads (`get`/`all`)
  // PARTICIPATE in the connection's current transaction rather than rejecting
  // (see their notes below), matching the device backend exactly.
  const rejectIfInTransaction = (entryPoint: 'exec' | 'run'): void => {
    if (scopes.isOpen(key)) {
      throw reentrantTransactionError(entryPoint);
    }
  };

  const adapter: SQLiteAdapter = {
    // Connection-level `exec` reached through the ROOT adapter while a
    // transaction is open: on this backend the statements would silently join
    // that transaction and be rolled back with it — the precise class of
    // defect the device backend now rejects outright. Threading `txn` keeps
    // the two backends observably identical. DML (`run`) is rejected for the
    // same reason: a write that quietly becomes part of someone else's
    // transaction and vanishes on its rollback is silent data loss.
    async exec(sql) {
      rejectIfInTransaction('exec');
      db.exec(sql);
    },

    async run(sql, params = []) {
      rejectIfInTransaction('run');
      return run(sql, params);
    },

    // Reads PARTICIPATE in the connection's current transaction rather than
    // rejecting: they have no side effects, a transaction body reading through
    // the root adapter sees exactly the view it wants (its own uncommitted
    // state), and an independent concurrent reader is advisory (every claim
    // path re-validates inside its own transaction). Rejecting reads instead
    // broke legitimate concurrent readers — a claim-all racing a single claim
    // lost every reward behind one refused read.
    async get<T>(sql: string, params: SQLiteValue[] = []) {
      return get<T>(sql, params);
    },

    async all<T>(sql: string, params: SQLiteValue[] = []) {
      return all<T>(sql, params);
    },

    // BEGIN IMMEDIATE takes the write lock up front so no other connection
    // can interleave while the (all-synchronous) body runs. The scope claim
    // happens before BEGIN, so a nested call is rejected by the shared guard
    // rather than by the driver's own `inTransaction` check — the device
    // backend has no such check to reach, so depending on it is the
    // divergence this change removes.
    async transaction(fn) {
      return runInTransactionScope(
        scopes,
        key,
        // The body receives the scope-local adapter. It is the same driver
        // handle with the scope check bypassed, which is what lets a body use
        // `txn.run(...)`/`txn.get(...)`/`txn.exec(...)` normally while the
        // root adapter keeps rejecting.
        scopeAdapter,
        async () => {
          db.exec('BEGIN IMMEDIATE');
        },
        fn,
        {
          commit: async () => {
            db.exec('COMMIT');
          },
          rollback: async () => {
            db.exec('ROLLBACK');
          },
        },
      );
    },

    async close() {
      db.close();
    },
  };

  const scopeAdapter: SQLiteAdapter = {
    ...adapter,
    // The body's adapter: the same driver handle with the precondition
    // bypassed for ordinary statements, which is what lets a body use
    // `txn.run(...)`/`txn.get(...)`/`txn.all(...)`/`txn.exec(...)` normally
    // while the ROOT adapter rejects each of them. `transaction` is NOT
    // overridden: a nested `txn.transaction(...)` must still be rejected, and
    // the spread keeps the guarded form.
    exec: async (sql: string) => {
      db.exec(sql);
    },
    run,
    get,
    all,
  };

  return adapter;
}
