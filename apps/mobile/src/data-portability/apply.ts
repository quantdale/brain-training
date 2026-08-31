/**
 * Import application: write a validated backup into the live database.
 *
 * Two modes (constitution §7: "merge or replace restore with validation/
 * preview"):
 *
 *  - `merge`  — additive and idempotent. Sessions are keyed by id (INSERT OR
 *               IGNORE), economy/rating/xp rows are deduplicated by natural
 *               keys, and conflicted value rows (ratings, progress, unlocks,
 *               workouts) take the "best"/latest value. The profile is always
 *               written under the local singleton id and its cosmetics merge
 *               monotonically (`owned` is unioned — a merge never disowns a
 *               cosmetic the device earned). Re-importing the same backup is a
 *               no-op beyond what it first added.
 *  - `replace`— clears all user data first (append-only triggers are
 *               temporarily disabled for the clear only), then inserts the
 *               entire backup. The whole operation runs in one transaction, so
 *               a failure leaves the database exactly as it was.
 *
 * The clear path temporarily drops the connection's triggers and recreates
 * them in a `finally`, so a half-failed replace never leaves the shared
 * connection without its integrity guards.
 */

import {
  LOCAL_PROFILE_ID,
  type AppDatabase,
  initializeConnection,
  runMigrations,
  type SQLiteAdapter,
} from "@/db";
import type { BackupData, ImportMode } from "./types";
import {
  emptyCounters,
  type ImportCounters,
  type ImportResult,
} from "./report";
import type { ParsedBackup } from "./deserialize";
import { captureTriggers, dropTriggers, recreateTriggers } from "./triggers";

/**
 * Deletion order honoring foreign keys: children before parents. Single source
 * of truth for BOTH the replace-import clear and the local-data wipe
 * (`wipe.ts` imports this) so the two destructive paths can never drift apart
 * when the schema grows a table.
 */
export const FK_DELETE_ORDER = [
  "rating_history",
  "currency_ledger",
  "quest_progress",
  "achievement_unlocks",
  "xp_awards",
  "game_favorites",
  "tutorial_state",
  "workout_instances",
  "domain_ratings",
  "game_sessions",
  "quests",
  "achievements",
  "profile",
];

function toJson(value: unknown): string {
  return JSON.stringify(value === undefined ? null : value);
}

function parseJson(
  text: string | null | undefined,
  fallback: unknown,
): unknown {
  if (text == null) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Drop within-backup duplicate rows keyed by a stable natural key, keeping the
 * FIRST occurrence. Used to make import resilient to a slightly-corrupt backup
 * (e.g. accidental duplicate entries) and to prevent a replace import from
 * tripping the partial unique index on `currency_ledger.operation_id`.
 *
 * Rows whose key is `null` are always preserved (we never collapse distinct
 * rows that merely share a nullable field), so legitimate data is never
 * over-deduped.
 */
function dedupeNonNullKey<T>(
  items: readonly T[],
  key: (item: T) => string | null,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (k !== null) {
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
    }
    out.push(item);
  }
  return out;
}

/**
 * Stable identity for XP awards whose producer has a logical one-shot key.
 * Legacy/generic awards intentionally return null: two unrelated system
 * awards may legitimately share source/reason/time and must remain distinct.
 */
function xpAwardIdentity(
  award: BackupData["xpAwards"][number],
): string | null {
  const source = award.source;
  const stable =
    source.startsWith("achievement:") ||
    source.startsWith("milestone:") ||
    /^quest:[^:]+:.+$/.test(source);
  return stable ? composite(source, award.reason) : null;
}

/** Composite key helper (entries are kept distinct unless every field matches). */
const composite = (...parts: (string | number | null)[]): string =>
  parts.join("\u0000");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Merge `incoming` (backup) profile settings over `target` (device) settings.
 *
 * Default rule is backup-wins per top-level key. `cosmetics` is the one
 * exception because ownership is monotonic: a merge must never DISOWN a
 * cosmetic the device legitimately earned just because the backup's `owned`
 * list is older/narrower. So `owned` is unioned (device items first, then
 * backup-only additions), while `equipped` slots resolve per-slot with the
 * backup winning — matching the documented conflict semantics — and slots
 * equipped only on the device survive.
 */
