/**
 * Session-volume views for Progress V2: how much training happened inside a
 * window, versus the immediately preceding window of equal length.
 *
 * Everything is a direct count of stored `completedAt` timestamps — no
 * weighting, no invented score. The previous-period comparison gives screens
 * an honest "more / fewer sessions than the prior 30d" statement instead of a
 * vague trend adjective. The `all` window has no preceding period, so
 * `previousWindowSessions` is `null` there and weekly buckets are left empty
 * (the UI shows totals only).
 *
 * Boundary convention (campaign 011 W09, decided once and pinned by tests):
 * windows are measured in session age from `nowMs`. The current window covers
 * ages `[0, w]` days (`completedAt ∈ [now-w, now]`, matching the shared
 * `windowStartMs` helpers), the preceding window covers ages `(w, 2w]` days
 * (`completedAt ∈ (now-2w, now-w)`). The shared edge at exactly `now-w`
 * belongs to the current window; the outer edge at exactly `now-2w` belongs to
 * older history ("two windows ago") and counts toward neither displayed
 * period. Future-dated rows are ignored everywhere.
 */

import type { GameSessionRecord } from '@/db';

import { utcDateKey } from './format';
import type { Direction, TimeWindowKey } from './types';
import { WINDOW_DAYS, windowStartMs } from './windows';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Volume summary for one time window. */
export interface SessionVolume {
  /** Sessions completed inside the window. */
  windowSessions: number;
  /**
   * Sessions in the immediately preceding window of equal length (ages
   * `(w, 2w]` days; the exact `now-2w` instant belongs to older history), or
   * `null` for the `all` window (no preceding period exists).
   */
  previousWindowSessions: number | null;
  /** `windowSessions - previousWindowSessions`; `null` when there is no previous. */
  deltaSessions: number | null;
  direction: Direction;
  /** Distinct days inside the window with at least one session. */
  activeDays: number;
  /** Mean sessions per week across the window span (`windowDays / 7`). */
  perWeek: number | null;
  /**
   * Sessions per week bucket across the window, oldest first, for a compact
   * bar chart. Empty for the `all` window. A trailing partial week is included
   * as-is (its bar is simply shorter by construction).
   */
  weeklyCounts: number[];
}

/**
 * Build the volume view for `windowKey` ending at `nowMs`. Deterministic given
 * the same session set and clock.
 */
export function buildSessionVolume(
  sessions: readonly GameSessionRecord[],
  nowMs: number,
  windowKey: TimeWindowKey,
): SessionVolume {
  const start = windowStartMs(nowMs, windowKey);
  const windowDays = WINDOW_DAYS[windowKey];

  let windowSessions = 0;
  let activeDayKeys = new Set<string>();
  const weeklyBuckets = new Map<number, number>();

  if (windowDays !== null) {
    for (const session of sessions) {
      const t = session.completedAt;
      if (t < start || t > nowMs) {
        continue;
      }
      windowSessions += 1;
      activeDayKeys.add(utcDateKey(t));
      // Week bucket index counted back from "now": 0 = current (partial) week.
      const bucket = Math.floor((nowMs - t) / (7 * DAY_MS));
      weeklyBuckets.set(bucket, (weeklyBuckets.get(bucket) ?? 0) + 1);
    }
  } else {
    // `all` keeps every stored row except future-dated ones, matching the
    // clamped shared-window filters used by the other views.
    for (const session of sessions) {
      if (session.completedAt > nowMs) {
        continue;
      }
      windowSessions += 1;
      activeDayKeys.add(utcDateKey(session.completedAt));
    }
  }

  // Previous equal-length window (bounded windows only): strictly older than
  // the current window's start, and strictly newer than two windows ago. The
  // exact outer boundary `prevStart` (age exactly 2w days) belongs to older
  // history — see the header comment for the decided convention.
  let previousWindowSessions: number | null = null;
  if (windowDays !== null) {
    const prevStart = start - windowDays * DAY_MS;
    previousWindowSessions = 0;
    for (const session of sessions) {
      const t = session.completedAt;
      if (t > prevStart && t < start) {
        previousWindowSessions += 1;
      }
    }
  }

  const deltaSessions =
    previousWindowSessions === null ? null : windowSessions - previousWindowSessions;
  const direction: Direction =
    deltaSessions === null || deltaSessions === 0 ? 'flat' : deltaSessions > 0 ? 'up' : 'down';

  // Oldest bucket first so charts read left→right chronologically.
  const weeklyCounts: number[] = [];
  if (windowDays !== null) {
    const bucketCount = Math.ceil(windowDays / 7);
    for (let b = bucketCount - 1; b >= 0; b -= 1) {
      weeklyCounts.push(weeklyBuckets.get(b) ?? 0);
    }
  }

  return {
    windowSessions,
    previousWindowSessions,
    deltaSessions,
    direction,
    activeDays: activeDayKeys.size,
    perWeek: windowDays === null ? null : windowSessions / (windowDays / 7),
    weeklyCounts,
  };
}
