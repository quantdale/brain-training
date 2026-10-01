/**
 * One compare-and-set for workout-position writes (Change 073, design D5).
 *
 * THE DEFECT THIS EXISTS TO PREVENT
 * ---------------------------------
 * `workout_instances` is written from two places: the session advance and the
 * reroll. Both wrote a hand-written conditional UPDATE, and the two copies
 * DRIFTED — the reroll statement omitted `status = 'active'` (and, before that,
 * `updated_at` and `seed_version`). A reroll could therefore rewrite the game
 * list of a COMPLETED workout, resurrecting future legs onto a finished row.
 *
 * Two hand-written copies of one invariant is not one invariant. This module is
 * the single place the predicate is written, and it is the ONLY place either
 * writer may use — which is what makes "the two agree" a property of the code
 * rather than a coincidence someone has to remember to preserve.
 *
 * THE SHAPE OF THE PREDICATE
 * ---------------------------
 * A position write is conditional on the writer having read a specific row
 * state. Every field that could have changed since that read is included:
 *
 *   status          — a finished workout is never mutated.
 *   current_index   — two advances from the same read must not both land.
 *   updated_at      — a write with a different timestamp is a different write.
 *   reroll_attempt  — a reroll changes the leg list, so a stale advance loses.
 *   seed_version    — a reseed invalidates everything derived from the old one.
 *   game_ids_json   — the exact BYTES read, so a reroll that rewrote the list
 *                     between this read and this write is detected even when the
 *                     parsed list is canonically equal (059/i leniency).
 *
 * `game_ids_json` is the stored form rather than a re-serialized comparison for
 * exactly that reason: a non-canonical but canonically-equal row must still
 * commit its FIRST write, and must lose every write after another writer
 * normalizes it.
 */

import type { SQLiteAdapter, SQLiteRunResult } from './adapter';
import type { SQLiteValue } from './types';

/** The row state a writer read, and therefore the state its write is conditional on. */
export interface WorkoutCasBaseline {
  date: string;
  status: string;
  currentIndex: number;
  updatedAt: number;
  rerollAttempt: number;
  seedVersion: number;
  /** The EXACT `game_ids_json` bytes read, never a re-serialization. */
  gameIdsJson: string;
}

export interface WorkoutCasValues {
  updatedAt: number;
  currentIndex: number;
  status: string;
  rerollAttempt: number;
  gameIdsJson: string;
}

/**
 * The predicate every position write must use, as SQL fragments.
 *
 * Exported as fragments rather than one statement because the two writers set
 * different columns. Everything the WHERE clause constrains is derived from these
 * fragments, so a writer cannot accidentally predicate on a different field set.
 */
export const WORKOUT_POSITION_CAS_WHERE =
  "date = ? AND status = 'active' AND current_index = ?" +
  " AND updated_at = ? AND reroll_attempt = ? AND seed_version = ?" +
  " AND game_ids_json = ?";

/**
 * Build the bound parameters for {@link WORKOUT_POSITION_CAS_WHERE}, in order.
 * A writer that forgets a field cannot pass this function, so the drift the
 * module exists to prevent becomes a type error rather than a silent weakening.
 */
export function workoutPositionCasParams(baseline: WorkoutCasBaseline): SQLiteValue[] {
  return [
    baseline.date,
    baseline.currentIndex,
    baseline.updatedAt,
    baseline.rerollAttempt,
    baseline.seedVersion,
    baseline.gameIdsJson,
  ];
}

/** `changes === 0` is the CAS's "someone else moved first" signal. */
export function workoutCasApplied(result: Pick<SQLiteRunResult, 'changes'>): boolean {
  return result.changes === 1;
}

/**
 * The SET clauses a position write may use, as a CLOSED SET.
 *
 * A free-form `setClause` string would be an SQL-injection surface in a module
 * whose whole purpose is to be the single trusted place a write is composed.
 * Both writers' needs are enumerated instead, so adding a third write means
 * adding a member here — visible in review — rather than passing a string.
 */
export const WORKOUT_POSITION_CAS_SET = {
  /** The session advance: move the position, flip the status, stamp the write. */
  advance: 'current_index = ?, status = ?, updated_at = ?',
  /** The reroll: replace the leg list and attempt counter, stamp the write. */
  reroll: 'game_ids_json = ?, reroll_attempt = ?, updated_at = ?',
} as const;

export type WorkoutPositionCasSet = keyof typeof WORKOUT_POSITION_CAS_SET;

/** The SET clauses, keyed for the caller. */
export const workoutPositionCasSet = (
  kind: WorkoutPositionCasSet,
): string => WORKOUT_POSITION_CAS_SET[kind];

/**
 * The one sanctioned conditional write to a workout position.
 *
 * `kind` selects the SET clause from the closed set above and `setValues` must
 * match its arity, so a writer cannot invent a different predicate or a
 * mismatched binding order. `run` is injected because the advance runs inside
 * a transaction adapter and the reroll on the connection, and forcing one of the
 * two would be a worse coupling than passing the executor.
 */
export async function applyWorkoutPositionCas(
  run: (sql: string, params: SQLiteValue[]) => Promise<Pick<SQLiteRunResult, 'changes'>>,
  baseline: WorkoutCasBaseline,
  kind: WorkoutPositionCasSet,
  setValues: readonly SQLiteValue[],
): Promise<boolean> {
  const result = await run(
    `UPDATE workout_instances SET ${workoutPositionCasSet(kind)} WHERE ${WORKOUT_POSITION_CAS_WHERE}`,
    [...setValues, ...workoutPositionCasParams(baseline)],
  );
  return workoutCasApplied(result);
}

/** Narrow an adapter or transaction to what a CAS write needs. */
export type WorkoutCasExecutor = Pick<SQLiteAdapter, 'run'>;
