/**
 * Period-key helpers (campaign 003, WP-3A).
 *
 * Quest progress rows are keyed by period: daily = local calendar date
 * `YYYY-MM-DD`, weekly = ISO week `YYYY-Www` (weeks start Monday), longterm =
 * the sentinel `'all'` (one row per quest for life). All math is
 * local-calendar based and deterministic under an injectable clock
 * (`currentPeriodKey(kind, now)`), so tests use fixed dates.
 */
import type { QuestKind } from './types';

/** Long-term quests evaluate over the whole history: one period, ever. */
export const LONGTERM_PERIOD_KEY = 'all';

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ISO 8601 week-year and week number (1..53). */
export interface IsoWeek {
  year: number;
  week: number;
}

/**
 * Period key for a kind, derived from a local calendar date string
 * (`YYYY-MM-DD`). Daily: the date itself. Weekly: `YYYY-Www` of the ISO week
 * containing that date. Longterm: the `'all'` sentinel.
 */
export function periodKeyFor(kind: QuestKind, dateStr: string): string {
  const date = parseLocalDate(dateStr);
  switch (kind) {
    case 'daily':
      return localDateKey(date);
    case 'weekly':
      return isoWeekKey(date);
    case 'longterm':
      return LONGTERM_PERIOD_KEY;
  }
}

/** Period key for the current period, from an injectable clock date. */
export function currentPeriodKey(kind: QuestKind, now: Date): string {
  return periodKeyFor(kind, localDateKey(now));
}

/** Local calendar date key `YYYY-MM-DD` (e.g. `2026-08-16`). */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * ISO week key `YYYY-Www` (e.g. `2026-W33`). The week-year can differ from
 * the calendar year at boundaries: a week belongs to the year containing its
 * Thursday, so e.g. `2025-12-29` is `2026-W01`.
 */
export function isoWeekKey(date: Date): string {
  const { year, week } = isoWeekOf(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * ISO 8601 week-year + week number. Algorithm: shift the local date to the
 * Thursday of its week (ISO weeks belong to the year containing their
 * Thursday), then week = ceil(dayOfYear(Thursday) / 7).
 */
export function isoWeekOf(date: Date): IsoWeek {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = d.getDay() === 0 ? 7 : d.getDay(); // Mon=1 .. Sun=7
  d.setDate(d.getDate() + 4 - dayNum); // Thursday of this ISO week
  const yearStart = new Date(d.getFullYear(), 0, 1);
  // Floor guards against DST skew between local midnights.
  const dayOfYear = Math.floor((d.getTime() - yearStart.getTime()) / 86_400_000) + 1;
  return { year: d.getFullYear(), week: Math.ceil(dayOfYear / 7) };
}

/** Parse `YYYY-MM-DD` into a *local* Date; rejects invalid calendar dates. */
function parseLocalDate(dateStr: string): Date {
  const match = LOCAL_DATE_RE.exec(dateStr);
  if (!match) {
    throw new Error(`periodKeyFor: expected local date "YYYY-MM-DD", got "${dateStr}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // Rollover check: `new Date(2026, 1, 30)` silently becomes Mar 2.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`periodKeyFor: invalid calendar date "${dateStr}"`);
  }
  return date;
}
