/**
 * Cross-session metric trends for Progress V2: accuracy and reaction-time
 * series built from whatever the games actually persisted.
 *
 * Extraction reuses the shared best-effort adapter in `metrics-map`, so a game
 * that does not emit a metric simply contributes nothing — `available` stays
 * `false` and the UI omits the trend rather than fabricating data. Series are
 * ordered ascending by completion time regardless of input order.
 */

import type { GameSessionRecord } from '@/db';

import { extractAccuracy, extractReactionMs } from './metrics-map';
import type { Direction, Point } from './types';

/** How many most-recent points the "recent mean" covers. */
export const METRIC_TREND_RECENT = 5;

/** Trend of one extracted metric across a session set. */
export interface MetricTrend {
  /** Whether any session in the set carries the metric. */
  available: boolean;
  /** Sessions that contributed a value. */
  count: number;
  /** Chronological series (oldest first). Empty when unavailable. */
  series: Point[];
  first: number | null;
  last: number | null;
  /** `last - first`; `null` when fewer than two points. */
  delta: number | null;
  mean: number | null;
  /** Mean over the most recent `METRIC_TREND_RECENT` values (`null` when none). */
  recentMean: number | null;
  direction: Direction;
}

function buildExtractedTrend(
  sessions: readonly GameSessionRecord[],
  extract: (session: GameSessionRecord) => number | null,
): MetricTrend {
  const ordered = sessions.slice().sort((a, b) => a.completedAt - b.completedAt);
  const series: Point[] = [];
  for (const session of ordered) {
    const value = extract(session);
    if (value !== null) {
      series.push({ t: session.completedAt, value });
    }
  }
  if (series.length === 0) {
    return {
      available: false,
      count: 0,
      series: [],
      first: null,
      last: null,
      delta: null,
      mean: null,
      recentMean: null,
      direction: 'flat',
    };
  }
  const values = series.map((p) => p.value);
  const recentSlice = values.slice(-METRIC_TREND_RECENT);
  const delta = values.length >= 2 ? values[values.length - 1] - values[0] : null;
  return {
    available: true,
    count: series.length,
    series,
    first: values[0],
    last: values[values.length - 1],
    delta,
    mean: values.reduce((s, v) => s + v, 0) / values.length,
    recentMean: recentSlice.reduce((s, v) => s + v, 0) / recentSlice.length,
    direction: delta === null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down',
  };
}

/**
 * Accuracy ratio (0..1) trend across sessions. Unavailable when no session in
 * the set stores an accuracy-like field.
 */
export function buildAccuracyTrend(sessions: readonly GameSessionRecord[]): MetricTrend {
  return buildExtractedTrend(sessions, (s) => extractAccuracy(s.rawResult));
}

/**
 * Reaction-time (ms) trend across sessions. Lower is better; callers color
 * movement accordingly (see `trendImproved` with `'lower-better'`).
 */
export function buildReactionTrend(sessions: readonly GameSessionRecord[]): MetricTrend {
  return buildExtractedTrend(sessions, (s) => extractReactionMs(s.rawResult));
}
