/**
 * Pure streak reconstruction (campaign 003, WP-3B, constitution §18).
 *
 * The streak is derived exclusively from activity history: the `completedAt`
 * local dates of completed sessions (`db.sessions.listRecent/listByGame`).
 * No db access here — callers read sessions and pass the date strings.
 *
 * Reconstruction semantics ("raw numbers", before any item application):
 * - `current` is the consecutive run ending at `lastActiveDate`.
 * - Last active day == today: streak alive, `current` includes today.
 * - Last active day == yesterday: streak still alive (today is in progress),
 *   `atRisk` is true — a Freeze can cover today, or activity saves it.
 * - Last active day older than yesterday: streak has BROKEN. `current` keeps
 *   the broken run so Recovery can restore it; the display number is 0 and
 *   comes from `effectiveCurrent`.
 * - `frozenDays` is always 0 here: raw history cannot see item usage; the
 *   transforms in `rules.ts` maintain it.
 *
 * All date math runs on `YYYY-MM-DD` strings with UTC as the parse vehicle
 * only — no timezone conversion, so results are identical on every host.
 */

import type { StreakState } from './types';

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse `YYYY-MM-DD` into a UTC-midnight Date; `null` for malformed strings
 * or impossible calendar dates (e.g. `2026-02-30`).
 */
export function toUtcDate(dateStr: string): Date | null {
  const match = DATE_RE.exec(dateStr);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rollover check: Date.UTC(2026, 1, 30) silently becomes Mar 2.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/** Previous local calendar date (`YYYY-MM-DD`), leap-year aware. */
export function previousDate(dateStr: string): string {
  const date = toUtcDate(dateStr);
  if (!date) {
    throw new Error(`previousDate: expected "YYYY-MM-DD", got "${dateStr}"`);
  }
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Next local calendar date (`YYYY-MM-DD`), leap-year aware. */
export function nextDate(dateStr: string): string {
  const date = toUtcDate(dateStr);
  if (!date) {
    throw new Error(`nextDate: expected "YYYY-MM-DD", got "${dateStr}"`);
  }
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Whole days between two dates: `daysBetween(later, earlier)` >= 0. */
export function daysBetween(later: string, earlier: string): number {
  const a = toUtcDate(later);
  const b = toUtcDate(earlier);
  if (!a || !b) {
    throw new Error(`daysBetween: expected "YYYY-MM-DD", got "${later}" / "${earlier}"`);
  }
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

/**
 * Effective current streak for display: `current` while the streak is alive
 * (last active day is today or yesterday), 0 once it has broken. Call with
 * the same `today` used for reconstruction.
 */
export function effectiveCurrent(state: StreakState, today: string): number {
  if (state.lastActiveDate === null) {
    return 0;
  }
  return state.lastActiveDate === today || state.lastActiveDate === previousDate(today)
    ? state.current
    : 0;
}

/**
 * Reconstruct the raw streak from activity dates.
 *
 * @param activityDates Local `YYYY-MM-DD` completion dates; may be unsorted,
 *   may contain duplicates, may contain future dates (ignored) and malformed
 *   entries (ignored).
 * @param today Local `YYYY-MM-DD` reference date.
 */
export function reconstructStreak(activityDates: readonly string[], today: string): StreakState {
  const todayParsed = toUtcDate(today);
  if (!todayParsed) {
    // Defensive: an invalid `today` cannot anchor a streak; empty state.
    return { current: 0, longest: 0, lastActiveDate: null, atRisk: false, frozenDays: 0 };
  }
  const todayTime = todayParsed.getTime();

  // Normalize: dedupe, drop malformed entries and future dates (> today).
  const active = new Set<string>();
  for (const dateStr of activityDates) {
    const parsed = toUtcDate(dateStr);
    if (parsed !== null && parsed.getTime() <= todayTime) {
      active.add(dateStr);
    }
  }
  // `YYYY-MM-DD` sorts lexicographically == chronologically.
  const dates = [...active].sort();
  const lastActiveDate = dates.length > 0 ? dates[dates.length - 1] : null;

  // Longest run anywhere in the history.
  let longest = 0;
  let run = 0;
  let prevTime: number | null = null;
  for (const dateStr of dates) {
    const time = toUtcDate(dateStr)!.getTime();
    run = prevTime !== null && time - prevTime === DAY_MS ? run + 1 : 1;
    if (run > longest) {
      longest = run;
    }
    prevTime = time;
  }

  // Current run ending at the last active day (walk backwards through the
  // active set; each step is O(1)).
  let current = 0;
  if (lastActiveDate !== null) {
    current = 1;
    let cursor = previousDate(lastActiveDate);
    while (active.has(cursor)) {
      current += 1;
      cursor = previousDate(cursor);
    }
  }

  const atRisk = lastActiveDate !== null && lastActiveDate === previousDate(today);
  return { current, longest, lastActiveDate, atRisk, frozenDays: 0 };
}
