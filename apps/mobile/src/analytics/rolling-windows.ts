/**
 * Rolling-window and rate refinements for Progress V2.
 *
 * Two complements to the existing recent-vs-lifetime comparison:
 *  - trailing (rolling) averages smooth per-session noise so a trend line shows
 *    the shape of recent form instead of single-session spikes;
 *  - rate comparison restates volume as sessions-per-week on both sides of a
 *    window, which stays comparable when the recent window and the lifetime
 *    span differ in length.
 *
 * All pure and deterministic; no clock reads.
 */

import type { GameSessionRecord } from '@/db';

import type { Point, TimeWindowKey } from './types';
import { WINDOW_DAYS, windowStartMs } from './windows';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Trailing n-point averages aligned with the input: index `i` holds the mean
 * of `values[i-n+1..i]`, or `null` before the first full window. Deterministic;
 * `n < 1` yields all `null`s.
 */
export function rollingAverages(
  values: readonly number[],
  n: number,
): (number | null)[] {
  if (n < 1) {
    return values.map(() => null);
  }
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= n) {
      sum -= values[i - n];
    }
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

/** Rolling-average series as timestamped points (pre-full-window nulls dropped). */
export function buildRollingAverageSeries(
  points: readonly Point[],
  n: number,
): Point[] {
  const avgs = rollingAverages(
    points.map((p) => p.value),
    n,
  );
  const out: Point[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const v = avgs[i];
    if (typeof v === 'number') {
      out.push({ t: points[i].t, value: v });
    }
  }
  return out;
}

/** Sessions-per-week comparison between a window and the full lifetime span. */
export interface RateComparison {
  /** Mean sessions per week inside the window (`null` for the `all` window — it equals lifetime). */
  recentPerWeek: number | null;
  /**
   * Lifetime sessions per week, measured from the first stored session to
   * `nowMs` (minimum one week so a brand-new history is not divided by ~0).
   */
  lifetimePerWeek: number | null;
  /** `recentPerWeek - lifetimePerWeek`; `null` when either side is unknown. */
  deltaPerWeek: number | null;
}

/**
 * Compare in-window training rate against the lifetime rate. The lifetime span
 * starts at the earliest session; with no sessions both sides are `null`.
 */
export function compareRates(
  sessions: readonly GameSessionRecord[],
  nowMs: number,
  windowKey: TimeWindowKey,
): RateComparison {
  // Future-dated rows (import artifacts / clock skew) stay out of the lifetime
  // side exactly as they do out of the recent window below.
  const stored = sessions.filter((s) => s.completedAt <= nowMs);
  if (stored.length === 0) {
    return { recentPerWeek: null, lifetimePerWeek: null, deltaPerWeek: null };
  }

  let first = Infinity;
  for (const s of stored) {
    if (s.completedAt < first) {
      first = s.completedAt;
    }
  }
  const lifetimeWeeks = Math.max(1, (nowMs - first) / WEEK_MS);
  const lifetimePerWeek = stored.length / lifetimeWeeks;

  const windowDays = WINDOW_DAYS[windowKey];
  if (windowDays === null) {
    // `all`: the "recent" side is the lifetime itself; no separate comparison.
    return { recentPerWeek: null, lifetimePerWeek, deltaPerWeek: null };
  }

  const start = windowStartMs(nowMs, windowKey);
  let recentCount = 0;
  for (const s of stored) {
    if (s.completedAt >= start && s.completedAt <= nowMs) {
      recentCount += 1;
    }
  }
  const recentPerWeek = recentCount / (windowDays / 7);
  return {
    recentPerWeek,
    lifetimePerWeek,
    deltaPerWeek: recentPerWeek - lifetimePerWeek,
  };
}
