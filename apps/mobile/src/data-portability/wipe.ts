/**
 * Local-data deletion workflow (constitution §7: "complete deletion with
 * backup offered first"). The destructive clear is transactionally safe and
 * re-enables append-only triggers even on failure. The UI is responsible for
 * the explicit confirmation semantics (e.g. type-to-confirm) — this module
 * only performs the irreversible clear once asked.
 */

import { LOCAL_PROFILE_ID, type AppDatabase } from "@/db";
import { FK_DELETE_ORDER } from "./apply";
import { clearTablesIgnoringTriggers } from "./triggers";

export interface LocalDataCounts {
  gameSessions: number;
  domainRatings: number;
  ratingHistory: number;
  currencyLedger: number;
  gameFavorites: number;
  xpAwards: number;
  tutorialState: number;
  workoutInstances: number;
  questDefinitions: number;
  questProgress: number;
  achievementDefinitions: number;
  achievementUnlocks: number;
  hasProfile: boolean;
  /**
   * On-disk database size in bytes (Campaign 014 W13 storage visibility):
   * `page_count × page_size` via PRAGMA, so the Data Management screen can
   * show how much local space the store actually occupies. 0 when the
   * backend cannot report it.
   */
  storageBytes: number;
}

/**
 * Count everything that `wipeLocalData` would remove (for confirmation UI).
 * Uses raw `COUNT(*)` per table rather than repository list calls so the
 * numbers stay EXACT for large stores (repository lists cap at a limit and
 * would undercount, e.g. a user with more than 10k sessions).
 */
export async function countLocalData(
  db: AppDatabase,
): Promise<LocalDataCounts> {
  return db.transaction(async (txn) => {
    const count = async (table: string): Promise<number> => {
      // Table names are compile-time constants in this module, never user input.
      const rows = await txn.all<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`);
      return rows[0]?.c ?? 0;
    };
    const profileRow = await txn.get<{ id: string }>(
      "SELECT id FROM profile WHERE id = ?",
      [LOCAL_PROFILE_ID],
    );
    // Storage visibility (Campaign 014): page metrics never throw the count
    // pass — a backend without PRAGA support degrades to 0 bytes.
    let storageBytes = 0;
    try {
      const pages = await txn.get<{ n: number }>("PRAGMA page_count");
      const size = await txn.get<{ n: number }>("PRAGMA page_size");
      storageBytes = (pages?.n ?? 0) * (size?.n ?? 0);
    } catch {
      storageBytes = 0;
    }
    return {
      gameSessions: await count("game_sessions"),
      domainRatings: await count("domain_ratings"),
      ratingHistory: await count("rating_history"),
      currencyLedger: await count("currency_ledger"),
      gameFavorites: await count("game_favorites"),
      xpAwards: await count("xp_awards"),
      tutorialState: await count("tutorial_state"),
      workoutInstances: await count("workout_instances"),
      questDefinitions: await count("quests"),
      questProgress: await count("quest_progress"),
      achievementDefinitions: await count("achievements"),
      achievementUnlocks: await count("achievement_unlocks"),
      hasProfile: profileRow !== null && profileRow !== undefined,
      storageBytes,
    };
  });
}

/**
 * Irreversibly delete all local user data. Runs inside one transaction; on
 * failure the data is left intact. Append-only DELETE triggers are disabled
 * for the clear only and re-enabled even when the transaction rolls back.
 */
export async function wipeLocalData(db: AppDatabase): Promise<void> {
  // The append-only DELETE triggers must be removed at the connection level
  // (modern SQLite removed `PRAGMA triggers` and it is a no-op inside a
  // transaction). `clearTablesIgnoringTriggers` drops them, clears in a
  // transaction, then recreates the exact same triggers so the connection is
  // never left without its append-only guarantees. The table order is the
  // shared FK-safe order exported by `apply.ts`.
  await clearTablesIgnoringTriggers(db, [...FK_DELETE_ORDER]);
}
