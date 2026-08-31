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
import type { GameSessionRecord } from "./types";
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
import type { WorkoutSelectionReason } from "@/workout/personalize";
import { nextDate } from "@/workout/today";
import {
  isWorkoutSessionProvenance,
  type WorkoutSessionProvenance,
} from "@/workout/session-provenance";

export type WorkoutStatus = "active" | "completed";

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
    ...(metadata ? { metadata } : {}),
  };
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
      ...(metadata ? { metadata } : {}),
    };
  }

  /**
   * Legacy/manual direct advance primitive. Result completion must use
   * `advanceForSession`, which proves the persisted session's ownership and
   * performs a conditional one-shot transition. This helper remains for
   * explicit workout controls and historical callers.
   */
  async advance(date: string): Promise<WorkoutInstance> {
    const current = await this.getByDate(date);
    if (!current) {
      throw new Error(`No workout instance for key ${date}`);
    }
    const nextIndex = Math.min(
      current.currentIndex + 1,
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
   * Reconcile a persisted instance against the current eligible catalog
   * (Queue A: catalog changes / invalid game IDs / registry drift). Loads the
   * instance for `key`, drops any game ids no longer eligible, advances the
   * resume index past invalidated games, and persists the repair when
   * anything changed. Returns the repaired instance, or `null` when no stored
   * game remains eligible (the caller should generate a fresh selection).
   * Idempotent: a clean instance is returned unchanged without a write.
   */
  async reconcile(
    date: string,
    eligibleIds: ReadonlySet<string> | readonly string[],
  ): Promise<WorkoutInstance | null> {
    const existing = await this.getByDate(date);
    const { instance, changed } = reconcileWorkout(existing, eligibleIds);
    if (!instance) {
      // All stored games retired/ineligible: drop the stale row so a fresh
      // selection can be generated (getOrCreate would otherwise return it).
      if (existing) {
        await this.adapter.run("DELETE FROM workout_instances WHERE date = ?", [
          date,
        ]);
      }
      return null;
    }
    if (changed) {
      await this.persistRepaired(instance.date, instance);
    }
    return instance;
  }

  /** Persist a repaired instance (shared by reconcile/reconcileActiveInstances). */
  private async persistRepaired(
    key: string,
    instance: WorkoutInstance,
  ): Promise<void> {
    const updatedAt = this.now();
    await this.adapter.run(
      `UPDATE workout_instances
       SET game_ids_json = ?, current_index = ?, status = ?, updated_at = ?
       WHERE date = ?`,
      [
        JSON.stringify(instance.gameIds),
        instance.currentIndex,
        instance.status,
        updatedAt,
        key,
      ],
    );
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
  ): Promise<WorkoutInstance> {
    const current = await this.getByDate(date);
    if (!current) {
      throw new Error(`No workout instance for key ${date}`);
    }
    const completedPrefix = current.gameIds.slice(0, current.currentIndex);
    const future = newGameIds.slice(current.currentIndex);
    const merged = [...completedPrefix, ...future];
    const updatedAt = this.now();
    await this.adapter.run(
      `UPDATE workout_instances
       SET game_ids_json = ?, reroll_attempt = ?, updated_at = ?
       WHERE date = ?`,
      [JSON.stringify(merged), newAttempt, updatedAt, date],
    );
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
      const update = await txn.run(
        `UPDATE workout_instances
         SET current_index = ?, status = ?, updated_at = ?
         WHERE date = ? AND status = 'active' AND current_index = ?
           AND updated_at = ? AND reroll_attempt = ? AND seed_version = ?
           AND game_ids_json = ?`,
        [
          nextIndex,
          status,
          updatedAt,
          provenance.instanceKey,
          current.currentIndex,
          current.updatedAt,
          current.rerollAttempt,
          current.seedVersion,
          row.game_ids_json,
        ],
      );
      if (update.changes === 0) {
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
      const { instance: fixed, changed } = reconcileWorkout(
        instance,
        eligibleIds,
      );
      if (!fixed) {
        // Every stored game ineligible: drop so the owner regenerates.
        await this.adapter.run(
          "DELETE FROM workout_instances WHERE date = ?",
          [instance.date],
        );
        continue;
      }
      if (changed) {
        await this.persistRepaired(fixed.date, fixed);
      }
      repaired.push(fixed);
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