export function mergeProfileSettings(
  target: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...target, ...incoming };
  if (target.cosmetics !== undefined || incoming.cosmetics !== undefined) {
    const t = isPlainObject(target.cosmetics) ? target.cosmetics : {};
    const i = isPlainObject(incoming.cosmetics) ? incoming.cosmetics : {};
    const out: Record<string, unknown> = { ...t, ...i };

    const owned = stringArray(t.owned);
    const ownedSet = new Set(owned);
    for (const item of stringArray(i.owned)) {
      if (!ownedSet.has(item)) {
        owned.push(item);
        ownedSet.add(item);
      }
    }
    if (t.owned !== undefined || i.owned !== undefined) {
      out.owned = owned;
    }

    const tEquipped = isPlainObject(t.equipped) ? t.equipped : {};
    const iEquipped = isPlainObject(i.equipped) ? i.equipped : {};
    if (t.equipped !== undefined || i.equipped !== undefined) {
      // Backup wins each slot it names; device-only slots are preserved.
      out.equipped = { ...tEquipped, ...iEquipped };
    }

    merged.cosmetics = out;
  }
  return merged;
}

async function writeProfile(
  txn: SQLiteAdapter,
  profile: BackupData["profile"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  if (!profile) {
    return;
  }
  // The profile row is a device singleton keyed by LOCAL_PROFILE_ID ('local').
  // A backup may carry a row written under a different id (foreign/hand-edited
  // file); writing that id verbatim would create an INVISIBLE second profile
  // (every read goes through WHERE id = LOCAL_PROFILE_ID), silently dropping
  // the restored identity/settings/cosmetics. Normalize to the local id.
  const displayName = profile.displayName;
  const settings = profile.settings;
  if (mode === "merge") {
    const existing = await txn.get<{
      display_name: string;
      settings_json: string;
      updated_at: number;
    }>("SELECT display_name, settings_json, updated_at FROM profile WHERE id = ?", [
      LOCAL_PROFILE_ID,
    ]);
    if (existing) {
      const targetSettings = parseJson(existing.settings_json, {}) as Record<
        string,
        unknown
      >;
      const merged = mergeProfileSettings(targetSettings, settings);
      const resolvedName = displayName || existing.display_name;
      const updatedAt = Math.max(profile.updatedAt, existing.updated_at);
      await txn.run(
        "UPDATE profile SET display_name = ?, settings_json = ?, updated_at = ? WHERE id = ?",
        [resolvedName, toJson(merged), updatedAt, LOCAL_PROFILE_ID],
      );
      c.profileMerged = true;
      return;
    }
  }
  await txn.run(
    "INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [
      LOCAL_PROFILE_ID,
      displayName,
      toJson(settings),
      profile.createdAt,
      profile.updatedAt,
    ],
  );
  c.profileMerged = true;
}

async function writeSessions(
  txn: SQLiteAdapter,
  sessions: BackupData["gameSessions"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  const INSERT =
    "INSERT INTO game_sessions (id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  for (const s of sessions) {
    if (mode === "merge") {
      const existing = await txn.get<{ id: string }>(
        "SELECT id FROM game_sessions WHERE id = ?",
        [s.id],
      );
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
      // Older app versions briefly persisted the monotonic-clock fraction in
      // this INTEGER-declared column. Preserve those backups while restoring
      // the current storage invariant at the import boundary.
      Math.round(s.durationMs),
    ]);
    c.sessionsAdded += 1;
  }
}

