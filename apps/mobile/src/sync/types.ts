/**
 * Sync-readiness seam types (campaign 010 W20; campaign 009 debt D3).
 *
 * This module FREEZES the vocabulary a future signed-in sync will use —
 * without any network code, backend calls, or schema changes (constitution
 * §6: sync is deferred, but "data-type-specific conflict semantics are
 * required where relevant"). Everything here is pure typing + deterministic
 * pure functions; nothing imports the network, nothing mutates the database.
 *
 * Naming note: `src/progression/sync.ts` is an unrelated, older use of the
 * word "sync" (re-evaluating quest/achievement progress against local
 * history). Network-sync code lives HERE and only here.
 */

/**
 * Revision of the DTO convention itself. Bump when the mandatory DTO shape
 * changes so future payloads can declare which convention they speak.
 * Readers never reject on this value; it is provenance only.
 */
export const SYNC_DTO_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Sync DTO convention                                                 */
/* ------------------------------------------------------------------ */

/**
 * Mandatory base shape of every record that crosses a sync boundary.
 *
 * Convention (debt D3): every syncable row carries
 * - `id`        — stable string identity. Locally unique today; globally
 *                 unique once records are namespaced by device instance id
 *                 (see the W20 packet report — no schema change made yet).
 * - `updatedAt` — Unix epoch ms of the last mutation. The ONLY ordering
 *                 authority for last-write-wins decisions.
 * - `deleted`   — tombstone flag. Deletions are soft: a row is never
 *                 physically removed while syncable; it is marked deleted
 *                 so the deletion can propagate to other devices. Append-only
 *                 tables (ledger/history/awards) have no deletions at all.
 */
export interface SyncDto {
  readonly id: string;
  readonly updatedAt: number;
  readonly deleted: boolean;
}

/**
 * Provenance fields a future transport may attach to any DTO. Optional now;
 * declared here so producers converge on one spelling instead of inventing
 * per-field names later.
 */
export interface SyncProvenance {
  /** Device instance id that last mutated the record (future migration). */
  readonly originDeviceId?: string;
  /** Sync engine revision that produced the payload (provenance only). */
  readonly dtoVersion?: number;
}

/** A syncable record with optional provenance attached by a transport. */
export type SyncRecord<T> = T & SyncProvenance;

/* ------------------------------------------------------------------ */
/* Table inventory                                                     */
/* ------------------------------------------------------------------ */

/**
 * Every authoritative LOCAL table that a future sync must consider. Mirrors
 * the SQLite model (`db/schema.ts`) and the backup sections
 * (`data-portability/types.ts` BackupData) minus app-shipped content:
 * `quests` / `achievements` definitions are seeded from versioned in-code
 * definition modules, not player-authored, so they ship with the app instead
 * of syncing.
 */
export type SyncTableName =
  | 'profile'
  | 'game_sessions'
  | 'domain_ratings'
  | 'rating_history'
  | 'currency_ledger'
  | 'game_favorites'
  | 'xp_awards'
  | 'tutorial_state'
  | 'workout_instances'
  | 'quest_progress'
  | 'achievement_unlocks';

/**
 * How a table's rows merge when the same logical record changed on two
 * devices (constitution §6 examples in parentheses):
 *
 * - `'last-write-wins'` — whole-row LWW on `updatedAt`; fine for rows where
 *   one device is simply newer (profile settings, tutorial state).
 * - `'field-merge'`     — per-field rules; for mutable rows where independent
 *   edits should both survive ("preserve valid bests").
 * - `'append-only'`     — rows are immutable events; merging is union by
 *   natural key with idempotency, never comparison ("keep both completed
 *   sessions", "merge ledger entries", "reconstruct streak state from
 *   activity history").
 */
export type SyncMergeClass = 'last-write-wins' | 'field-merge' | 'append-only';

/** Per-table sync contract. One descriptor per {@link SyncTableName}. */
export interface SyncTableDescriptor {
  readonly table: SyncTableName;
  readonly mergeClass: SyncMergeClass;
  /**
   * Natural idempotency key used instead of the row's physical key when the
   * physical key cannot be globally unique. Required for append-only tables
   * whose SQLite PK is AUTOINCREMENT (`currency_ledger`, `rating_history`,
   * `xp_awards`): integer PKs collide across devices, so merges dedupe on
   * e.g. `operation_id` / `(session_id, domain)` / `(source, reason,
   * created_at)`. Omitted when the primary key itself is the natural key.
   */
  readonly naturalKey?: readonly string[];
  /**
   * True when the table can reconstruct its state from other tables, so a
   * future sync may choose to sync only the underlying evidence instead of
   * the derived rows ("reconstruct streak state from activity history",
   * constitution §6). Derived rows still sync as a fallback for clients that
   * lack the evidence.
   */
  readonly derived?: boolean;
}

/**
 * The frozen per-table contract. Order is stable (schema creation order) so
 * diagnostics and future batch payloads iterate deterministically.
 */
export const SYNC_TABLE_DESCRIPTORS: readonly SyncTableDescriptor[] = [
  {
    table: 'profile',
    mergeClass: 'field-merge',
    // Singleton row keyed by LOCAL_PROFILE_ID; settings_json merges per field.
  },
  { table: 'game_sessions', mergeClass: 'append-only' },
  { table: 'domain_ratings', mergeClass: 'field-merge' },
  {
    table: 'rating_history',
    mergeClass: 'append-only',
    naturalKey: ['session_id', 'domain'],
    derived: true, // reconstructable from game_sessions via the rating service
  },
  {
    table: 'currency_ledger',
    mergeClass: 'append-only',
    // operation_id is the v6+ idempotency key (db/schema.ts migration 6);
    // legacy NULL-operation rows fall back to (session_id, reason, created_at).
    naturalKey: ['operation_id'],
  },
  { table: 'game_favorites', mergeClass: 'last-write-wins' },
  {
    table: 'xp_awards',
    mergeClass: 'append-only',
    // New quest rewards include the period in `source` (`quest:<id>:<period>`)
    // and achievement/milestone rewards are one-shot. Legacy/generic awards
    // fall back to their full event payload until a future durable event id is
    // available.
    naturalKey: ['source', 'reason'],
  },
  { table: 'tutorial_state', mergeClass: 'field-merge' },
  {
    table: 'workout_instances',
    mergeClass: 'field-merge',
    // Keyed by local calendar date — dates are device-local (constitution §14),
    // so cross-device merges assume a shared time zone or accept per-device
    // duplicates; documented here, decided by the future sync design.
  },
  {
    table: 'quest_progress',
    mergeClass: 'field-merge',
    naturalKey: ['quest_id', 'period'],
  },
  { table: 'achievement_unlocks', mergeClass: 'append-only' },
];

/** All table names, derived from the descriptors so they cannot drift. */
export const SYNC_TABLE_NAMES: readonly SyncTableName[] = SYNC_TABLE_DESCRIPTORS.map(
  (d) => d.table,
);

/** Look up the frozen descriptor for a table. Throws on unknown names. */
export function syncTableDescriptor(table: SyncTableName): SyncTableDescriptor {
  const found = SYNC_TABLE_DESCRIPTORS.find((d) => d.table === table);
  if (!found) {
    throw new Error(`No sync descriptor registered for table "${table}"`);
  }
  return found;
}
