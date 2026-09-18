import * as SQLite from 'expo-sqlite';
import type { SQLiteAdapter } from '../adapter';

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

function queueForDatabase(db: SQLite.SQLiteDatabase): AsyncOperationQueue {
  // Expo can return a new JS SQLiteDatabase wrapper around the same cached
  // NativeDatabase (notably across fast-refresh/runtime remounts). Queueing by
  // the wrapper would let those calls race on one native handle again. The
  // native handle is the actual serialization boundary; the fallback keeps
  // this seam tolerant of the minimal test doubles used by Jest.
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
 */
export function createExpoSqliteAdapter(
  db: SQLite.SQLiteDatabase,
  queue: AsyncOperationQueue = queueForDatabase(db),
): SQLiteAdapter {
  return {
    async exec(sql) {
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

    // Exclusive so the transaction cannot be interleaved by other async
    // queries (documented expo-sqlite behavior); all queries inside the
    // callback must run on the transaction connection. The callback must
    // return void, so the fn result is captured and returned after commit.
    async transaction<T>(fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T> {
      return queue.enqueue(async () => {
        let result: T;
        await db.withExclusiveTransactionAsync(async (txn) => {
          // The outer queue is held for the complete transaction. A separate
          // queue keeps Promise.all inside the transaction safe without
          // deadlocking against that held outer queue.
          result = await fn(createExpoSqliteAdapter(txn, new AsyncOperationQueue()));
        });
        return result!;
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