async function writeRatingHistory(
  txn: SQLiteAdapter,
  history: BackupData["ratingHistory"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  const INSERT =
    "INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES (?, ?, ?, ?, ?)";
  for (const r of history) {
    if (mode === "merge") {
      const existing = await txn.get<{ id: number }>(
        "SELECT id FROM rating_history WHERE session_id = ? AND domain = ?",
        [r.sessionId, r.domain],
      );
      if (existing) continue;
    }
    await txn.run(INSERT, [
      r.sessionId,
      r.domain,
      r.delta,
      r.ratingAfter,
      r.createdAt,
    ]);
    c.ratingHistoryAdded += 1;
  }
}

async function writeLedger(
  txn: SQLiteAdapter,
  ledger: BackupData["currencyLedger"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  const INSERT =
    "INSERT INTO currency_ledger (amount, reason, session_id, created_at, operation_id) VALUES (?, ?, ?, ?, ?)";
  for (const e of ledger) {
    if (mode === "merge") {
      if (e.operationId) {
        const ex = await txn.get<{ id: number }>(
          "SELECT id FROM currency_ledger WHERE operation_id = ?",
          [e.operationId],
        );
        if (ex) continue;
      } else if (e.sessionId) {
        const ex = await txn.get<{ id: number }>(
          "SELECT id FROM currency_ledger WHERE session_id = ? AND reason = ? AND amount = ? AND created_at = ?",
          [e.sessionId, e.reason, e.amount, e.createdAt],
        );
        if (ex) continue;
      } else {
        const ex = await txn.get<{ id: number }>(
          "SELECT id FROM currency_ledger WHERE session_id IS NULL AND reason = ? AND amount = ? AND created_at = ?",
          [e.reason, e.amount, e.createdAt],
        );
        if (ex) continue;
      }
    }
    await txn.run(INSERT, [
      e.amount,
      e.reason,
      e.sessionId,
      e.createdAt,
      e.operationId,
    ]);
    c.ledgerAdded += 1;
  }
}

async function writeXpAwards(
  txn: SQLiteAdapter,
  awards: BackupData["xpAwards"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  const INSERT =
    "INSERT INTO xp_awards (amount, reason, source, created_at) VALUES (?, ?, ?, ?)";
  for (const a of awards) {
    if (mode === "merge") {
      const stable = xpAwardIdentity(a);
      const ex = stable
        ? await txn.get<{ id: number }>(
            "SELECT id FROM xp_awards WHERE source = ? AND reason = ?",
            [a.source, a.reason],
          )
        : await txn.get<{ id: number }>(
            "SELECT id FROM xp_awards WHERE source = ? AND amount = ? AND reason = ? AND created_at = ?",
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
  favorites: BackupData["gameFavorites"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const f of favorites) {
    if (mode === "merge") {
      const ex = await txn.get<{ game_id: string }>(
        "SELECT game_id FROM game_favorites WHERE game_id = ?",
        [f.gameId],
      );
      if (ex) continue;
    }
    await txn.run(
      "INSERT INTO game_favorites (game_id, created_at) VALUES (?, ?)",
      [f.gameId, f.createdAt],
    );
    c.favoritesAdded += 1;
  }
}

async function writeDomainRatings(
  txn: SQLiteAdapter,
  ratings: BackupData["domainRatings"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const d of ratings) {
    if (mode === "merge") {
      const ex = await txn.get<{
        rating: number;
        sessions: number;
        updated_at: number;
      }>(
        "SELECT rating, sessions, updated_at FROM domain_ratings WHERE domain = ?",
        [d.domain],
      );
      if (ex) {
        // Preserve the valid best: max rating, max session count, latest update.
        const rating = Math.max(ex.rating, d.rating);
        const sessions = Math.max(ex.sessions, d.sessions);
        const updatedAt = Math.max(ex.updated_at, d.updatedAt);
        await txn.run(
          "UPDATE domain_ratings SET rating = ?, sessions = ?, updated_at = ? WHERE domain = ?",
          [rating, sessions, updatedAt, d.domain],
        );
        c.domainRatingsUpdated += 1;
        continue;
      }
    }
    await txn.run(
      "INSERT INTO domain_ratings (domain, rating, sessions, updated_at) VALUES (?, ?, ?, ?)",
      [d.domain, d.rating, d.sessions, d.updatedAt],
    );
    c.domainRatingsUpdated += 1;
  }
}

async function writeTutorial(
  txn: SQLiteAdapter,
  states: BackupData["tutorialState"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  const incomingWins = (
    existing: {
      updated_at: number;
      completed: number;
      replay_requested: number;
      version: string | null;
    },
    incoming: BackupData["tutorialState"][number],
  ): boolean => {
    if (incoming.updatedAt !== existing.updated_at) {
      return incoming.updatedAt > existing.updated_at;
    }
    // Backups do not carry an origin-device id, so equal timestamps need a
    // stable value tie-breaker rather than depending on import array order.
    const existingKey = JSON.stringify([
      existing.version,
      existing.completed === 1,
      existing.replay_requested === 1,
    ]);
    const incomingKey = JSON.stringify([
      incoming.version,
      incoming.completed,
      incoming.replayRequested,
    ]);
    return incomingKey > existingKey;
  };

  for (const t of states) {
    if (mode === "merge") {
      const ex = await txn.get<{ game_id: string }>(
        "SELECT game_id FROM tutorial_state WHERE game_id = ?",
        [t.gameId],
      );
      if (ex) {
        const current = await txn.get<{
          completed: number;
          replay_requested: number;
          version: string | null;
          updated_at: number;
        }>(
          "SELECT completed, replay_requested, version, updated_at FROM tutorial_state WHERE game_id = ?",
          [t.gameId],
        );
        if (!current) {
          throw new Error(`tutorial state disappeared during merge (${t.gameId})`);
        }
        const winnerIsIncoming = incomingWins(current, t);
        const winner = winnerIsIncoming
          ? {
              replayRequested: t.replayRequested,
              version: t.version,
              updatedAt: t.updatedAt,
            }
          : {
              replayRequested: current.replay_requested === 1,
              version: current.version,
              updatedAt: current.updated_at,
            };
        // Completion is monotonic: a stale/hand-edited backup must never make
        // an already-finished tutorial appear unseen again. The other fields
        // follow the newer (or deterministic equal-time) row.
        const completed = current.completed === 1 || t.completed;
        await txn.run(
          "UPDATE tutorial_state SET completed = ?, replay_requested = ?, version = ?, updated_at = ? WHERE game_id = ?",
          [
            completed ? 1 : 0,
            winner.replayRequested ? 1 : 0,
            winner.version,
            winner.updatedAt,
            t.gameId,
          ],
        );
        c.tutorialsUpdated += 1;
        continue;
      }
    }
    await txn.run(
      "INSERT INTO tutorial_state (game_id, completed, replay_requested, version, updated_at) VALUES (?, ?, ?, ?, ?)",
      [
        t.gameId,
        t.completed ? 1 : 0,
        t.replayRequested ? 1 : 0,
        t.version,
        t.updatedAt,
      ],
    );
    c.tutorialsUpdated += 1;
  }
}

async function writeWorkouts(
  txn: SQLiteAdapter,
  workouts: BackupData["workoutInstances"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  // Workout V3 metadata (current schema v12) rides with the row. Null/absent
  // writes a null cell so an imported legacy row never fabricates provenance.
  const metadataJson = (w: BackupData["workoutInstances"][number]) =>
    w.metadata == null ? null : JSON.stringify(w.metadata);
  for (const w of workouts) {
    const json = JSON.stringify(w.gameIds);
    if (mode === "merge") {
      const ex = await txn.get<{ updated_at: number }>(
        "SELECT updated_at FROM workout_instances WHERE date = ?",
        [w.date],
      );
      if (ex) {
        if (ex.updated_at >= w.updatedAt) {
          continue; // keep the newer/equal existing instance
        }
        await txn.run(
          "UPDATE workout_instances SET game_ids_json = ?, status = ?, current_index = ?, reroll_attempt = ?, seed_version = ?, updated_at = ?, metadata_json = ? WHERE date = ?",
          [
            json,
            w.status,
            w.currentIndex,
            w.rerollAttempt,
            w.seedVersion,
            w.updatedAt,
            metadataJson(w),
            w.date,
          ],
        );
        c.workoutsUpdated += 1;
        continue;
      }
    }
    await txn.run(
      "INSERT INTO workout_instances (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        w.date,
        json,
        w.status,
        w.currentIndex,
        w.rerollAttempt,
        w.seedVersion,
        w.createdAt,
        w.updatedAt,
        metadataJson(w),
      ],
    );
    c.workoutsUpdated += 1;
  }
}

async function writeQuestDefinitions(
  txn: SQLiteAdapter,
  defs: BackupData["questDefinitions"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const q of defs) {
    if (mode === "merge") {
      const ex = await txn.get<{ version: number }>(
        "SELECT version FROM quests WHERE id = ?",
        [q.id],
      );
      if (ex) {
        if (ex.version >= q.version) continue;
        await txn.run(
          "UPDATE quests SET kind = ?, title = ?, description = ?, criteria_json = ?, reward_xp = ?, reward_currency = ?, version = ? WHERE id = ?",
          [
            q.kind,
            q.title,
            q.description,
            toJson(q.criteria),
            q.rewardXp,
            q.rewardCurrency,
            q.version,
            q.id,
          ],
        );
        c.questDefinitionsUpdated += 1;
        continue;
      }
    }
    await txn.run(
      "INSERT INTO quests (id, kind, title, description, criteria_json, reward_xp, reward_currency, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        q.id,
        q.kind,
        q.title,
        q.description,
        toJson(q.criteria),
        q.rewardXp,
        q.rewardCurrency,
        q.version,
      ],
    );
    c.questDefinitionsUpdated += 1;
  }
}

async function writeQuestProgress(
  txn: SQLiteAdapter,
  progress: BackupData["questProgress"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const p of progress) {
    if (mode === "merge") {
      const ex = await txn.get<{
        progress: number;
        completed_at: number | null;
        claimed_at: number | null;
      }>(
        "SELECT progress, completed_at, claimed_at FROM quest_progress WHERE quest_id = ? AND period = ?",
        [p.questId, p.period],
      );
      if (ex) {
        const progressVal = Math.max(ex.progress, p.progress);
        const completedAt = ex.completed_at ?? p.completedAt;
        const claimedAt = ex.claimed_at ?? p.claimedAt;
        await txn.run(
          "UPDATE quest_progress SET progress = ?, completed_at = ?, claimed_at = ? WHERE quest_id = ? AND period = ?",
          [progressVal, completedAt, claimedAt, p.questId, p.period],
        );
        c.questProgressUpdated += 1;
        continue;
      }
    }
    await txn.run(
      "INSERT INTO quest_progress (quest_id, period, progress, completed_at, claimed_at) VALUES (?, ?, ?, ?, ?)",
      [p.questId, p.period, p.progress, p.completedAt, p.claimedAt],
    );
    c.questProgressUpdated += 1;
  }
}

async function writeAchievementDefinitions(
  txn: SQLiteAdapter,
  defs: BackupData["achievementDefinitions"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const d of defs) {
    if (mode === "merge") {
      const ex = await txn.get<{ version: number }>(
        "SELECT version FROM achievements WHERE id = ?",
        [d.id],
      );
      if (ex) {
        if (ex.version >= d.version) continue;
        await txn.run(
          "UPDATE achievements SET title = ?, description = ?, criteria_json = ?, reward_xp = ?, reward_currency = ?, version = ? WHERE id = ?",
          [
            d.title,
            d.description,
            toJson(d.criteria),
            d.rewardXp,
            d.rewardCurrency,
            d.version,
            d.id,
          ],
        );
        c.achievementDefinitionsUpdated += 1;
        continue;
      }
    }
    await txn.run(
      "INSERT INTO achievements (id, title, description, criteria_json, reward_xp, reward_currency, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        d.id,
        d.title,
        d.description,
        toJson(d.criteria),
        d.rewardXp,
        d.rewardCurrency,
        d.version,
      ],
    );
    c.achievementDefinitionsUpdated += 1;
  }
}

async function writeAchievementUnlocks(
  txn: SQLiteAdapter,
  unlocks: BackupData["achievementUnlocks"],
  mode: ImportMode,
  c: ImportCounters,
): Promise<void> {
  for (const u of unlocks) {
    if (mode === "merge") {
      const ex = await txn.get<{
        unlocked_at: number;
        claimed_at: number | null;
      }>(
        "SELECT unlocked_at, claimed_at FROM achievement_unlocks WHERE achievement_id = ?",
        [u.achievementId],
      );
      if (ex) {
        const unlockedAt = Math.min(ex.unlocked_at, u.unlockedAt);
        const claimedAt = ex.claimed_at ?? u.claimedAt;
        await txn.run(
          "UPDATE achievement_unlocks SET unlocked_at = ?, claimed_at = ? WHERE achievement_id = ?",
          [unlockedAt, claimedAt, u.achievementId],
        );
        c.achievementUnlocksUpdated += 1;
        continue;
      }
    }
    await txn.run(
      "INSERT INTO achievement_unlocks (achievement_id, unlocked_at, claimed_at) VALUES (?, ?, ?)",
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
  // Defensive within-backup dedup (task C): a corrupt backup may contain
  // accidental duplicate rows. Collapsing them by natural key before insert
  // keeps a replace import from tripping the partial unique index on
  // `currency_ledger.operation_id` and prevents self-collision on the primary
  // keys of the other tables. Well-formed backups are unaffected (no dups).
  const gameSessions = dedupeNonNullKey(data.gameSessions, (s) => s.id);
  const domainRatings = dedupeNonNullKey(data.domainRatings, (d) => d.domain);
  const ratingHistory = dedupeNonNullKey(data.ratingHistory, (r) =>
    composite(r.sessionId, r.domain),
  );
  const currencyLedger = dedupeNonNullKey(
    data.currencyLedger,
    (e) => e.operationId,
  );
  const gameFavorites = dedupeNonNullKey(data.gameFavorites, (f) => f.gameId);
  const tutorialState = dedupeNonNullKey(data.tutorialState, (t) => t.gameId);
  const workoutInstances = dedupeNonNullKey(
    data.workoutInstances,
    (w) => w.date,
  );
  const questDefinitions = dedupeNonNullKey(data.questDefinitions, (q) => q.id);
  const questProgress = dedupeNonNullKey(data.questProgress, (q) =>
    composite(q.questId, q.period),
  );
  const achievementDefinitions = dedupeNonNullKey(
    data.achievementDefinitions,
    (a) => a.id,
  );
  const achievementUnlocks = dedupeNonNullKey(
    data.achievementUnlocks,
    (a) => a.achievementId,
  );
  // Stable reward sources are deduped by their logical identity; generic
  // awards remain distinct even when their payload fields happen to match.
  const xpAwards = dedupeNonNullKey(data.xpAwards, xpAwardIdentity);

  if (mode === "replace") {
    // The append-only DELETE triggers are dropped at the CONNECTION level by the
    // caller (`applyImport` / `clearTablesIgnoringTriggers`) before this
    // transaction opens — the old `PRAGMA triggers = OFF` approach is a
    // removed/no-op pragma in modern SQLite and cannot be used inside a
    // transaction. The clear runs in this same transaction, so any failure
    // rolls it back and the caller re-creates the triggers.
    for (const table of FK_DELETE_ORDER) {
      await txn.exec(`DELETE FROM ${table}`);
    }
  }

  await writeProfile(txn, data.profile, mode, c);
  await writeFavorites(txn, gameFavorites, mode, c);
  await writeDomainRatings(txn, domainRatings, mode, c);
  await writeSessions(txn, gameSessions, mode, c);
  await writeRatingHistory(txn, ratingHistory, mode, c);
  await writeLedger(txn, currencyLedger, mode, c);
  await writeXpAwards(txn, xpAwards, mode, c);
  await writeTutorial(txn, tutorialState, mode, c);
  await writeWorkouts(txn, workoutInstances, mode, c);
  await writeQuestDefinitions(txn, questDefinitions, mode, c);
  await writeQuestProgress(txn, questProgress, mode, c);
  await writeAchievementDefinitions(txn, achievementDefinitions, mode, c);
  await writeAchievementUnlocks(txn, achievementUnlocks, mode, c);
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
  if (mode === "replace") {
    // The append-only DELETE triggers must be removed at the connection level
    // (the legacy `PRAGMA triggers` is gone from modern SQLite and a no-op
    // inside a transaction). Drop + clear + re-insert all happen inside the
    // guarded region so the exact same triggers are ALWAYS recreated — even
    // when the drop DDL itself fails midway (campaign 011 W12 finding).
    const triggers = await captureTriggers(db);
    try {
      await dropTriggers(db, triggers);
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
  const c = emptyCounters("replace");
  await adapter.transaction(async (txn) => {
    await applyData(txn, parsed.data, "replace", c);
  });
  return adapter;
}
