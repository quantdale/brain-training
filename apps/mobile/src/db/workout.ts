/**
 * Persistent workout instances (constitution §14; 006R tasks 6.1–6.6;
 * Campaign 010 Workout Engine V2).
 *
 * One row per workout instance. The primary key (`date` column) is a string
 * INSTANCE KEY (see `@/workout/metadata`): the default daily workout keeps
 * the bare local date (`2026-08-21`) — byte-compatible with pre-V2 rows —
 * while template workouts (focus/domain-targeted, started by the player)
 * use namespaced keys `<date>::<templateId>::<length>`. No schema change is
 * required for either.
 *
 * Selection itself is computed by the pure layers (`@/workout/personalize`
 * for the daily mix, `@/workout/templates` for templates); this repository
 * only persists instances, advances/resumes/rerolls them, answers history
 * queries and builds completion summaries. Keeping selection pure and
 * persistence here lets the data layer be unit-tested without UI/emulator.
 *
 * V3 metadata (`templateId`, length, focus, generation inputs) persists into
 * the schema-v10 `metadata_json` column, detected once per connection for
 * compatibility with legacy adapters. If an older adapter omits the column,
 * the repository keeps the core instance usable and simply omits metadata;
 * current migrated databases round-trip it and parse it defensively.
 */
import type { SQLiteAdapter } from "./adapter";
import type { GameSessionRecord, SQLiteValue } from "./types";
import { applyWorkoutPositionCas } from "./workout-cas";
import { reconcileWorkout } from "@/workout/reconcile";
import {
  parseWorkoutMetadata,
  type WorkoutMetadata,
} from "@/workout/metadata";
import {
  buildWorkoutSummary,
  type WorkoutCompletionSummary,
  type WorkoutSessionRef,
} from "@/workout/summary";
import {
  MAX_WORKOUT_GAME_IDS,
} from "@/workout/templates";
import type { WorkoutSelectionReason } from "@/workout/personalize";
import { nextDate } from "@/workout/today";
import {
  isWorkoutSessionProvenance,
  type WorkoutSessionProvenance,
} from "@/workout/session-provenance";

export type WorkoutStatus = "active" | "completed";

/**
 * Caller-observed row snapshot a reroll must still match to commit (059).
 * The hook passes the row it selected from so a concurrent advance/reroll
 * between selection and write loses loudly instead of being overwritten.
 */
export interface RerollBaseline {
  readonly rerollAttempt: number;
  readonly currentIndex: number;
  readonly gameIds: readonly string[];
}

/**
 * Raw row state observed by a repair read, used as the repair write's
 * compare-and-swap predicate (065). `gameIdsJson` carries the exact stored
 * bytes so the conditional write never rewrites a list that changed between
 * observation and UPDATE/DELETE. `instance` is the parsed view of the very
 * same row, used to compute the repair.
 */
export interface WorkoutRepairObservation {
  readonly date: string;
  /** Exact `game_ids_json` bytes read (raw, not canonicalised). */
  readonly gameIdsJson: string;
  readonly status: WorkoutStatus;
  readonly currentIndex: number;
  readonly instance: WorkoutInstance;
}

/**
 * Thrown when a workout write's compare-and-swap precondition fails: the
 * row changed under the caller (concurrent advance/reroll). Callers refresh
 * and surface honestly instead of silently overwriting (059).
 */
export class WorkoutWriteConflictError extends Error {
  constructor(key: string) {
    super(`workout changed under write for key ${key}: refresh and retry`);
    this.name = "WorkoutWriteConflictError";
  }
}

export interface WorkoutInstance {
  /** Instance key: bare local date (daily) or `<date>::<templateId>::<length>`. */
  date: string;
  /** Ordered game-id selection, as chosen by the selector. */
  gameIds: string[];
  /** 'active' until the last game is durably completed. */
  status: WorkoutStatus;
  /** Next game to play (0-based resume point). */
  currentIndex: number;
  /** Number of rerolls applied today (0 = base selection). Persisted (6.5). */
  rerollAttempt: number;
  /** Selector/profile version used to produce this selection (provenance). */
  seedVersion: number;
  createdAt: number;
  updatedAt: number;
  /** Versioned V3 metadata; undefined on legacy rows / legacy schemas. */
  metadata?: WorkoutMetadata;
  /**
   * Leg indices the player deliberately skipped (073). Distinct from
   * "completed": a skipped leg has no session, no reward, and must never be
   * shown as Done. Legacy rows (and legacy schemas) read as an empty list.
   */
  skippedIndices: number[];
}

/** Result of the ownership-checked, one-shot workout transition. */
export interface WorkoutAdvanceResult {
  /** True only for the caller that changed the durable resume position. */
  advanced: boolean;
  /** Current persisted instance after the conditional transition, if present. */
  instance: WorkoutInstance | null;
}

interface WorkoutRow {
  date: string;
  game_ids_json: string;
  status: WorkoutStatus;
  current_index: number;
  reroll_attempt: number;
  seed_version: number;
  created_at: number;
  updated_at: number;
  /** Present on current schema rows; optional for legacy adapter fixtures. */
  metadata_json?: string | null;
  /** v13+: JSON array of skipped leg indices; optional for legacy fixtures. */
  skipped_indices_json?: string | null;
}

