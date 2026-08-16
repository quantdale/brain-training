import Database from 'better-sqlite3';
import type { SQLiteAdapter, SQLiteRunResult } from '../adapter';
import type { SQLiteValue } from '../types';

/**
 * Node test backend: wraps the synchronous better-sqlite3 connection in the
 * async SQLiteAdapter interface. Only tests import this module — the app
 * bundle must never reach it (Metro only bundles the import graph).
 */
export function createNodeSqliteAdapter(filename = ':memory:'): SQLiteAdapter {
  const db = new Database(filename);

  // Match the in-app connection setup (migrate.initializeConnection).
  db.pragma('foreign_keys = ON');

  const adapter: SQLiteAdapter = {
    async exec(sql) {
      db.exec(sql);
    },

    async run(sql, params = []) {
      const info = db.prepare(sql).run(...params);
      const result: SQLiteRunResult = {
        changes: info.changes,
        lastInsertRowId: Number(info.lastInsertRowid),
      };
      return result;
    },

    async get<T>(sql: string, params: SQLiteValue[] = []) {
      const row = db.prepare(sql).get(...params);
      return row === undefined ? null : (row as T);
    },

    async all<T>(sql: string, params: SQLiteValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },

    // BEGIN IMMEDIATE takes the write lock up front so no other connection
    // can interleave while the (all-synchronous) body runs.
    async transaction(fn) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(adapter);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    async close() {
      db.close();
    },
  };

  return adapter;
}
