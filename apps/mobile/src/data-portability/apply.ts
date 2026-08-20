/**
 * Import application: write a validated backup into the live database.
 *
 * Two modes (constitution §7: "merge or replace restore with validation/
 * preview"):
 *
 *  - `merge`  — additive and idempotent. Sessions are keyed by id (INSERT OR
 *               IGNORE), economy/rating/xp rows are deduplicated by natural
 *               keys, and conflicted value rows (ratings, progress, unlocks,
 *               workouts) take the "best"/latest value. Re-importing the same
 *               backup is a no-op beyond what it first added.
 *  - `replace`— clears all user data first (append-only triggers are
 *               temporarily disabled for the clear only), then inserts the
 *               entire backup. The whole operation runs in one transaction, so
 *               a failure leaves the database exactly as it was.
 *
 * The clear path disables triggers with `PRAGMA triggers = OFF` and re-enables
 * them in a `catch` as well as on success, so a half-failed replace never
 * leaves the shared connection with triggers disabled.
 */

import {
  LOCAL_PROFILE_ID,
  type AppDatabase,
} from '@/db';
import { initializeConnection, runMigrations, type SQLiteAdapter } from '@/db';
import type { BackupData } from './types';
import type { ImportMode } from './types';
import { emptyCounters, type ImportCounters, type ImportResult } from './report';
import type { ParsedBackup } from './deserialize';
import { captureTriggers, dropTriggers, recreateTriggers } from './triggers';