function rowToInstance(row: WorkoutRow): WorkoutInstance {
  let gameIds: string[] = [];
  try {
    const parsed = JSON.parse(row.game_ids_json);
    if (Array.isArray(parsed)) {
      gameIds = parsed.filter((g): g is string => typeof g === "string");
    }
  } catch {
    gameIds = [];
  }
  let metadata: WorkoutMetadata | undefined;
  if (typeof row.metadata_json === "string") {
    try {
      metadata = parseWorkoutMetadata(JSON.parse(row.metadata_json));
    } catch {
      metadata = undefined;
    }
  }
  return {
    date: row.date,
    gameIds,
    status: row.status,
    currentIndex: row.current_index,
    rerollAttempt: row.reroll_attempt,
    seedVersion: row.seed_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    skippedIndices: parseSkippedIndices(row.skipped_indices_json, gameIds.length),
    ...(metadata ? { metadata } : {}),
  };
}

/**
 * Parse the durable skip record defensively (073).
 *
 * Out-of-range and non-integer entries are dropped rather than trusted: the
 * column is JSON written by app code but read across backup round-trips, so a
 * malformed entry must degrade to "not skipped" instead of fabricating a skip
 * for a leg the player played.
 */
function parseSkippedIndices(
  raw: string | null | undefined,
  legCount: number,
): number[] {
  if (typeof raw !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const indices = parsed.filter(
      (value): value is number =>
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value < legCount,
    );
    return [...new Set(indices)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/**
 * Boot janitor for corrupt empty workout rows (059; closes the 056-F8
 * residual). A row whose `game_ids_json` parses to zero playable games —
 * `[]`, corrupt JSON, or a non-array — carries no playable games: backup
 * import rejects such rows, and with a registered catalog selection always
 * fills every slot (an empty catalog fails bootstrap before any workout
 * loads), so in practice only corruption reaches this state. Deletes them
 * (any status) in one transaction and returns the deleted count for
 * evidence. Healthy rows are never touched. Uses the same string-filter
 * as `rowToInstance` so the janitor and the reader agree on what "empty"
 * means.
 */
export async function deleteEmptyWorkoutInstances(
  adapter: SQLiteAdapter,
): Promise<number> {
  const rows = await adapter.all<{ date: string; game_ids_json: string }>(
    "SELECT date, game_ids_json FROM workout_instances",
  );
  const emptyDates: string[] = [];
  for (const row of rows) {
    let gameIds: string[] = [];
    try {
      const parsed: unknown = JSON.parse(row.game_ids_json);
      if (Array.isArray(parsed)) {
        gameIds = parsed.filter((g): g is string => typeof g === "string");
      }
    } catch {
      gameIds = [];
    }
    if (gameIds.length === 0) {
      emptyDates.push(row.date);
    }
  }
  if (emptyDates.length === 0) {
    return 0;
  }
  await adapter.transaction(async (txn) => {
    for (const date of emptyDates) {
      await txn.run("DELETE FROM workout_instances WHERE date = ?", [date]);
    }
  });
  return emptyDates.length;
}

/**
 * Boot reconciliation for lagged workout positions (073 §5).
 *
 * A completed leg whose durable advance never landed — process death between
 * the session commit and the one-shot UI advance — leaves the resume position
 * BEHIND the persisted evidence. Nothing scanned for that: the provenance
 * bridge is in-process and the advance is a ref-guarded effect, so the
 * mismatch survived relaunches and the player was asked to replay a leg they
 * had already played.
 *
 * Walk-forward rule (task 5.3): the position moves only over legs that are
 * PROVABLY settled — a persisted session carrying that leg's exact ownership
 * (instance key, leg index, AND game id), or an explicit skip record. The
 * first leg that is neither is unfinished work and stays current, so this
 * repair can never skip past work the player owes.
 *
 * Idempotent and reward-free by construction: it only moves the resume
 * position through the same compare-and-set every other position write uses,
 * and never touches sessions, XP, or the currency ledger. Bounded: ten active
 * instances, five hundred provenance rows each.
 *
 * Returns the number of positions repaired (evidence for the boot log/tests).
 */
export async function reconcileWorkoutPositions(
  adapter: SQLiteAdapter,
  now: () => number = () => Date.now(),
): Promise<number> {
  const rows = await adapter.all<WorkoutRow>(
    "SELECT * FROM workout_instances WHERE status = 'active' " +
      "ORDER BY updated_at DESC LIMIT 10",
  );
  let repaired = 0;
  for (const row of rows) {
    const instance = rowToInstance(row);
    const legCount = instance.gameIds.length;
    if (legCount === 0) {
      continue;
    }
    const played = await loadPlayedLegs(adapter, instance.date, instance.gameIds);
    if (played === null) {
      // The provenance scan is unavailable on this engine. Reconciliation is
      // a repair, never a requirement: leave every row exactly as it is.
      return repaired;
    }
    const settled = new Set<number>(played);
    for (const skipped of instance.skippedIndices) {
      settled.add(skipped);
    }
    let position = instance.currentIndex;
    while (position < legCount && settled.has(position)) {
      position += 1;
    }
    if (position === instance.currentIndex) {
      continue;
    }
    const status: WorkoutStatus = position >= legCount ? "completed" : "active";
    const updatedAt = now();
    const applied = await applyWorkoutPositionCas(
      (sql: string, params: SQLiteValue[]) => adapter.run(sql, params),
      {
        date: instance.date,
        status: instance.status,
        currentIndex: instance.currentIndex,
        updatedAt: instance.updatedAt,
        rerollAttempt: instance.rerollAttempt,
        seedVersion: instance.seedVersion,
        gameIdsJson: row.game_ids_json,
      },
      'advance',
      [position, status, updatedAt],
    );
    if (applied) {
      repaired += 1;
    }
  }
  return repaired;
}

/**
 * Leg indices of `instanceKey` that a PERSISTED session proves were played.
 *
 * Ownership is read from the stored raw result (the durable record), never
 * from the in-process launch map. The game id is part of the proof: a session
 * for a leg whose game no longer sits at that position does not settle it.
 * Returns null when the scan cannot run (JSON1-less engine) — the caller must
 * then repair nothing rather than guess.
 */
async function loadPlayedLegs(
  adapter: SQLiteAdapter,
  instanceKey: string,
  gameIds: readonly string[],
): Promise<Set<number> | null> {
  try {
    const rows = await adapter.all<{ leg_index: unknown; game_id: unknown }>(
      `SELECT json_extract(raw_result_json, '$.workoutProvenance.legIndex') AS leg_index,
              json_extract(raw_result_json, '$.workoutProvenance.gameId') AS game_id
         FROM game_sessions
        WHERE json_extract(raw_result_json, '$.workoutProvenance.instanceKey') = ?
        LIMIT 500`,
      [instanceKey],
    );
    const legs = new Set<number>();
    for (const row of rows) {
      const leg = row.leg_index;
      if (
        typeof leg === "number" &&
        Number.isSafeInteger(leg) &&
        leg >= 0 &&
        leg < gameIds.length &&
        row.game_id === gameIds[leg]
      ) {
        legs.add(leg);
      }
    }
    return legs;
  } catch {
    return null;
  }
}

/**
 * Reject a malformed or over-bound leg list before it can be persisted
 * (Change 073 §1.3).
 *
 * The shared compare-and-set predicates on the stored BYTES, which detects a
 * concurrent rewrite — but a write aimed at an already-corrupt row (or carrying
 * a corrupt list) must be refused outright rather than laundered into a
 * conditional update. Bound mirrors the import validator's
 * `MAX_WORKOUT_GAME_IDS` so in-app writes and backup restores cannot disagree
 * about what a legal leg list is.
 */
function requireValidLegList(gameIds: unknown, field: string): string[] {
  if (!Array.isArray(gameIds) || gameIds.length === 0) {
    throw new Error(`${field} must be a non-empty array of game ids`);
  }
  if (gameIds.length > MAX_WORKOUT_GAME_IDS) {
    throw new Error(
      `${field} has ${gameIds.length} game ids (the maximum is ${MAX_WORKOUT_GAME_IDS})`,
    );
  }
  for (const gameId of gameIds) {
    if (typeof gameId !== "string" || gameId.trim() === "") {
      throw new Error(`${field} must contain only non-empty game id strings`);
    }
  }
  return gameIds as string[];
}

/**
 * The stored leg list, validated strictly. `rowToInstance` deliberately
 * FILTERS corrupt entries so history stays readable; a WRITE aimed at that row
 * must see the corruption instead of silently rewriting a shorter list.
 */
function storedLegList(row: WorkoutRow): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.game_ids_json);
  } catch {
    throw new Error(`workout instance ${row.date} has corrupt game_ids_json`);
  }
  return requireValidLegList(parsed, `workout instance ${row.date} game list`);
}

