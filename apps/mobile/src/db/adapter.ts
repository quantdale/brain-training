import type { SQLiteValue } from './types';

/** Result of a write statement, normalized across backends. */
export interface SQLiteRunResult {
  changes: number;
  lastInsertRowId: number;
}

/**
 * Storage abstraction implemented by both SQLite backends:
 *
 * - in-app: expo-sqlite (`adapters/expo.ts`)
 * - Node tests: better-sqlite3 (`adapters/node.ts`)
 *
 * Repositories and migrations are written exclusively against this interface
 * and against the common SQL dialect (positional `?` params, plain SQLite
 * DDL/DML, no backend-specific SQL). Both backends wrap their native
 * synchronous API in this async interface so one code path serves the app and
 * the test suite.
 */
export interface SQLiteAdapter {
  /** Execute one or more SQL statements (no params, no result rows). */
  exec(sql: string): Promise<void>;

  /** Execute a single statement with positional `?` params. */
  run(sql: string, params?: SQLiteValue[]): Promise<SQLiteRunResult>;

  /** Fetch the first row of a statement, or null when there is none. */
  get<T>(sql: string, params?: SQLiteValue[]): Promise<T | null>;

  /** Fetch all rows of a statement. */
  all<T>(sql: string, params?: SQLiteValue[]): Promise<T[]>;

  /**
   * Run `fn` inside a write transaction. `fn` receives an adapter whose
   * queries run on the transaction connection; it MUST use that adapter for
   * all of its queries. On rejection the transaction rolls back and the error
   * propagates. Transactions do not nest.
   */
  transaction<T>(fn: (txn: SQLiteAdapter) => Promise<T>): Promise<T>;

  close(): Promise<void>;
}
