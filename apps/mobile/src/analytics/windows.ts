/**
 * Time-window helpers for Progress views (7d / 30d / 90d / all-time).
 *
 * Windows are computed against an injectable `nowMs` so aggregation is fully
 * deterministic in tests. `all` is represented by a `null` day count and never
 * filters (it keeps every session / history entry).
 */

import type { TimeWindowKey } from './types';

/** Day count for each window; `null` means "no window" (all-time). */
export const WINDOW_DAYS: Readonly<Record<TimeWindowKey, number | null>> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

/** Display label for each window (kept terse for segmented controls). */
export const WINDOW_LABELS: Readonly<Record<TimeWindowKey, string>> = {
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
  all: 'All',
};

/** Ordered list of windows for rendering a selector. */
export const WINDOW_ORDER: readonly TimeWindowKey[] = ['7d', '30d', '90d', 'all'];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Inclusive start timestamp (epoch ms) for a window, or `-Infinity` for
 * `all` so the comparison `t >= start` always passes.
 */
export function windowStartMs(nowMs: number, key: TimeWindowKey): number {
  const days = WINDOW_DAYS[key];
  if (days === null) {
    return -Infinity;
  }
  return nowMs - days * DAY_MS;
}

/** True when `t` falls inside the window (inclusive of the start boundary). */
export function isWithinWindow(t: number, nowMs: number, key: TimeWindowKey): boolean {
  return t >= windowStartMs(nowMs, key);
}

/** Filter a list of timestamped items to those inside the window. */
export function filterByWindow<T extends { completedAt: number }>(
  items: readonly T[],
  nowMs: number,
  key: TimeWindowKey,
): T[] {
  const start = windowStartMs(nowMs, key);
  return items.filter((item) => item.completedAt >= start);
}

/** Filter rating-history entries (which use `createdAt`) to the window. */
export function filterHistoryByWindow<T extends { createdAt: number }>(
  items: readonly T[],
  nowMs: number,
  key: TimeWindowKey,
): T[] {
  const start = windowStartMs(nowMs, key);
  return items.filter((item) => item.createdAt >= start);
}