/** Exact ownership predicate shared by lookup and the conditional write path. */
function ownsCurrentLeg(
  instance: WorkoutInstance | null,
  provenance: WorkoutSessionProvenance,
): boolean {
  return (
    instance !== null &&
    instance.status === "active" &&
    instance.date === provenance.instanceKey &&
    instance.currentIndex === provenance.legIndex &&
    instance.gameIds[provenance.legIndex] === provenance.gameId
  );
}

/** Session columns needed to build completion summaries. */
interface SummarySessionRow {
  id: string;
  game_id: string;
  normalized_result: number;
  xp: number;
  duration_ms: number;
  completed_at: number;
}

/**
 * Upper bound on host parameters in one IN-list (SQLite limits vary by
 * backend; 400 stays safely under every known default while covering weeks
 * of history at ≤6 games per workout).
 */
const MAX_SUMMARY_GAME_IDS = 400;

/** Options for {@link WorkoutRepository.listHistory}. Everything optional. */
export interface WorkoutHistoryOptions {
  /** Inclusive lower bound on the instance date part (YYYY-MM-DD). */
  from?: string;
  /**
   * Inclusive upper bound on the instance DATE PART. Implemented as an
   * exclusive `date < nextDate(to)` comparison so same-day namespaced
   * template keys (`2026-08-21::focus-memory::short`) are included.
   */
  to?: string;
  /** Max rows (default 30). */
  limit?: number;
  /** Include template instances (default true; false = daily only). */
  includeTemplates?: boolean;
}

export class WorkoutRepository {
  private readonly adapter: SQLiteAdapter;
  private readonly now: () => number;
  /** Cached presence check for the optional `metadata_json` column. */
  private metadataColumn: Promise<boolean> | null = null;

  constructor(adapter: SQLiteAdapter, now: () => number = () => Date.now()) {
    this.adapter = adapter;
    this.now = now;
  }

  /**
   * Whether the schema carries the optional `metadata_json` column (a pending
   * migration adds it; see module comment). Checked once per connection and
   * cached — every write/read path degrades gracefully when absent.
   */
  private hasMetadataColumn(): Promise<boolean> {
    this.metadataColumn ??= this.adapter
      .all<{ name: string }>("PRAGMA table_info(workout_instances)")
      .then(
        (columns) =>
          columns.some((column) => column.name === "metadata_json"),
      )
      .catch(() => false);
    return this.metadataColumn;
  }