const FK_DELETE_ORDER = [
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

function toJson(value: unknown): string {
  return JSON.stringify(value === undefined ? null : value);
}

function parseJson(text: string | null | undefined, fallback: unknown): unknown {
  if (text == null) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function clearAllUserTables(txn: SQLiteAdapter): Promise<void> {
  // Triggers are already dropped at the connection level by the caller (the
  // legacy `PRAGMA triggers` is removed from modern SQLite and a no-op inside a
  // transaction), so a plain DELETE is allowed here.
  for (const table of FK_DELETE_ORDER) {
    await txn.exec(`DELETE FROM ${table}`);
  }
}

async function writeProfile(
  txn: SQLiteAdapter,
  profile: BackupData['profile'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  if (!profile) {
    return;
  }
  if (mode === 'merge') {
    const existing = await txn.get<{ display_name: string; settings_json: string }>(
      'SELECT display_name, settings_json FROM profile WHERE id = ?',
      [LOCAL_PROFILE_ID],
    );
    if (existing) {
      const targetSettings = parseJson(existing.settings_json, {}) as Record<string, unknown>;
      const merged = { ...targetSettings, ...profile.settings };
      const displayName = profile.displayName || existing.display_name;
      const updatedAt = Math.max(
        profile.updatedAt,
        (await txn.get<{ updated_at: number }>('SELECT updated_at FROM profile WHERE id = ?', [LOCAL_PROFILE_ID]))?.updated_at ?? 0,
      );
      await txn.run(
        'UPDATE profile SET display_name = ?, settings_json = ?, updated_at = ? WHERE id = ?',
        [displayName, toJson(merged), updatedAt, LOCAL_PROFILE_ID],
      );
      c.profileMerged = true;
      return;
    }
  }
  await txn.run(
    'INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [profile.id, profile.displayName, toJson(profile.settings), profile.createdAt, profile.updatedAt],
  );
  c.profileMerged = true;
}

async function writeSessions(
  txn: SQLiteAdapter,
  sessions: BackupData['gameSessions'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<Set<string>> {
  const newIds = new Set<string>();
  const INSERT =
    'INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  for (const s of sessions) {
    if (mode === 'merge') {
      const existing = await txn.get<{ id: string }>('SELECT id FROM game_sessions WHERE id = ?', [
        s.id,
      ]);
      if (existing) {
        c.sessionsSkipped += 1;
        continue;
      }
    }
    await txn.run(INSERT, [
      s.id,
      s.gameId,
      s.gameVersion,
      s.generatorVersion,
      s.scoringVersion,
      s.seed,
      toJson(s.difficulty),
      toJson(s.rawResult),
      s.normalizedResult,
      s.xp,
      s.startedAt,
      s.completedAt,
      s.durationMs,
    ]);
    newIds.add(s.id);
    c.sessionsAdded += 1;
  }
  return newIds;
}

async function writeRatingHistory(
  txn: SQLiteAdapter,
  history: BackupData['ratingHistory'],
  mode: ImportMode,
  c: ImportCounters,
  newSessionIds: Set<string>,
): Promise<void> {
  const INSERT =
    'INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)';
  for (const r of history) {
    // Only import history for sessions we actually inserted (or the whole
    // backup in replace mode, where every session was inserted).
    if (!newSessionIds.has(r.sessionId)) {
      continue;
    }
    if (mode === 'merge') {
      const existing = await txn.get<{ id: number }>(
        'SELECT id FROM rating_history WHERE session_id = ? AND domain = ?',
        [r.sessionId, r.domain],
      );
      if (existing) continue;
    }
    await txn.run(INSERT, [r.sessionId, r.domain, r.delta, r.ratingAfter, r.createdAt]);
    c.ratingHistoryAdded += 1;
  }
}

async function writeLedger(
  txn: SQLiteAdapter,
  ledger: BackupData['currencyLedger'],
  mode: ImportMode,
  c: ImportCounters,
  newSessionIds: Set<string>,
): Promise<void> {
  const INSERT =
    'INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (?, ?, ?, ?, ?)';
  for (const e of ledger) {
    if (mode === 'merge') {
      if (e.operationId) {
        const ex = await txn.get<{ id: number }>(
          'SELECT id FROM currency_ledger WHERE operation_id = ?',
          [e.operationId],
        );
        if (ex) continue;
      } else if (e.sessionId) {
        if (!newSessionIds.has(e.sessionId)) continue; // session already present → its ledger is too
        const ex = await txn.get<{ id: number }>(
          'SELECT id FROM currency_ledger WHERE session_id = ? AND reason = ? AND amount = ? AND created_at = ?',
          [e.sessionId, e.reason, e.amount, e.createdAt],
        );
        if (ex) continue;
      } else {
        const ex = await txn.get<{ id: number }>(
          'SELECT id FROM currency_ledger WHERE session_id IS NULL AND reason = ? AND amount = ? AND created_at = ?',
          [e.reason, e.amount, e.createdAt],
        );
        if (ex) continue;
      }
    }
    await txn.run(INSERT, [e.amount, e.reason, e.sessionId, e.createdAt, e.operationId]);
    c.ledgerAdded += 1;
  }
}

async function writeXpAwards(
  txn: SQLiteAdapter,
  awards: BackupData['xpAwards'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  const INSERT =
    'INSERT INTO xp_awards (amount, reason, source, created_at) VALUES (?, ?, ?, ?)';
  for (const a of awards) {
    if (mode === 'merge') {
      const ex = await txn.get<{ id: number }>(
        'SELECT id FROM xp_awards WHERE source = ? AND amount = ? AND reason = ? AND created_at = ?',
        [a.source, a.amount, a.reason, a.createdAt],
      );
      if (ex) continue;
    }
    await txn.run(INSERT, [a.amount, a.reason, a.source, a.createdAt]);
    c.xpAwardsAdded += 1;
  }
}

async function writeFavorites(
  txn: SQLiteAdapter,
  favorites: BackupData['gameFavorites'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const f of favorites) {
    if (mode === 'merge') {
      const ex = await txn.get<{ game_id: string }>(
        'SELECT game_id FROM game_favorites WHERE game_id = ?',
        [f.gameId],
      );
      if (ex) continue;
    }
    await txn.run('INSERT INTO game_favorites (game_id, created_at) VALUES (?, ?)', [
      f.gameId,
      f.createdAt,
    ]);
    c.favoritesAdded += 1;
  }
}

async function writeDomainRatings(
  txn: SQLiteAdapter,
  ratings: BackupData['domainRatings'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const d of ratings) {
    if (mode === 'merge') {
      const ex = await txn.get<{ rating: number; sessions: number; updated_at: number }>(
        'SELECT rating, sessions, updated_at FROM domain_ratings WHERE domain = ?',
        [d.domain],
      );
      if (ex) {
        // Preserve the valid best: max rating, max session count, latest update.
        const rating = Math.max(ex.rating, d.rating);
        const sessions = Math.max(ex.sessions, d.sessions);
        const updatedAt = Math.max(ex.updated_at, d.updatedAt);
        await txn.run(
          'UPDATE domain_ratings SET rating = ?, sessions = ?, updated_at = ? WHERE domain = ?',
          [rating, sessions, updatedAt, d.domain],
        );
        c.domainRatingsUpdated += 1;
        continue;
      }
    }
    await txn.run(
      'INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)',
      [d.domain, d.rating, d.sessions, d.updatedAt],
    );
    c.domainRatingsUpdated += 1;
  }
}

async function writeTutorial(
  txn: SQLiteAdapter,
  states: BackupData['tutorialState'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const t of states) {
    if (mode === 'merge') {
      const ex = await txn.get<{ game_id: string }>(
        'SELECT game_id FROM tutorial_state WHERE game_id = ?',
        [t.gameId],
      );
      if (ex) {
        await txn.run(
          'UPDATE tutorial_state SET completed = ?, replay_requested = ?, version = ?, updated_at = ? WHERE game_id = ?',
          [t.completed ? 1 : 0, t.replayRequested ? 1 : 0, t.version, t.updatedAt, t.gameId],
        );
        c.tutorialsUpdated += 1;
        continue;
      }
    }
    await txn.run(
      'INSERT INTO tutorial_state (game_id, completed, replay_requested, version, updated_at) VALUES (?, ?, ?, ?, ?)',
      [t.gameId, t.completed ? 1 : 0, t.replayRequested ? 1 : 0, t.version, t.updatedAt],
    );
    c.tutorialsUpdated += 1;
  }
}

async function writeWorkouts(
  txn: SQLiteAdapter,
  workouts: BackupData['workoutInstances'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const w of workouts) {
    const json = JSON.stringify(w.gameIds);
    if (mode === 'merge') {
      const ex = await txn.get<{ updated_at: number }>(
        'SELECT updated_at FROM workout_instances WHERE date = ?',
        [w.date],
      );
      if (ex) {
        if (ex.updated_at >= w.updatedAt) {
          continue; // keep the newer/equal existing instance
        }
        await txn.run(
          'UPDATE workout_instances SET game_ids_json = ?, status = ?, current_index = ?, reroll_attempt = ?, seed_version = ?, updated_at = ? WHERE date = ?',
          [json, w.status, w.currentIndex, w.rerollAttempt, w.seedVersion, w.updatedAt, w.date],
        );
        c.workoutsUpdated += 1;
        continue;
      }
    }
    await txn.run(
      'INSERT INTO workout_instances (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [w.date, json, w.status, w.currentIndex, w.rerollAttempt, w.seedVersion, w.createdAt, w.updatedAt],
    );
    c.workoutsUpdated += 1;
  }
}

async function writeQuestDefinitions(
  txn: SQLiteAdapter,
  defs: BackupData['questDefinitions'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const q of defs) {
    if (mode === 'merge') {
      const ex = await txn.get<{ version: number }>('SELECT version FROM quests WHERE id = ?', [
        q.id,
      ]);
      if (ex) {
        if (ex.version >= q.version) continue;
        await txn.run(
          'UPDATE quests SET kind = ?, title = ?, description = ?, criteria_json = ?, reward_xp = ?, reward_currency = ?, version = ? WHERE id = ?',
          [q.kind, q.title, q.description, toJson(q.criteria), q.rewardXp, q.rewardCurrency, q.version, q.id],
        );
        c.questDefinitionsUpdated += 1;
        continue;
      }
    }
    await txn.run(
      'INSERT INTO quests (id, kind, title, description, criteria_json, reward_xp, reward_currency, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [q.id, q.kind, q.title, q.description, toJson(q.criteria), q.rewardXp, q.rewardCurrency, q.version],
    );
    c.questDefinitionsUpdated += 1;
  }
}

async function writeQuestProgress(
  txn: SQLiteAdapter,
  progress: BackupData['questProgress'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const p of progress) {
    if (mode === 'merge') {
      const ex = await txn.get<{ progress: number; completed_at: number | null; claimed_at: number | null }>(
        'SELECT progress, completed_at, claimed_at FROM quest_progress WHERE quest_id = ? AND period = ?',
        [p.questId, p.period],
      );
      if (ex) {
        const progressVal = Math.max(ex.progress, p.progress);
        const completedAt = ex.completed_at ?? p.completedAt;
        const claimedAt = ex.claimed_at ?? p.claimedAt;
        await txn.run(
          'UPDATE quest_progress SET progress = ?, completed_at = ?, claimed_at = ? WHERE quest_id = ? AND period = ?',
          [progressVal, completedAt, claimedAt, p.questId, p.period],
        );
        c.questProgressUpdated += 1;
        continue;
      }
    }
    await txn.run(
      'INSERT INTO quest_progress (quest_id, period, progress, completed_at, claimed_at) VALUES (?, ?, ?, ?, ?)',
      [p.questId, p.period, p.progress, p.completedAt, p.claimedAt],
    );
    c.questProgressUpdated += 1;
  }
}

async function writeAchievementDefinitions(
  txn: SQLiteAdapter,
  defs: BackupData['achievementDefinitions'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const d of defs) {
    if (mode === 'merge') {
      const ex = await txn.get<{ version: number }>(
        'SELECT version FROM achievements WHERE id = ?',
        [d.id],
      );
      if (ex) {
        if (ex.version >= d.version) continue;
        await txn.run(
          'UPDATE achievements SET title = ?, description = ?, criteria_json = ?, reward_xp = ?, reward_currency = ?, version = ? WHERE id = ?',
          [d.title, d.description, toJson(d.criteria), d.rewardXp, d.rewardCurrency, d.version, d.id],
        );
        c.achievementDefinitionsUpdated += 1;
        continue;
      }
    }
    await txn.run(
      'INSERT INTO achievements (id, title, description, criteria_json, reward_xp, reward_currency, version) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [d.id, d.title, d.description, toJson(d.criteria), d.rewardXp, d.rewardCurrency, d.version],
    );
    c.achievementDefinitionsUpdated += 1;
  }
}

async function writeAchievementUnlocks(
  txn: SQLiteAdapter,
  unlocks: BackupData['achievementUnlocks'],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const u of unlocks) {
    if (mode === 'merge') {
      const ex = await txn.get<{ unlocked_at: number; claimed_at: number | null }>(
        'SELECT unlocked_at, claimed_at FROM achievement_unlocks WHERE achievement_id = ?',
        [u.achievementId],
      );
      if (ex) {
        const unlockedAt = Math.min(ex.unlocked_at, u.unlockedAt);
        const claimedAt = ex.claimed_at ?? u.claimedAt;
        await txn.run(
          'UPDATE achievement_unlocks SET unlocked_at = ?, claimed_at = ? WHERE achievement_id = ?',
          [unlockedAt, claimedAt, u.achievementId],
        );
        c.achievementUnlocksUpdated += 1;
        continue;
      }
    }
    await txn.run(
      'INSERT INTO achievement_unlocks (achievement_id, unlocked_at, claimed_at) VALUES (?, ?, ?)',
      [u.achievementId, u.unlockedAt, u.claimedAt],
    );
    c.achievementUnlocksUpdated += 1;
  }
}

/** Apply the backup's data within a single transaction. Mutates nothing until committed. */
export async function applyData(
  txn: SQLiteAdapter,
  data: BackupData,
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  if (mode === 'replace') {
    // Disable the append-only DELETE triggers for the clear only, then restore
    // them (the outer transaction still rolls the data back on any failure).
    await txn.exec('PRAGMA triggers = OFF');
    try {
      for (const table of FK_DELETE_ORDER) {
        await txn.exec(`DELETE FROM ${table}`);
      }
    } finally {
      await txn.exec('PRAGMA triggers = ON');
    }
  }

  await writeProfile(txn, data.profile, mode, c);
  await writeFavorites(txn, data.gameFavorites, mode, c);
  await writeDomainRatings(txn, data.domainRatings, mode, c);
  const newSessionIds = await writeSessions(txn, data.gameSessions, mode, c);
  await writeRatingHistory(txn, data.ratingHistory, mode, c, newSessionIds);
  await writeLedger(txn, data.currencyLedger, mode, c, newSessionIds);
  await writeXpAwards(txn, data.xpAwards, mode, c);
  await writeTutorial(txn, data.tutorialState, mode, c);
  await writeWorkouts(txn, data.workoutInstances, mode, c);
  await writeQuestDefinitions(txn, data.questDefinitions, mode, c);
  await writeQuestProgress(txn, data.questProgress, mode, c);
  await writeAchievementDefinitions(txn, data.achievementDefinitions, mode, c);
  await writeAchievementUnlocks(txn, data.achievementUnlocks, mode, c);
}

function summarizeWritten(c: ImportCounters): number {
  return (
    c.sessionsAdded +
    c.ratingHistoryAdded +
    c.ledgerAdded +
    c.xpAwardsAdded +
    c.favoritesAdded +
    c.domainRatingsUpdated +
    c.tutorialsUpdated +
    c.workoutsUpdated +
    c.questDefinitionsUpdated +
    c.questProgressUpdated +
    c.achievementDefinitionsUpdated +
    c.achievementUnlocksUpdated +
    (c.profileMerged ? 1 : 0)
  );
}

/**
 * Apply a parsed (already-validated) backup to the live database. The whole
 * import runs inside one transaction; on any thrown error the database is left
 * exactly as it was. Returns a per-section result.
 */
export async function applyImport(
  db: AppDatabase,
  parsed: ParsedBackup,
  mode: ImportMode,
): Promise<ImportResult> {
  const c = emptyCounters(mode);
  if (mode === 'replace') {
    // The append-only DELETE triggers must be removed at the connection level
    // (the legacy `PRAGMA triggers` is gone from modern SQLite and a no-op
    // inside a transaction). Drop them, run the clear + full insert in one
    // transaction, then recreate the exact same triggers so the connection is
    // never left without its append-only guarantees.
    const triggers = await captureTriggers(db);
    await dropTriggers(db, triggers);
    try {
      await db.transaction(async (txn) => {
        await applyData(txn, parsed.data, mode, c);
      });
    } finally {
      await recreateTriggers(db, triggers);
    }
  } else {
    await db.transaction(async (txn) => {
      await applyData(txn, parsed.data, mode, c);
    });
  }
  return { ...c, totalWritten: summarizeWritten(c) };
}

/**
 * Build a fully-populated, migrated database from a backup using a fresh
 * adapter factory. Intended for the production "replace" path where the
 * transport swaps the physical database file: the returned adapter is itself
 * built transactionally, so it is never partially written, and the file swap
 * is an atomic OS rename. The caller closes/owns the returned adapter.
 */
export async function buildDatabaseFromBackup(
  parsed: ParsedBackup,
  makeAdapter: () => Promise<SQLiteAdapter> | SQLiteAdapter,
): Promise<SQLiteAdapter> {
  const adapter = await makeAdapter();
  await initializeConnection(adapter);
  await runMigrations(adapter);
  const c = emptyCounters('replace');
  await adapter.transaction(async (txn) => {
    await applyData(txn, parsed.data, 'replace', c);
  });
  return adapter;
}
