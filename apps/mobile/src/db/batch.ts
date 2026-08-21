import type { SQLiteAdapter, SQLiteRunResult } from './adapter';
import type { SQLiteValue } from './types';

/**
 * Safe batch-write helper (campaign 010 W11).
 *
 * Runs a list of write statements inside ONE transaction so a batch either
 * commits fully or rolls back entirely — the same all-or-nothing guarantee
 * `completeSession` gives single completions, generalized to arbitrary
 * statement lists (e.g. future bulk import paths). Callers own the SQL; this
 * module only sequences execution and aggregates results.
 */

/** One parameterized write statement in a batch. */
export interface BatchStatement {
  /** SQL with positional `?` placeholders only — never interpolated caller text. */
  sql: string;
  /** Positional bind values; defaults to none. */
  params?: readonly SQLiteValue[];
}

/** Aggregated outcome of a committed batch. */
export interface BatchOutcome {
  /** Sum of `changes` across every statement in the batch. */
  changes: number;
  /** `lastInsertRowId` of the final statement (rowid context for callers that need it). */
  lastInsertRowId: number;
  /** Number of statements executed. */
  statementCount: number;
}

/**
 * Execute all statements inside one transaction. On the first failure the
 * transaction rolls back and the error propagates — no partial batch is ever
 * visible. An empty batch commits nothing and returns zeroed counters without
 * opening a transaction.
 */
export async function executeBatch(
  adapter: SQLiteAdapter,
  statements: readonly BatchStatement[],
): Promise<BatchOutcome> {
  if (statements.length === 0) {
    return { changes: 0, lastInsertRowId: 0, statementCount: 0 };
  }
  for (const statement of statements) {
    if (typeof statement.sql !== 'string' || statement.sql.trim() === '') {
      throw new Error('executeBatch: every statement needs non-empty sql');
    }
  }
  return adapter.transaction(async (txn) => {
    let changes = 0;
    let lastInsertRowId = 0;
    for (const statement of statements) {
      const result: SQLiteRunResult = await txn.run(statement.sql, [...(statement.params ?? [])]);
      changes += result.changes;
      lastInsertRowId = result.lastInsertRowId;
    }
    return { changes, lastInsertRowId, statementCount: statements.length };
  });
}
