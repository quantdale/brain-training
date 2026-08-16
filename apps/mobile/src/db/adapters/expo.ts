import * as SQLite from 'expo-sqlite';
import type { SQLiteAdapter } from '../adapter';

/**
 * In-app backend: wraps an expo-sqlite `SQLiteDatabase` in the async
 * SQLiteAdapter interface. Same SQL, same repositories as the Node test
 * backend. This module imports the expo-sqlite native module, so it must
 * never be imported by Node-side tests (jest-expo does not mock the core
 * `openDatabaseSync`/query surface) — tests run against `adapters/node.ts`.
 */
export function createExpoSqliteAdapter(db: SQLite.SQLiteDatabase): SQLiteAdapter {
  return {
    async exec(sql) {
      await db.execAsync(sql);
    },

    async run(sql, params = []) {
      const result = await db.runAsync(sql, ...params);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },

    async get(sql, params = []) {
      return db.getFirstAsync(sql, ...params);
    },

    async all(sql, params = []) {
      return db.getAllAsync(sql, ...params);
    },

    // Exclusive so the transaction cannot be interleaved by other async
    // queries (documented expo-sqlite behavior); all queries inside the
    // callback must run on the transaction connection. The callback must
    // return void, so the fn result is captured and returned after commit.
    async transaction<T>(fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T> {
      let result: T;
      await db.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(createExpoSqliteAdapter(txn));
      });
      return result!;
    },

    async close() {
      await db.closeAsync();
    },
  };
}

/** Open (or reuse the cached connection for) the app database. */
export function openExpoDatabase(databaseName: string): SQLite.SQLiteDatabase {
  return SQLite.openDatabaseSync(databaseName);
}
