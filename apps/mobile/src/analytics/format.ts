/**
 * Formatting helpers for Progress / Insights display. Pure, locale-light (uses
 * explicit UTC-date formatting so rendered values are deterministic in tests).
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

/** Compact integer, e.g. 1234 → "1.2k". */
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  }
  return String(Math.round(n));
}

/** Direction arrow for movement (▲ / ▼ / –). */
export function directionArrow(direction: Direction): string {
  return direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–';
}

/** Signed integer with explicit + for positive ("+12", "-5", "0"). */
export function formatSigned(n: number): string {
  if (n > 0) return `+${Math.round(n)}`;
  return String(Math.round(n));
}

/** UTC date label "Jan 20" from epoch ms. */
export function formatDayLabel(ms: number): string {
  const d = new Date(ms);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** UTC date key "YYYY-MM-DD" (mirrors analytics bucketing). */
export function utcDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
