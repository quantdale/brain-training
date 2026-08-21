/**
 * Generic trend summaries for Progress V2 (campaign 010).
 *
 * A `TrendSummary` is a compact, explainable statistical portrait of an
 * already-derived series (domain rating points, per-game normalized results,
 * accuracy ratios, reaction times, difficulty ratings). It invents no new
 * score: every field is a direct restatement of the input points (first, last,
 * min, max, mean, spread, least-squares slope). The optional `consistency`
 * field expresses how steady the series is around its own mean (1 = perfectly
 * flat) so screens can say "steady" vs "swingy" without judging good/bad.
 *
 * Pure and deterministic: same inputs → same summary. No clock reads; callers
 * pass timestamps in via the points themselves.
 */

import type { Direction, Point } from './types';

/** Compact statistical portrait of one series. */
export interface TrendSummary {
  /** Number of points in the series. */
  count: number;
  /** First value (`null` when empty). */
  first: number | null;
  /** Last value (`null` when empty). */
  last: number | null;
  /** `last - first`; `null` when fewer than two points. */
  delta: number | null;
  minimum: number | null;
  maximum: number | null;
  mean: number | null;
  /** Population standard deviation (`null` when fewer than two points). */
  stdDev: number | null;
  /**
   * Steadiness of the series around its own mean, in [0, 1]:
   * `max(0, 1 - stdDev / |mean|)`; exactly `1` for a flat series and `0` when
   * the spread reaches the mean's size. `null` when undefined (fewer than two
   * points, or mean is 0 with nonzero spread — the ratio has no meaning there).
   */
  consistency: number | null;
  /** Signed direction of `delta` (`flat` when zero or unknown). */
  direction: Direction;
  /**
   * Least-squares slope in value-units per day (`null` when fewer than two
   * points or all points share one timestamp). Only meaningful for time-based
   * series; value-only summaries leave it `null`.
   */
  slopePerDay: number | null;
}

function emptySummary(): TrendSummary {
  return {
    count: 0,
    first: null,
    last: null,
    delta: null,
    minimum: null,
    maximum: null,
    mean: null,
    stdDev: null,
    consistency: null,
    direction: 'flat',
    slopePerDay: null,
  };
}

/** Summarize a bare value sequence (no timestamps → no slope). */
export function summarizeTrend(values: readonly number[]): TrendSummary {
  if (values.length === 0) {
    return emptySummary();
  }
  const first = values[0];
  const last = values[values.length - 1];
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  let varianceSum = 0;
  for (const v of values) {
    varianceSum += (v - mean) * (v - mean);
  }
  const stdDev = values.length >= 2 ? Math.sqrt(varianceSum / values.length) : null;

  let consistency: number | null = null;
  if (stdDev !== null) {
    if (stdDev === 0) {
      consistency = 1;
    } else if (mean !== 0) {
      consistency = Math.max(0, Math.min(1, 1 - stdDev / Math.abs(mean)));
    }
  }

  const delta = values.length >= 2 ? last - first : null;
  const direction: Direction = delta === null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';

  return {
    count: values.length,
    first,
    last,
    delta,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    mean,
    stdDev,
    consistency,
    direction,
    slopePerDay: null,
  };
}

/**
 * Summarize a timestamped series, adding the per-day least-squares slope.
 * Points must be ordered ascending by `t` (the analytics convention); the
 * function does not re-sort so caller ordering mistakes stay visible.
 */
export function summarizePointTrend(points: readonly Point[]): TrendSummary {
  const base = summarizeTrend(points.map((p) => p.value));
  if (points.length < 2) {
    return base;
  }
  const t0 = points[0].t;
  const tN = points[points.length - 1].t;
  const spanDays = (tN - t0) / (24 * 60 * 60 * 1000);
  if (spanDays <= 0) {
    return base;
  }
  // Least-squares slope with x re-based to days since the first point, which
  // keeps the arithmetic identical regardless of epoch magnitude.
  const n = points.length;
  const meanX = points.reduce((s, p) => s + (p.t - t0) / (24 * 60 * 60 * 1000), 0) / n;
  const meanY = base.mean ?? 0;
  let num = 0;
  let den = 0;
  for (const p of points) {
    const x = (p.t - t0) / (24 * 60 * 60 * 1000);
    num += (x - meanX) * (p.value - meanY);
    den += (x - meanX) * (x - meanX);
  }
  const slopePerDay = den > 0 ? num / den : null;
  return { ...base, slopePerDay };
}

/**
 * How a trend should be read: `higher-better` (default) treats a rise as an
 * improvement, `lower-better` (reaction time) treats a fall as one, and
 * `neutral` (difficulty) has no good direction.
 */
export type TrendRead = 'higher-better' | 'lower-better' | 'neutral';

/**
 * Whether the trend improved, given how the metric is read. `null` when there
 * is no movement or too little data; `neutral` metrics always yield `null`.
 */
export function trendImproved(
  summary: TrendSummary,
  read: TrendRead = 'higher-better',
): boolean | null {
  if (read === 'neutral' || summary.delta === null || summary.delta === 0) {
    return null;
  }
  return read === 'lower-better' ? summary.delta < 0 : summary.delta > 0;
}
