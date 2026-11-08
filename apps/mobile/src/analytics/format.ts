/**
 * Formatting helpers for Progress / Insights display. Pure and locale-light:
 * month names are fixed English, and day labels show the player's local
 * calendar date (constitution §14).
 */

import type { Direction } from './types';

/** Format a 0..1 ratio as a whole-percent string ("73%"). */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Format milliseconds as a compact human duration ("1.2s", "250ms"). */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Direction arrow for movement (▲ / ▼ / –). */
export function directionArrow(direction: Direction): string {
  return direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–';
}

/**
 * English count noun: `plural(1, 'session')` → "1 session",
 * `plural(3, 'session')` → "3 sessions". Campaign 026 visual-QA: bare
 * `${n} sessions` interpolations rendered "1 sessions" on several screens,
 * so user-facing counts go through this helper.
 */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Signed integer with explicit + for positive ("+12", "-5", "0"). */
export function formatSigned(n: number): string {
  if (n > 0) return `+${Math.round(n)}`;
  return String(Math.round(n));
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local date label "Jan 20" from epoch ms. */
export function formatDayLabel(ms: number): string {
  const d = new Date(ms);
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Label "Jan 20" for a `YYYY-MM-DD` key. Reads the key directly, so a day that
 * is already a calendar date never passes through an instant a timezone or DST
 * change could shift.
 */
export function formatDateKeyLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-').map(Number);
  return `${MONTH_LABELS[month - 1]} ${day}`;
}

/** UTC date key "YYYY-MM-DD" (mirrors analytics bucketing). */
export function utcDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
