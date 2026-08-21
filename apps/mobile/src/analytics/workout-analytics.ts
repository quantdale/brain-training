/**
 * Workout-completion analytics for Progress V2 (constitution §14).
 *
 * Pure aggregation over already-loaded `WorkoutInstance` rows — this module
 * never touches the database. The screen loads instances read-only via the
 * existing `WorkoutRepository.getByDate(date)` walk plus `countCompleted()`
 * for the lifetime total, then hands them here.
 *
 * A workout "counts" only when its persisted status is `'completed'` — opening
 * the app or partially playing never inflates completion analytics, matching
 * the engagement rule elsewhere in the product. Runs are measured in
 * consecutive local calendar dates (`YYYY-MM-DD` lexicographic order is
 * chronological), so a gap day breaks a run exactly like the streak rules do.
 */

import type { WorkoutInstance } from '@/db';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a `YYYY-MM-DD` key to UTC ms (no timezone surprises). */
function dateKeyToMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole-day difference between two date keys (b − a in days). */
function daysBetween(aKey: string, bKey: string): number {
  return Math.round((dateKeyToMs(bKey) - dateKeyToMs(aKey)) / DAY_MS);
}

/** Completion analytics over a set of loaded workout instances. */
export interface WorkoutAnalytics {
  /** Instances handed in (the lookback window the caller loaded). */
  loadedInstances: number;
  /** Loaded instances whose status is `completed`. */
  completedInstances: number;
  /** Loaded instances still `active` (partially played or untouched). */
  activeInstances: number;
  /** `completedInstances / loadedInstances` in [0,1]; `null` when none loaded. */
  completionRate: number | null;
  /** Sum of assigned game slots across loaded instances. */
  gamesAssigned: number;
  /** Sum of completed game slots (resume index) across loaded instances. */
  gamesCompleted: number;
  /**
   * Consecutive completed days ending at the most recent completed day in the
   * loaded set (0 when nothing is completed). An unfinished today does not
   * erase yesterday's run — e.g. Mon+Tue completed, Wed still active → 2.
   */
  currentCompletedRun: number;
  /** Longest run of consecutive completed days within the loaded set. */
  longestCompletedRun: number;
  /** Lifetime completed-workout count from `WorkoutRepository.countCompleted()`. */
  lifetimeCompleted: number;
}

/**
 * Build the analytics. Duplicate dates are collapsed (latest write wins by
 * array order); instances with unknown game ids still count toward completion
 * — the repository already reconciles catalog drift before persisting.
 */
export function buildWorkoutAnalytics(
  instances: readonly WorkoutInstance[],
  lifetimeCompleted: number,
): WorkoutAnalytics {
  // Collapse to one instance per date (defensive; the repo keys rows by date).
  const byDate = new Map<string, WorkoutInstance>();
  for (const instance of instances) {
    byDate.set(instance.date, instance);
  }

  const loaded = [...byDate.values()];
  const completed = loaded.filter((i) => i.status === 'completed');

  let gamesAssigned = 0;
  let gamesCompleted = 0;
  for (const instance of loaded) {
    gamesAssigned += instance.gameIds.length;
    gamesCompleted += Math.min(instance.currentIndex, instance.gameIds.length);
  }

  // Completed dates sorted chronologically; runs are consecutive calendar days.
  const completedDates = completed
    .map((i) => i.date)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  let longestCompletedRun = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of completedDates) {
    run = prev !== null && daysBetween(prev, date) === 1 ? run + 1 : 1;
    if (run > longestCompletedRun) {
      longestCompletedRun = run;
    }
    prev = date;
  }

  // Current run: walk backwards from the newest completed date while each
  // previous day is also completed.
  let currentCompletedRun = 0;
  if (completedDates.length > 0) {
    currentCompletedRun = 1;
    for (let i = completedDates.length - 2; i >= 0; i -= 1) {
      if (daysBetween(completedDates[i], completedDates[i + 1]) === 1) {
        currentCompletedRun += 1;
      } else {
        break;
      }
    }
  }

  return {
    loadedInstances: loaded.length,
    completedInstances: completed.length,
    activeInstances: loaded.length - completed.length,
    completionRate: loaded.length > 0 ? completed.length / loaded.length : null,
    gamesAssigned,
    gamesCompleted,
    currentCompletedRun,
    longestCompletedRun,
    lifetimeCompleted,
  };
}
