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

/**
 * Whole days since the most recent completed session (`0` = today), or `null`
 * when there are no sessions at all. A staleness indicator derived only from
 * stored completion timestamps.
 */
export function daysSinceLastSession(
  sessions: readonly GameSessionRecord[],
  nowMs: number,
): number | null {
  let last: number | null = null;
  for (const session of sessions) {
    if (last === null || session.completedAt > last) {
      last = session.completedAt;
    }
  }
  return last === null ? null : Math.floor((nowMs - last) / DAY_MS);
}

/** Consecutive active-day runs inside a calendar window. */
export interface ActiveRuns {
  /**
   * Active days ending at the newest day of the window (0 when today/the
   * newest cell is inactive). Note this measures the *window*, not the all-time
   * streak — engagement streaks belong to their own feature.
   */
  current: number;
  /** Longest run of consecutive active days within the window. */
  longest: number;
}

/**
 * Consecutive-run analysis over a built calendar. Days are contiguous cells
 * (`offsetDays` decreasing by 1 toward the past), so adjacency is simply
 * consecutive array order from oldest to newest.
 */
export function activeRuns(calendar: ActivityCalendar): ActiveRuns {
  let longest = 0;
  let run = 0;
  for (const day of calendar.days) {
    if (day.hasSession) {
      run += 1;
      if (run > longest) {
        longest = run;
      }
    } else {
      run = 0;
    }
  }
  // Current run: trailing consecutive active cells from the newest day.
  let current = 0;
  for (let i = calendar.days.length - 1; i >= 0; i -= 1) {
    if (!calendar.days[i].hasSession) {
      break;
    }
    current += 1;
  }
  return { current, longest };
}

/** UTC weekday of a `YYYY-MM-DD` key (0 = Sunday … 6 = Saturday). */
function weekdayOfDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Terse weekday labels indexed by UTC weekday (0 = Sunday). */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** One weekday's aggregate over the calendar window. */
export interface WeekdayBucket {
  /** UTC weekday index (0 = Sunday … 6 = Saturday). */
  weekday: number;
  label: string;
  /** Distinct days of this weekday with at least one session. */
  activeDays: number;
  /** Sessions completed on this weekday. */
  sessions: number;
}

/**
 * Which weekdays training landed on, over the calendar window. A frequency
 * restatement only — no "best day to train" claims.
 */
export function weekdayDistribution(calendar: ActivityCalendar): WeekdayBucket[] {
  const buckets: WeekdayBucket[] = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    activeDays: 0,
    sessions: 0,
  }));
  for (const day of calendar.days) {
    const bucket = buckets[weekdayOfDateKey(day.dateKey)];
    bucket.sessions += day.count;
    if (day.hasSession) {
      bucket.activeDays += 1;
    }
  }
  return buckets;
}

/** One month's aggregate over the calendar window. */
export interface MonthActivity {
  /** `YYYY-MM` key. */
  monthKey: string;
  sessions: number;
  activeDays: number;
}

/**
 * Month-by-month rollup of the calendar window, chronological. Months partially
 * covered by the window include only their covered days (honest partial data).
 */
export function monthlyActivity(calendar: ActivityCalendar): MonthActivity[] {
  const byMonth = new Map<string, MonthActivity>();
  for (const day of calendar.days) {
    const monthKey = day.dateKey.slice(0, 7);
    let entry = byMonth.get(monthKey);
    if (!entry) {
      entry = { monthKey, sessions: 0, activeDays: 0 };
      byMonth.set(monthKey, entry);
    }
    entry.sessions += day.count;
    if (day.hasSession) {
      entry.activeDays += 1;
    }
  }
  return [...byMonth.values()].sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1));
}