  /**
   * Number of DAILY workout instances fully completed (workout completion,
   * §B). Deliberately excludes template instances (namespaced keys) so
   * streak/achievement consumers (`progression/sync.ts`) keep counting daily
   * completions exactly as before template workouts exist.
   */
  async countCompleted(throughDate?: string): Promise<number> {
    if (
      throughDate !== undefined &&
      !/^\d{4}-\d{2}-\d{2}$/.test(throughDate)
    ) {
      throw new Error(`workout completion upper bound must be YYYY-MM-DD (got ${throughDate})`);
    }
    const dateBound = throughDate === undefined ? "" : " AND date <= ?";
    const row = await this.adapter.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM workout_instances WHERE status = 'completed' AND instr(date, '::') = 0${dateBound}`,
      throughDate === undefined ? [] : [throughDate],
    );
    return row?.n ?? 0;
  }

  /**
   * Load a workout instance by key (bare date for the daily workout, or a
   * namespaced template key), or null when none exists.
   */
  async getByDate(date: string): Promise<WorkoutInstance | null> {
    const row = await this.adapter.get<WorkoutRow>(
      "SELECT * FROM workout_instances WHERE date = ?",
      [date],
    );
    return row ? rowToInstance(row) : null;
  }

  /**
   * Get the existing instance for `key`, or create and persist a base
   * instance from `seed` (the selector's output) when none exists. Optional
   * `metadata` is persisted when the schema supports it (and otherwise
   * dropped silently — legacy schemas keep working). Returns the persisted
   * instance. Idempotent per key — `INSERT OR IGNORE` plus a re-read makes
   * concurrent/retried creates safe (e.g. React StrictMode double effects).
   */
  async getOrCreate(
    date: string,
    seed: { gameIds: string[]; seedVersion?: number },
    metadata?: WorkoutMetadata,
  ): Promise<WorkoutInstance> {
    const existing = await this.getByDate(date);
    if (existing) {
      return existing;
    }
    const now = this.now();
    const gameIds = seed.gameIds.slice();
    const seedVersion = seed.seedVersion ?? 0;
    const hasMetadataColumn =
      metadata !== undefined && (await this.hasMetadataColumn());
    if (hasMetadataColumn) {
      await this.adapter.run(
        `INSERT OR IGNORE INTO workout_instances
          (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          date,
          JSON.stringify(gameIds),
          "active",
          0,
          0,
          seedVersion,
          now,
          now,
          JSON.stringify(metadata),
        ],
      );
    } else {
      await this.adapter.run(
        `INSERT OR IGNORE INTO workout_instances
          (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [date, JSON.stringify(gameIds), "active", 0, 0, seedVersion, now, now],
      );
    }
    const persisted = await this.getByDate(date);
    if (persisted) {
      return persisted;
    }
    // Extremely unlikely (IGNORE should have inserted or found a concurrent row);
    // reconstruct from seed as a last resort.
    return {
      date,
      gameIds,
      status: "active",
      currentIndex: 0,
      rerollAttempt: 0,
      seedVersion,
      createdAt: now,
      updatedAt: now,
      // A fresh instance has played and skipped nothing.
      skippedIndices: [],
      ...(metadata ? { metadata } : {}),
    };
  }

  /**
   * Legacy/manual direct advance primitive. Result completion must use
   * `advanceForSession`, which proves the persisted session's ownership and
   * performs a conditional one-shot transition. This helper remains for
   * tests and template flows as an explicit control; UI surfaces must NOT
   * use it to skip legs (056 — use `advanceWorkoutForSession` instead).
   */
  async advance(date: string): Promise<WorkoutInstance> {
    const current = await this.getByDate(date);
    if (!current) {
      throw new Error(`No workout instance for key ${date}`);
    }
    if (current.gameIds.length === 0) {
      // A corrupt/empty row must heal through reconcile → regenerate, never
      // transition to `completed` and be counted (056).
      throw new Error(`Cannot advance an empty workout instance for key ${date}`);
    }
    // Contain a corrupted negative index instead of driving it further
    // negative; reconcile heals the row on the next load (056 F9).
    const nextIndex = Math.min(
      Math.max(current.currentIndex, 0) + 1,
      current.gameIds.length,
    );
    const status: WorkoutStatus =
      nextIndex >= current.gameIds.length ? "completed" : "active";
    const updatedAt = this.now();
    await this.adapter.run(
      "UPDATE workout_instances SET current_index = ?, status = ?, updated_at = ? WHERE date = ?",
      [nextIndex, status, updatedAt, date],
    );
    return { ...current, currentIndex: nextIndex, status, updatedAt };
  }

  /**
   * Observe the raw persisted row a repair would rewrite (065). Split from
   * {@link applyRepair} so the repair write can be compare-and-swapped
   * against the exact state that was observed: a concurrent advance/reroll
   * landing in between must not be overwritten or deleted.
   */
  async observeRepair(date: string): Promise<WorkoutRepairObservation | null> {
    const row = await this.adapter.get<WorkoutRow>(
      "SELECT * FROM workout_instances WHERE date = ?",
      [date],
    );
    if (!row) {
      return null;
    }
    return {
      date: row.date,
      gameIdsJson: row.game_ids_json,
      status: row.status,
      currentIndex: row.current_index,
      instance: rowToInstance(row),
    };
  }

  /**
   * Apply the pure repair computed from `observation` under a
   * compare-and-swap predicate (065). The UPDATE commits only while the row
   * still carries the observed date/index/status and the exact raw
   * `game_ids_json` bytes; the all-stale DELETE only while the same observed
   * state is intact. A row that changed underneath (concurrent
   * `advanceForSession` / `applyReroll`) is never overwritten or deleted —
   * its fresh state is returned instead. Returns `null` only when every
   * stored game is ineligible AND the observed row was actually deleted (the
   * caller should generate a fresh selection).
   */
  async applyRepair(
    observation: WorkoutRepairObservation,
    eligibleIds: ReadonlySet<string> | readonly string[],
  ): Promise<WorkoutInstance | null> {
    const { instance, changed } = reconcileWorkout(
      observation.instance,
      eligibleIds,
    );
    if (!instance) {
      // All stored games retired/ineligible: drop the stale row so a fresh
      // selection can be generated (getOrCreate would otherwise return it).
      // The conditional DELETE must lose to any row that moved underneath
      // (an advance that played a retired leg still owns its progress).
      const deleted = await this.adapter.run(
        `DELETE FROM workout_instances
         WHERE date = ? AND current_index = ? AND status = ? AND game_ids_json = ?`,
        [
          observation.date,
          observation.currentIndex,
          observation.status,
          observation.gameIdsJson,
        ],
      );
      if (deleted.changes > 0) {
        return null;
      }
      // CAS lost: surface the row's fresh state, never a delete that did not
      // happen.
      return this.getByDate(observation.date);
    }
    if (!changed) {
      return instance;
    }
    const committed = await this.persistRepaired(observation, instance);
    return committed ? instance : this.getByDate(observation.date);
  }

  /**
   * Reconcile a persisted instance against the current eligible catalog
   * (Queue A: catalog changes / invalid game IDs / registry drift). Loads the
   * instance for `key`, drops any game ids no longer eligible, advances the
   * resume index past invalidated games, and CAS-persists the repair when
   * anything changed (see {@link applyRepair}). Returns the repaired
   * instance, or `null` when no stored game remains eligible (the caller
   * should generate a fresh selection). A conditional write that loses to a
   * concurrent advance/reroll is not forced: the fresh persisted row is
   * returned instead. Idempotent: a clean instance is returned unchanged
   * without a write.
   */
  async reconcile(
    date: string,
    eligibleIds: ReadonlySet<string> | readonly string[],
  ): Promise<WorkoutInstance | null> {
    const observation = await this.observeRepair(date);
    if (!observation) {
      return null;
    }
    return this.applyRepair(observation, eligibleIds);
  }

  /**
   * Conditionally persist a repaired instance (shared by reconcile/
   * reconcileActiveInstances). Returns false when the CAS predicate matched
   * no row — the observed state changed underneath and nothing was written.
   */
  private async persistRepaired(
    observation: WorkoutRepairObservation,
    instance: WorkoutInstance,
  ): Promise<boolean> {
    const updatedAt = this.now();
    const applied = await this.adapter.run(
      `UPDATE workout_instances
       SET game_ids_json = ?, current_index = ?, status = ?, updated_at = ?
       WHERE date = ? AND current_index = ? AND status = ? AND game_ids_json = ?`,
      [
        JSON.stringify(instance.gameIds),
        instance.currentIndex,
        instance.status,
        updatedAt,
        observation.date,
        observation.currentIndex,
        observation.status,
        observation.gameIdsJson,
      ],
    );
    return applied.changes > 0;
  }

  /**
   * Apply a reroll: persist the new `rerollAttempt` count and replace only the
   * UNPLAYED (future) positions with `newGameIds`, keeping the already
   * completed prefix immutable (006R task 6.6). Completed positions are
   * `[0, currentIndex)`; the reroll may only change `[currentIndex, len)`.
   *
   * POSITIONAL convention: entries of `newGameIds` below `currentIndex` are
   * placeholders that are discarded (callers conventionally repeat the played
   * prefix there), and positions `[currentIndex, len)` are taken from
   * `newGameIds.slice(currentIndex)`. Callers whose selector returns a
   * fresh-only list (played ids passed as `exclude`) must prepend the played
   * prefix before calling — see `useWorkout().reroll()` — or the first fresh
   * games would be sliced off. The total instance length is preserved when
   * `newGameIds.length >= current.gameIds.length`. The currency cost is
   * handled by the caller (economy layer, task 7.4/6.5).
   */
  async applyReroll(
    date: string,
    newGameIds: string[],
    newAttempt: number,
    expected?: RerollBaseline,
  ): Promise<WorkoutInstance> {
    // Read the raw row (not just the parsed instance): the conditional UPDATE
    // below predicates on the exact `game_ids_json` bytes read here (065).
    const row = await this.adapter.get<WorkoutRow>(
      "SELECT * FROM workout_instances WHERE date = ?",
      [date],
    );
    if (!row) {
      throw new Error(`No workout instance for key ${date}`);
    }
    const current = rowToInstance(row);
    // 073 §1.3: validate the STORED list strictly and the incoming one too.
    // `rowToInstance` filters corrupt entries so history stays readable; a
    // write aimed at that row must see the corruption and refuse instead of
    // laundering a shorter or over-bound list through the conditional update.
    const storedList = storedLegList(row);
    const incoming = requireValidLegList(newGameIds, 'applyReroll newGameIds');
    if (current.gameIds.length === 0) {
      // Same corrupt-row guard as `advance`: rerolling an empty instance
      // would fabricate games onto a row that must regenerate instead (056).
      throw new Error(`Cannot reroll an empty workout instance for key ${date}`);
    }
    const completedPrefix = storedList.slice(0, current.currentIndex);
    const future = incoming.slice(current.currentIndex);
    const merged = [...completedPrefix, ...future];
    const updatedAt = this.now();
    // Compare-and-swap on the caller's read snapshot when provided (the
    // hook passes the row it selected from), else on this call's fresh
    // read. A concurrent advance shifts the positional merge base and a
    // concurrent reroll bumps the attempt — either must lose loudly
    // instead of resurrecting played legs or double-applying. Mirrors
    // advanceForSession's conditional-write discipline.
    //
    // The list comparison uses canonical forms on both sides (059/i): a
    // hand-edited row may store non-canonical JSON (whitespace, filtered
    // members) that still parses to the same playable list. That leniency
    // is preserved for the CALLER baseline; the UPDATE additionally
    // predicates on the raw bytes read in THIS call (065), closing the
    // race where another writer rewrites the stored list between that read
    // and the write. Bytes come from this call's own read, so a
    // non-canonical row still commits its first reroll.
    const baseline = expected ?? current;
    if (
      JSON.stringify(baseline.gameIds) !== JSON.stringify(current.gameIds)
    ) {
      throw new WorkoutWriteConflictError(date);
    }
    // 073 (D5): both writers now go through the ONE compare-and-set in
    // `workout-cas.ts`. They were hand-written copies that drifted — the reroll
    // omitted `status = 'active'` (and previously `updated_at` / `seed_version`),
    // so a reroll could rewrite the game list of a COMPLETED workout and
    // resurrect future legs onto a finished row. Two copies of one invariant is
    // not one invariant.
    const applied = await applyWorkoutPositionCas(
      (sql: string, params: SQLiteValue[]) => this.adapter.run(sql, [...params]),
      {
        date,
        status: current.status,
        currentIndex: baseline.currentIndex,
        // The row read in THIS call is the authority for the fields the caller's
        // baseline does not carry; the baseline only overrides the ones the
        // caller actually selected on. This is also what the previous statement
        // compared against, so a first reroll on a non-canonical row still
        // commits (059/i leniency) while a stale reroll still loses.
        updatedAt: current.updatedAt,
        rerollAttempt: baseline.rerollAttempt,
        seedVersion: current.seedVersion,
        gameIdsJson: row.game_ids_json,
      },
      'reroll',
      [JSON.stringify(merged), newAttempt, updatedAt],
    );
    if (!applied) {
      throw new WorkoutWriteConflictError(date);
    }
    return {
      ...current,
      gameIds: merged,
      rerollAttempt: newAttempt,
      updatedAt,
    };
  }

  /* ---------------------------------------------------------------- *
   * Workout Engine V2 — history, routing, batch reconciliation
   * ---------------------------------------------------------------- */

  /**
   * Queryable workout history (mission: "workout history — queryable record
   * of past workouts + completion state"). Rows come back newest-first via
   * the primary key: within a day the daily row sorts before its namespaced
   * template rows ('2026-08-21' < '2026-08-21::…'), and everything sorts
   * before the next day. Completion state is derivable per row via
   * `status`/`currentIndex` or {@link getWorkoutSummary}.
   */
  async listHistory(
    options: WorkoutHistoryOptions = {},
  ): Promise<WorkoutInstance[]> {
    const limit = Math.max(1, options.limit ?? 30);
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (options.from) {
      clauses.push("date >= ?");
      params.push(options.from);
    }
    if (
      options.to &&
      /^\d{4}-\d{2}-\d{2}$/.test(options.to)
    ) {
      // Exclusive next-day bound keeps same-day `::<template>` keys in range.
      clauses.push("date < ?");
      params.push(nextDate(options.to));
    }
    if (options.includeTemplates === false) {
      clauses.push("instr(date, '::') = 0");
    }
    const where =
      clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    // Two-key sort honoring the documented W22 contract: newest DAY first,
    // and within one day the bare-date daily row before its namespaced
    // template rows ('2026-08-21' < '2026-08-21::…'). A plain `date DESC`
    // would invert the within-day half (namespaced keys sort after their
    // bare date), which silently mis-ordered history screens. Row counts are
    // tiny (days × few templates), so the expression sort is negligible.
    const rows = await this.adapter.all<WorkoutRow>(
      `SELECT * FROM workout_instances ${where} ORDER BY substr(date, 1, 10) DESC, date ASC LIMIT ?`,
      [...params, limit],
    );
    return rows.map(rowToInstance);
  }

  /**
   * Most recent instances across ALL workout kinds (daily + templates),
   * newest instance key first (campaign 010 W22, resolving W08's
   * NEEDS_PARENT request). The bounded "latest N workouts" read for overview
   * screens: one indexed primary-key walk instead of a per-day `getByDate`
   * loop. Ordering matches {@link listHistory}: within a day the daily row
   * sorts before its namespaced template rows ('2026-08-21' < '2026-08-21::…').
   */
  async listRecent(limit = 30): Promise<WorkoutInstance[]> {
    return this.listHistory({ limit });
  }

  /**
   * Active instances, most recently touched first (bounded). Used for bounded
   * inspection and by {@link reconcileActiveInstances}; recency is never an
   * ownership decision for completed game sessions.
   */
  async listActiveInstances(limit = 20): Promise<WorkoutInstance[]> {
    const rows = await this.adapter.all<WorkoutRow>(
      "SELECT * FROM workout_instances WHERE status = 'active' ORDER BY updated_at DESC LIMIT ?",
      [Math.max(1, limit)],
    );
    return rows.map(rowToInstance);
  }

  /**
   * Resolve the exact workout row and leg that launched a completed session.
   * No timestamp, recency or game-id-only fallback is allowed: an old or
   * standalone session has no ownership and therefore cannot advance anything.
   */
  async findActiveInstanceForSession(
    session: Pick<GameSessionRecord, "gameId" | "workoutProvenance">,
  ): Promise<WorkoutInstance | null> {
    const provenance = session.workoutProvenance;
    if (
      !isWorkoutSessionProvenance(provenance) ||
      provenance.gameId !== session.gameId
    ) {
      return null;
    }
    const instance = await this.getByDate(provenance.instanceKey);
    return ownsCurrentLeg(instance, provenance) ? instance : null;
  }

  /**
   * Advance exactly one owned leg at the persistence boundary. The conditional
   * UPDATE makes duplicate result effects, process relaunch and concurrent
   * daily/focus result hooks harmless: only the transaction that still sees
   * the same instance key, index, game list and row version can move it.
   */
  async advanceForSession(
    session: Pick<GameSessionRecord, "gameId" | "workoutProvenance">,
  ): Promise<WorkoutAdvanceResult> {
    const provenance = session.workoutProvenance;
    if (
      !isWorkoutSessionProvenance(provenance) ||
      provenance.gameId !== session.gameId
    ) {
      return { advanced: false, instance: null };
    }

    return this.adapter.transaction(async (txn) => {
      const row = await txn.get<WorkoutRow>(
        "SELECT * FROM workout_instances WHERE date = ?",
        [provenance.instanceKey],
      );
      const current = row ? rowToInstance(row) : null;
      if (!row || !current) {
        return { advanced: false, instance: current };
      }
      if (!ownsCurrentLeg(current, provenance)) {
        return { advanced: false, instance: current };
      }

      const nextIndex = Math.min(
        current.currentIndex + 1,
        current.gameIds.length,
      );
      const status: WorkoutStatus =
        nextIndex >= current.gameIds.length ? "completed" : "active";
      const updatedAt = this.now();
      // 073 (D5): the SAME compare-and-set the reroll uses, so the two writers
      // cannot drift again. The predicate and its binding order come from
      // `workout-cas.ts`; only the SET clause and its values are this writer's.
      const update = await applyWorkoutPositionCas(
        (sql: string, params: SQLiteValue[]) => txn.run(sql, [...params]),
        {
          date: provenance.instanceKey,
          status: current.status,
          currentIndex: current.currentIndex,
          updatedAt: current.updatedAt,
          rerollAttempt: current.rerollAttempt,
          seedVersion: current.seedVersion,
          gameIdsJson: row.game_ids_json,
        },
        'advance',
        [nextIndex, status, updatedAt],
      );
      if (!update) {
        const latestRow = await txn.get<WorkoutRow>(
          "SELECT * FROM workout_instances WHERE date = ?",
          [provenance.instanceKey],
        );
        return {
          advanced: false,
          instance: latestRow ? rowToInstance(latestRow) : null,
        };
      }
      return {
        advanced: true,
        instance: {
          ...current,
          currentIndex: nextIndex,
          status,
          updatedAt,
        },
      };
    });
  }

  /**
   * Record the unplayed legs before `targetIndex` as SKIPPED and move the
   * resume position there, in ONE conditional write (073 D4).
   *
   * Serves both transitions the design folds into one:
   * - a single skip (`targetIndex = currentIndex + 1`), and
   * - an explicit jump to a later leg from Home, whose prefix the player
   *   chose to leave — the jump must record that, or the app would claim the
   *   prefix as completed work it never did.
   *
   * Bounds are validated before the write: the target must be a real future
   * leg inside the list, and the FINAL leg cannot be consumed by a skip —
   * a completed workout must always contain at least one played leg, which is
   * what keeps the `workout-completions` achievements from being farmed with
   * zero play. The caller-facing allowance copy lives in `workout/skip.ts`.
   */
  async skipToLeg(date: string, targetIndex: number): Promise<WorkoutInstance | null> {
    return this.adapter.transaction(async (txn) => {
      const row = await txn.get<WorkoutRow>(
        "SELECT * FROM workout_instances WHERE date = ?",
        [date],
      );
      const current = row ? rowToInstance(row) : null;
      if (!row || !current) {
        return null;
      }
      if (current.status !== "active") {
        // A completed workout is historical record; its legs are never
        // re-decided as skipped after the fact.
        return current;
      }
      // 073 §1.3: a write aimed at a row whose stored leg list is corrupt or
      // over-bound must refuse rather than record skips against a list the
      // reader cannot trust.
      const legCount = storedLegList(row).length;
      if (
        !Number.isSafeInteger(targetIndex) ||
        targetIndex <= current.currentIndex ||
        targetIndex > legCount - 1
      ) {
        throw new Error(
          `skipToLeg: target ${targetIndex} is not a skippable leg of "${date}" ` +
            `(position ${current.currentIndex}, ${legCount} legs)`,
        );
      }
      const skipped = new Set(current.skippedIndices);
      // A leg is recorded as skipped only when the player did NOT play it:
      // in the kill window (session committed, advance never ran) the
      // position lags the evidence, and a jump over such a leg must not
      // rewrite played work as "skipped". The played set is read from the
      // sessions' STORED provenance (the same proof the advance requires).
      const played =
        (await loadPlayedLegs(txn, date, current.gameIds)) ?? new Set<number>();
      for (let index = current.currentIndex; index < targetIndex; index += 1) {
        if (!played.has(index)) {
          skipped.add(index);
        }
      }
      const skippedJson = JSON.stringify([...skipped].sort((a, b) => a - b));
      const status: WorkoutStatus =
        targetIndex >= legCount ? "completed" : "active";
      const updatedAt = this.now();
      // The SAME compare-and-set as every other position write (073 D5), with
      // the skip SET clause: recording the skips and moving the position are
      // one write, so a crash between them cannot lose the skip record.
      const update = await applyWorkoutPositionCas(
        (sql: string, params: SQLiteValue[]) => txn.run(sql, [...params]),
        {
          date,
          status: current.status,
          currentIndex: current.currentIndex,
          updatedAt: current.updatedAt,
          rerollAttempt: current.rerollAttempt,
          seedVersion: current.seedVersion,
          gameIdsJson: row.game_ids_json,
        },
        'skipTo',
        [targetIndex, status, skippedJson, updatedAt],
      );
      if (!update) {
        const latestRow = await txn.get<WorkoutRow>(
          "SELECT * FROM workout_instances WHERE date = ?",
          [date],
        );
        return latestRow ? rowToInstance(latestRow) : null;
      }
      return {
        ...current,
        currentIndex: targetIndex,
        status,
        skippedIndices: [...skipped].sort((a, b) => a - b),
        updatedAt,
      };
    });
  }

  /**
   * Reconcile every recent ACTIVE instance against the eligible catalog in
   * one pass (resume/reconciliation hardening across template types).
   * COMPLETED rows are intentionally never rewritten here: they are
   * historical records (constitution §21) and must keep showing what was
   * actually played even if a game later retires. Returns the repaired
   * active instances (changed ones persisted; all-invalid ones deleted so
   * they regenerate).
   */
  async reconcileActiveInstances(
    eligibleIds: ReadonlySet<string> | readonly string[],
    limit = 20,
  ): Promise<WorkoutInstance[]> {
    const actives = await this.listActiveInstances(limit);
    const repaired: WorkoutInstance[] = [];
    for (const instance of actives) {
      // Re-observe each row's raw state and CAS the repair (065): a
      // concurrent advance/reroll that lands between the list read above
      // and this repair is never clobbered, and a skipped repair surfaces
      // the row's fresh state instead of the stale repair shape.
      const observation = await this.observeRepair(instance.date);
      if (!observation) {
        continue;
      }
      const fixed = await this.applyRepair(observation, eligibleIds);
      if (fixed) {
        repaired.push(fixed);
      }
    }
    return repaired;
  }

  /**
   * Fetch the sessions that may back positions of the given instances: one
   * bounded query over `game_sessions` (read-only use of another domain's
   * table; no write path touches it here). Callers pass the result straight
   * into `buildWorkoutSummary`, which re-filters per instance by createdAt.
   */
  private async sessionsForInstances(
    instances: readonly WorkoutInstance[],
  ): Promise<SummarySessionRow[]> {
    if (instances.length === 0) {
      return [];
    }
    const idSet = new Set<string>();
    let minCreatedAt = Number.POSITIVE_INFINITY;
    for (const instance of instances) {
      minCreatedAt = Math.min(minCreatedAt, instance.createdAt);
      for (const gameId of instance.gameIds) {
        idSet.add(gameId);
      }
    }
    const ids = [...idSet].slice(0, MAX_SUMMARY_GAME_IDS);
    if (ids.length === 0 || !Number.isFinite(minCreatedAt)) {
      return [];
    }
    const placeholders = ids.map(() => "?").join(", ");
    return this.adapter.all<SummarySessionRow>(
      `SELECT id, game_id, normalized_result, xp, duration_ms, completed_at
       FROM game_sessions
       WHERE completed_at >= ? AND game_id IN (${placeholders})
       ORDER BY completed_at ASC`,
      [minCreatedAt, ...ids],
    );
  }

  /** Map lean summary rows onto the structural shape summaries consume. */
  private static toSessionRef(row: SummarySessionRow): WorkoutSessionRef {
    return {
      gameId: row.game_id,
      normalizedResult: row.normalized_result,
      xp: row.xp,
      durationMs: row.duration_ms,
      completedAt: row.completed_at,
    };
  }

  /**
   * Completion summary for ONE instance key (mission: "completion summaries
   * — per-workout aggregate for results/UI"). Null when no such instance.
   */
  async getWorkoutSummary(
    key: string,
    reasons: readonly WorkoutSelectionReason[] | null = null,
  ): Promise<WorkoutCompletionSummary | null> {
    const instance = await this.getByDate(key);
    if (!instance) {
      return null;
    }
    const rows = await this.sessionsForInstances([instance]);
    return buildWorkoutSummary(
      instance,
      rows.map(WorkoutRepository.toSessionRef),
      reasons,
    );
  }

  /**
   * Recent completion summaries across ALL workout kinds (daily + templates),
   * newest first — the read model for history screens. One batched session
   * query backs the whole page (no N+1); per-instance windows are applied by
   * `buildWorkoutSummary`.
   */
  async listRecentSummaries(
    limit = 14,
    reasonsForKey?: (key: string) => readonly WorkoutSelectionReason[] | null,
  ): Promise<WorkoutCompletionSummary[]> {
    const instances = await this.listHistory({ limit });
    if (instances.length === 0) {
      return [];
    }
    const rows = await this.sessionsForInstances(instances);
    const records = rows.map(WorkoutRepository.toSessionRef);
    return instances.map((instance) =>
      buildWorkoutSummary(
        instance,
        records,
        reasonsForKey ? reasonsForKey(instance.date) : null,
      ),
    );
  }
}
