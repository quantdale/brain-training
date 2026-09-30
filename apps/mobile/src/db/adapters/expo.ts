import * as SQLite from 'expo-sqlite';
import type { SQLiteAdapter } from '../adapter';
import { SQL } from '../schema';
import {
  TransactionScopeRegistry,
  connectionKeyOf,
  reentrantTransactionError,
  runInTransactionScope,
} from '../transaction-scope';

/**
 * expo-sqlite's async methods share native statement objects. Keeping several
 * calls in flight on one database can release a statement while another call
 * is still preparing it (`ERR_USING_RELEASED_SHARED_OBJECT`). The app starts
 * independent reads together on purpose, so the adapter is the narrow seam
 * where those calls are serialized without changing repository behavior.
 */
class AsyncOperationQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

const databaseQueues = new WeakMap<object, AsyncOperationQueue>();

/**
 * Per-native-handle open-transaction registry (Change 068).
 *
 * It sits beside the queue registry and keys on the SAME identity, so the
 * queue and the transaction scope can never be keyed differently for one
 * handle — a mismatch would make the guard blind to a transaction opened
 * through a different JS wrapper around the same native database.
 */
const transactionScopes = new TransactionScopeRegistry();

function nativeKey(db: SQLite.SQLiteDatabase) {
  // SAFETY: mirrors `queueForDatabase`'s key exactly. The value is an opaque
  // native object used only as a WeakMap key; no property of it is read.
  return connectionKeyOf((db.nativeDatabase ?? db) as unknown);
}

function queueForDatabase(db: SQLite.SQLiteDatabase): AsyncOperationQueue {
  // Expo can return a new JS SQLiteDatabase wrapper around the same cached
  // NativeDatabase (notably across fast-refresh/runtime remounts). Queueing by
  // the wrapper would let those calls race on one native handle again. The
  // native handle is the actual serialization boundary; the fallback keeps
  // this seam tolerant of the minimal test doubles used by Jest.
  // SAFETY: `nativeDatabase` and the wrapper are both opaque native-backed
  // objects; the cast only re-types an already-object value for the WeakMap
  // key, which stores no properties of it.
  const key = (db.nativeDatabase ?? db) as unknown as object;
  let queue = databaseQueues.get(key);
  if (!queue) {
    queue = new AsyncOperationQueue();
    databaseQueues.set(key, queue);
  }
  return queue;
}

/**
 * In-app backend: wraps an expo-sqlite `SQLiteDatabase` in the async
 * SQLiteAdapter interface. Same SQL, same repositories as the Node test
 * backend. This module imports the expo-sqlite native module, so it must
 * never be imported by Node-side tests (jest-expo does not mock the core
 * `openDatabaseSync`/query surface) — tests run against `adapters/node.ts`.
 *
 * WHY THE NODE BACKEND IS NOT AN EMULATOR OF THIS ONE (Change 068)
 * ----------------------------------------------------------------
 * `adapters/node.ts` is a **behavior model** of this adapter, not a device
 * emulator. It shares the SQL, the schema, the repositories, and now the
 * re-entrancy contract, but it runs on a different engine
 * (`better-sqlite3` / SQLite 3.53.x vs `expo-sqlite` / SQLite 3.50.x) behind a
 * different driver. Known deltas, pinned as executable facts by
 * `__tests__/storage-parity.test.ts` so they are reported rather than assumed:
 *
 * - `SQLITE_DBCONFIG_DEFENSIVE` is ON in `better-sqlite3`, OFF under
 *   `expo-sqlite`.
 * - The driver-level `busy_timeout` default differs (5000 ms measured vs 0 ms
 *   under `expo-sqlite`), and `better-sqlite3` additionally turns foreign keys
 *   ON by default while SQLite itself defaults them OFF. The app now sets and
 *   asserts all three on both backends, which is what makes the *effective*
 *   values comparable rather than accidentally different.
 * - `journal_mode` defaulted to the rollback journal on BOTH backends, so WAL
 *   is a new decision rather than a convergence, and it is a persistent
 *   file-format property (see the `schema.ts` note for the sidecar
 *   consequences).
 * - `withExclusiveTransactionAsync` is deliberately not used (see the 065 note
 *   below), so the device runs BEGIN/COMMIT on the MAIN connection. A future
 *   change that reintroduces a second native connection silently re-opens the
 *   foreign-key window that change closed.
 * - Only this backend is reachable from Jest, so a device-only persistence
 *   defect is structurally undetectable by the matrix and needs the device
 *   lane. The parity suite keeps the *facts* honest; it does not make the two
 *   runtimes equivalent.
 */
