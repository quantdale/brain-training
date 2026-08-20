/**
 * Activity-frequency / calendar aggregation for Progress.
 *
 * Converts completed sessions into a per-day frequency series and summary
 * statistics. Date bucketing uses UTC day keys to match the SQLite
 * `DATE(completed_at / 1000, 'unixepoch')` convention used elsewhere in the
 * product, so the counts are stable regardless of the device timezone.
 *
 * This is intentionally a *frequency* view only — it does not compute streaks or
 * engagement scores (those belong to other features); it just shows how often
 * training happened.
 */

import type { GameSessionRecord } from '@/db';

import { utcDateKey } from './format';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One calendar cell: a UTC day and the number of sessions completed in it. */
export interface CalendarDay {
  /** UTC date key, `YYYY-MM-DD`. */
  dateKey: string;
  /** Days before "today" (0 = the most recent day in the window). */
  offsetDays: number;
  /** Sessions completed on this day. */
  count: number;
  /** Convenience flag: `count > 0`. */
  hasSession: boolean;
}

/** Aggregated activity summary over a fixed window. */
export interface ActivityCalendar {
  /** One cell per day, oldest first. */
  days: CalendarDay[];
  /** Number of distinct days with at least one session. */
  activeDays: number;
  /** Total sessions in the window. */
  totalSessions: number;
  /** Mean sessions per active day (`0` when nothing was played). */
  avgPerActiveDay: number;
  /** Busiest day in the window, or `null` when empty. */
  busiest: CalendarDay | null;
}

// `utcDateKey` is re-exported from `./format`; this module imports it for internal use only.

/**
 * Build a day-by-day activity calendar for the `dayCount` days ending at
 * `nowMs` (inclusive). Days with no sessions are represented with `count: 0` so
 * the grid is contiguous.
 */
export function buildActivityCalendar(
  sessions: readonly GameSessionRecord[],
  dayCount: number,
  nowMs: number,
): ActivityCalendar {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const key = utcDateKey(session.completedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const days: CalendarDay[] = [];
  for (let offset = dayCount - 1; offset >= 0; offset--) {
    const dateMs = nowMs - offset * DAY_MS;
    const key = utcDateKey(dateMs);
    const count = counts.get(key) ?? 0;
    days.push({ dateKey: key, offsetDays: offset, count, hasSession: count > 0 });
  }

  let activeDays = 0;
  let busiest: CalendarDay | null = null;
  for (const day of days) {
    if (day.count > 0) {
      activeDays += 1;
      if (!busiest || day.count > busiest.count) {
        busiest = day;
      }
    }
  }
  // Tie-break busiest to the most recent day when counts are equal.
  if (busiest) {
    for (const day of days) {
      if (day.count === busiest.count && day.offsetDays < busiest.offsetDays) {
        busiest = day;
      }
    }
  }

  return {
    days,
    activeDays,
    totalSessions: sessions.length,
    avgPerActiveDay: activeDays > 0 ? sessions.length / activeDays : 0,
    busiest,
  };
}

/**
 * Sessions-per-day histogram buckets (e.g. for a small frequency bar chart).
 * Returns the distinct counts observed, sorted ascending, with how many days
 * fell into each — a compact distribution of training frequency.
 */
export function activityFrequencyBuckets(calendar: ActivityCalendar): { perDay: number; days: number }[] {
  const byCount = new Map<number, number>();
  for (const day of calendar.days) {
    byCount.set(day.count, (byCount.get(day.count) ?? 0) + 1);
  }
  return [...byCount.entries()]
    .map(([perDay, days]) => ({ perDay, days }))
    .sort((a, b) => a.perDay - b.perDay);
}
