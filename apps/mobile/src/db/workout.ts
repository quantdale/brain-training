/**
 * Persistent daily workout instance (constitution §14; 006R tasks 6.1, 6.3,
 * 6.5, 6.6).
 *
 * One row per local calendar date. The selection itself is computed by the
 * pure personalization layer (`@/workout/personalize`); this repository only
 * persists the resulting instance and advances/resumes/rerolls it. Keeping
 * selection pure and persistence here lets the data layer be unit-tested
 * without the UI or emulator.
 */
import type { SQLiteAdapter } from "./adapter";
import { reconcileWorkout } from "@/workout/reconcile";

export type WorkoutStatus = "active" | "completed";

export interface WorkoutInstance {
  /** Local calendar date (YYYY-MM-DD); the primary key. */
  date: string;
  /** Ordered four-game selection (game ids), as chosen by the selector. */
  gameIds: string[];
  /** 'active' until the fourth game is durably completed. */
  status: WorkoutStatus;
  /** Next game to play (0-based resume point). */
  currentIndex: number;
  /** Number of rerolls applied today (0 = base selection). Persisted (6.5). */
  rerollAttempt: number;
  /** Selector/profile version used to produce this selection (provenance). */
  seedVersion: number;
  createdAt: number;
  updatedAt: number;
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
}

const SELECT_COLUMNS =
  "date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at";

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
  return {
    date: row.date,
    gameIds,
    status: row.status,
    currentIndex: row.current_index,
    rerollAttempt: row.reroll_attempt,
    seedVersion: row.seed_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WorkoutRepository {
  private readonly adapter: SQLiteAdapter;
  private readonly now: () => number;

  constructor(adapter: SQLiteAdapter, now: () => number = () => Date.now()) {
    this.adapter = adapter;
    this.now = now;
  }

  /** Number of daily workout instances fully completed (workout completion, §B). */
  async countCompleted(): Promise<number> {
    const row = await this.adapter.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM workout_instances WHERE status = 'completed'",
    );
    return row?.n ?? 0;
  }

  /** Load the workout instance for a date, or null when none exists. */
  async getByDate(date: string): Promise<WorkoutInstance | null> {
    const row = await this.adapter.get<WorkoutRow>(
      `SELECT ${SELECT_COLUMNS} FROM workout_instances WHERE date = ?`,
      [date],
    );
    return row ? rowToInstance(row) : null;
  }

  /**
   * Get the existing instance for `date`, or create and persist a base
   * instance from `seed` (the selector's output) when none exists. Returns
   * the persisted instance. Idempotent per date — `INSERT OR IGNORE` plus a
   * re-read makes concurrent/retried creates safe (e.g. React StrictMode's
   * double-invoked effect).
   */
  async getOrCreate(
    date: string,
    seed: { gameIds: string[]; seedVersion?: number },
  ): Promise<WorkoutInstance> {
    const existing = await this.getByDate(date);
    if (existing) {
      return existing;
    }
    const now = this.now();
    const gameIds = seed.gameIds.slice();
    const seedVersion = seed.seedVersion ?? 0;
    await this.adapter.run(
      `INSERT OR IGNORE INTO workout_instances
        (date, game_ids_json, status, current_index, reroll_attempt, seed_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [date, JSON.stringify(gameIds), "active", 0, 0, seedVersion, now, now],
    );
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
    };
  }

  /**
   * Advance to the next game after a durably completed session. When the last
   * game completes, the instance becomes 'completed'. Never skips ahead on a
   * crash: callers must persist the session first (006R task 6.2/6.3).
   */
  async advance(date: string): Promise<WorkoutInstance> {
    const current = await this.getByDate(date);
    if (!current) {
      throw new Error(`No workout instance for date ${date}`);
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
   * instance for `date`, drops any game ids no longer eligible, advances the
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
          date,
        ],
      );
    }
    return instance;
  }

  /**
   * Apply a reroll: persist the new `rerollAttempt` count and replace only the
   * UNPLAYED (future) positions with `newGameIds`, keeping the already
   * completed prefix immutable (006R task 6.6). Completed positions are
   * `[0, currentIndex)`; the reroll may only change `[currentIndex, len)`.
   * `newGameIds` is expected to already exclude the completed prefix (the
   * reroll selector passes the played ids in `exclude`), so the replaced tail
   * never reintroduces an already-played game. The currency cost is handled by
   * the caller (economy layer, task 7.4/6.5).
   */
  async applyReroll(
    date: string,
    newGameIds: string[],
    newAttempt: number,
  ): Promise<WorkoutInstance> {
    const current = await this.getByDate(date);
    if (!current) {
      throw new Error(`No workout instance for date ${date}`);
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
}
