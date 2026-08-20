/**
 * Local-data deletion workflow (constitution §7: "complete deletion with
 * backup offered first"). The destructive clear is transactionally safe and
 * re-enables append-only triggers even on failure. The UI is responsible for
 * the explicit confirmation semantics (e.g. type-to-confirm) — this module
 * only performs the irreversible clear once asked.
 */

import type { AppDatabase } from '@/db';
import { clearTablesIgnoringTriggers } from './triggers';

const WIPE_ORDER = [
  'rating_history',
  'currency_ledger',
  'quest_progress',
  'achievement_unlocks',
  'xp_awards',
  'game_favorites',
  'tutorial_state',
  'workout_instances',
  'domain_ratings',
  'game_sessions',
  'quests',
  'achievements',
  'profile',
];

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
}

/** Count everything that `wipeLocalData` would remove (for confirmation UI). */
export async function countLocalData(db: AppDatabase): Promise<LocalDataCounts> {
  const tutorial = await db.transaction((txn) =>
    txn.all<{ c: number }>('SELECT COUNT(*) AS c FROM tutorial_state'),
  );
  const workouts = await db.transaction((txn) =>
    txn.all<{ c: number }>('SELECT COUNT(*) AS c FROM workout_instances'),
  );
  const questDefs = await db.transaction((txn) =>
    txn.all<{ c: number }>('SELECT COUNT(*) AS c FROM quests'),
  );
  const questProg = await db.transaction((txn) =>
    txn.all<{ c: number }>('SELECT COUNT(*) AS c FROM quest_progress'),
  );
  const achDefs = await db.transaction((txn) =>
    txn.all<{ c: number }>('SELECT COUNT(*) AS c FROM achievements'),
  );
  const achUnlocks = await db.transaction((txn) =>
    txn.all<{ c: number }>('SELECT COUNT(*) AS c FROM achievement_unlocks'),
  );
  const profile = await db.profile.get();

  return {
    gameSessions: (await db.sessions.listRecent(10000)).length,
    domainRatings: (await db.ratings.getRatings()).length,
    ratingHistory: (await db.ratings.getHistory(10000)).length,
    currencyLedger: (await db.ledger.list(10000)).length,
    gameFavorites: (await db.favorites.listFavoriteGameIds()).length,
    xpAwards: (await db.xpAwards.list(10000)).length,
    tutorialState: tutorial[0]?.c ?? 0,
    workoutInstances: workouts[0]?.c ?? 0,
    questDefinitions: questDefs[0]?.c ?? 0,
    questProgress: questProg[0]?.c ?? 0,
    achievementDefinitions: achDefs[0]?.c ?? 0,
    achievementUnlocks: achUnlocks[0]?.c ?? 0,
    hasProfile: profile !== null,
  };
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
  // never left without its append-only guarantees.
  await clearTablesIgnoringTriggers(db, WIPE_ORDER);
}