export function createExpoSqliteAdapter(
  db: SQLite.SQLiteDatabase,
  queue: AsyncOperationQueue = queueForDatabase(db),
  options: { scopeLocal?: boolean } = {},
): SQLiteAdapter {
  // The scope-local adapter is the one handed to a transaction body. It is a
  // different object with a private queue, so it may legitimately issue
  // connection-level statements while the connection's transaction scope is
  // open — that is exactly what the FK re-assertion before BEGIN and the DDL
  // inside migration bodies rely on. The root adapter must NOT have that
  // exemption, which is the entire point of the guard.
  const isScopeLocal = options.scopeLocal === true;
  return {
    // `exec` is a CONNECTION-level entry point (DDL, `PRAGMA`, and the
    // import/export truncation paths all use it) and is reachable from inside
    // a transaction body. A connection-level statement issued through the
    // OUTER adapter while a transaction holds the queue slot would block
    // forever, exactly like a nested `transaction()` does, so it is rejected
    // by the same guard. The scope-local adapter is a different object, so DDL
    // inside a body keeps working.
    // Reject BEFORE enqueueing. Enqueueing first would be the original defect:
    // the nested call would sit behind the very queue slot its own transaction
    // is holding and never settle.
    async exec(sql) {
      if (!isScopeLocal && transactionScopes.isOpen(nativeKey(db))) {
        throw reentrantTransactionError('exec');
      }
      await queue.enqueue(() => db.execAsync(sql));
    },

    async run(sql, params = []) {
      const result = await queue.enqueue(() => db.runAsync(sql, ...params));
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },

    async get(sql, params = []) {
      return queue.enqueue(() => db.getFirstAsync(sql, ...params));
    },

    async all(sql, params = []) {
      return queue.enqueue(() => db.getAllAsync(sql, ...params));
    },

    // 065 — FK enforcement inside transactions. SQLite enforces foreign keys
    // per connection, defaults them OFF, and IGNORES `PRAGMA foreign_keys`
    // while a transaction is pending. expo-sqlite's
    // `withExclusiveTransactionAsync` runs the callback on a NEW native
    // connection (`Transaction.createAsync` opens with `useNewConnection:
    // true`) that never received the main connection's pragma, so every
    // transactional write ran with FK checks off on device — invisible to the
    // Node backend, which keeps one connection with the pragma set. The
    // transaction therefore runs on the main connection (where
    // `initializeConnection` applied the pragma) and re-asserts it through the
    // transaction adapter BEFORE `BEGIN`, the only window SQLite honors it.
    // Exclusivity is unchanged: the outer queue is held for the complete
    // transaction and every statement inside routes to this same connection.
    //
    // 068 — re-entrancy is now a hard, typed failure on BOTH backends, checked
    // at the call site BEFORE enqueueing. That ordering is the whole fix: once
    // the nested call is enqueued it is behind the queue slot its own
    // transaction is holding and can never run, which was a permanent,
    // error-free application freeze. The scope is keyed on the native handle, so
    // the scope-local adapter (a different object with a private queue) can
    // still run `Promise.all` and DDL inside the body.
    async transaction<T>(fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T> {
      // Pre-enqueue rejection: see the note on `exec` above. Without this the
      // nested call is already deadlocked the moment it is enqueued.
      if (transactionScopes.isOpen(nativeKey(db))) {
        throw reentrantTransactionError('transaction');
      }
      return queue.enqueue(async () => {
        // A separate queue keeps Promise.all inside the transaction safe
        // without deadlocking against the held outer queue.
        const txn = createExpoSqliteAdapter(db, new AsyncOperationQueue(), { scopeLocal: true });
        return runInTransactionScope(
          transactionScopes,
          nativeKey(db),
          txn,
          async () => {
            // Re-assert FK enforcement through the scope adapter BEFORE
            // BEGIN: SQLite ignores `PRAGMA foreign_keys` while a transaction
            // is pending, so this is the only window in which it applies.
            await txn.exec(SQL.foreignKeysOn);
            await db.execAsync('BEGIN');
          },
          fn,
          {
            commit: () => db.execAsync('COMMIT'),
            rollback: () => db.execAsync('ROLLBACK'),
          },
        );
      });
    },

    async close() {
      await queue.enqueue(() => db.closeAsync());
    },
  };
}

/**
 * Open the app database on an isolated native connection.
 *
 * expo-sqlite SDK 57 caches NativeDatabase objects by name and has an Android
 * runtime-teardown path that can double-close those cached handles. A fresh
 * connection avoids reusing a handle poisoned by a prior React runtime while
 * preserving the same on-device SQLite file.
 */
export function openExpoDatabase(databaseName: string): SQLite.SQLiteDatabase {
  return SQLite.openDatabaseSync(databaseName, { useNewConnection: true });
}
