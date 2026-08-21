/**
 * Trigger-aware table clearing.
 *
 * The append-only tables (currency_ledger, rating_history, xp_awards) are
 * guarded by BEFORE DELETE/UPDATE triggers that ABORT any mutation. A "replace"
 * restore or a local-data wipe must clear them, but:
 *
 *   - `PRAGMA triggers = OFF` is both removed from modern SQLite (3.47+) AND a
 *     no-op when changed inside a transaction, so it cannot be used here.
 *   - TRUNCATE/DELETE via DDL is not available.
 *
 * The robust approach is to capture the live trigger definitions, DROP them at
 * the connection level (DDL, which auto-commits outside a transaction), run the
 * clear inside a transaction, then recreate the exact same triggers. The
 * recreate always runs (in `finally`) so the shared connection is never left
 * without its append-only guarantees.
 */

import type { AppDatabase } from '@/db';

interface TriggerDef {
  name: string;
  sql: string | null;
}

/** Read the current trigger definitions from sqlite_master. */
export async function captureTriggers(db: AppDatabase): Promise<TriggerDef[]> {
  return db.transaction(async (txn) =>
    txn.all<TriggerDef>('SELECT name, sql FROM sqlite_master WHERE type = ?', ['trigger']),
  );
}

/** Drop the given triggers (connection-level DDL). */
export async function dropTriggers(db: AppDatabase, triggers: TriggerDef[]): Promise<void> {
  for (const t of triggers) {
    await db.rawExec(`DROP TRIGGER IF EXISTS "${t.name}"`);
  }
}

/** Recreate the given triggers from their captured DDL. */
export async function recreateTriggers(db: AppDatabase, triggers: TriggerDef[]): Promise<void> {
  for (const t of triggers) {
    if (t.sql) {
      // Tolerate partially-dropped states: if the DROP loop itself failed
      // midway, some definitions still exist and a bare CREATE TRIGGER would
      // throw "already exists", masking the original error.
      await db.rawExec(`DROP TRIGGER IF EXISTS "${t.name}"`);
      await db.rawExec(t.sql);
    }
  }
}

/**
 * Clear the listed tables with the append-only triggers temporarily removed,
 * then restore them. The clear itself runs in one transaction so a crash
 * during deletion leaves the data intact (rolled back) and triggers restored.
 *
 * Campaign 011 (W12): the DROP runs INSIDE the guarded region — a failure
 * during the DDL itself previously skipped the `finally` entirely, leaving
 * the connection permanently without its append-only guards.
 */
export async function clearTablesIgnoringTriggers(
  db: AppDatabase,
  tables: string[],
): Promise<void> {
  const triggers = await captureTriggers(db);
  try {
    await dropTriggers(db, triggers);
    await db.transaction(async (txn) => {
      for (const table of tables) {
        await txn.exec(`DELETE FROM ${table}`);
      }
    });
  } finally {
    await recreateTriggers(db, triggers);
  }
}
