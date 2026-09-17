/**
 * Answer-first summaries for the Progress overview.
 *
 * These helpers only restate persisted session/rating evidence. They do not
 * alter scoring, rating updates, persistence, or the existing analytics
 * contracts. Keeping the disclosure rules pure makes sparse-window and
 * recommendation states deterministic and easy to exercise without a device.
 */

import type { GameSessionRecord } from "@/db";

import type { DomainInsight } from "./domain-insights";
import type { TrainingBalance } from "./training-balance";
import { filterByWindow } from "./windows";
import type { Direction, TimeWindowKey } from "./types";
import { utcDateKey } from "./format";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The compact consistency evidence shown above the deeper analytics. */
export interface ProgressConsistency {
  /** Sessions completed inside the selected window. */
  sessions: number;
  /** Distinct UTC days with at least one selected-window session. */
  activeDays: number;
  /** Sessions divided by active days, or 0 when there are no active days. */
  averagePerActiveDay: number;
}

/** Whether a selected window has enough evidence for a movement statement. */
export type ProgressMovementStatus = "empty" | "insufficient" | "observed";

/** A cautious, plain-language movement input for the overview. */
export interface ProgressMovement {
  status: ProgressMovementStatus;
  /** Number of sessions in the selected window. */
  sampleSize: number;
  /** Selected-window average when one exists. */
  average: number | null;
  /** First selected result, used by the all-time series comparison. */
  first: number | null;
  /** Latest selected result, used by the all-time series comparison. */
  latest: number | null;
  /** Signed movement in normalized-result units. */
  delta: number | null;
  /** How the delta should be narrated. */
  comparison: "window-average" | "first-to-latest" | "none";
  direction: Direction;
}

/** Reason a domain is a useful next consideration, without ranking ability. */
export type NextConsiderationReason =
  "not-trained" | "not-recent" | "least-practiced";

/** A single evidence-backed domain consideration for the overview. */
export interface NextConsideration {
  domain: string;
  reason: NextConsiderationReason;
  sessionsInWindow: number;
  daysSinceUpdate: number | null;
}

/**
 * Summarize training rhythm for exactly the same window as the selector.
 * Unlike the fixed-size activity heatmap, `all` really includes all stored
 * sessions, so the answer cannot accidentally describe only the last 84 days.
 */
export function buildProgressConsistency(
  sessions: readonly GameSessionRecord[],
  nowMs: number,
  windowKey: TimeWindowKey,
): ProgressConsistency {
  const inWindow = filterByWindow(sessions, nowMs, windowKey);
  const days = new Set(
    inWindow.map((session) => utcDateKey(session.completedAt)),
  );
  return {
    sessions: inWindow.length,
    activeDays: days.size,
    averagePerActiveDay: days.size > 0 ? inWindow.length / days.size : 0,
  };
}

function movementDirection(delta: number | null): Direction {
  if (delta === null || delta === 0) return "flat";
  return delta > 0 ? "up" : "down";
}

/**
 * Build one conservative movement statement. Bounded windows compare their
 * average with the lifetime average; all-time uses the first-to-latest result
 * because comparing all-time with itself would be a meaningless zero.
 * Fewer than two selected sessions are explicitly insufficient for movement.
 */
export function buildProgressMovement(
  sessions: readonly GameSessionRecord[],
  nowMs: number,
  windowKey: TimeWindowKey,
): ProgressMovement {
  const selected = filterByWindow(sessions, nowMs, windowKey).sort(
    (a, b) => a.completedAt - b.completedAt,
  );
  const sampleSize = selected.length;
  if (sampleSize === 0) {
    return {
      status: "empty",
      sampleSize,
      average: null,
      first: null,
      latest: null,
      delta: null,
      comparison: "none",
      direction: "flat",
    };
  }

  const average =
    selected.reduce((sum, session) => sum + session.normalizedResult, 0) /
    sampleSize;
  const first = selected[0].normalizedResult;
  const latest = selected[selected.length - 1].normalizedResult;
  if (sampleSize < 2) {
    return {
      status: "insufficient",
      sampleSize,
      average,
      first,
      latest,
      delta: null,
      comparison: "none",
      direction: "flat",
    };
  }

  if (windowKey === "all") {
    const delta = latest - first;
    return {
      status: "observed",
      sampleSize,
      average,
      first,
      latest,
      delta,
      comparison: "first-to-latest",
      direction: movementDirection(delta),
    };
  }

  const lifetimeAverage =
    sessions.length > 0
      ? sessions.reduce((sum, session) => sum + session.normalizedResult, 0) /
        sessions.length
      : average;
  const delta = average - lifetimeAverage;
  return {
    status: "observed",
    sampleSize,
    average,
    first,
    latest,
    delta,
    comparison: "window-average",
    direction: movementDirection(delta),
  };
}

/**
 * Choose one domain to consider next. The ordering is deliberately
 * understandable: never trained in the selected window, then stale, then
 * least practiced. Ties retain the canonical order supplied by analytics.
 */
export function buildNextConsideration(
  insights: readonly DomainInsight[],
  balance: TrainingBalance,
): NextConsideration | null {
  const byDomain = new Map(
    insights.map((insight) => [insight.domain, insight]),
  );

  const untrained = balance.untrainedDomains.find((domain) =>
    byDomain.has(domain),
  );
  if (untrained) {
    const insight = byDomain.get(untrained);
    return {
      domain: untrained,
      reason: "not-trained",
      sessionsInWindow: 0,
      daysSinceUpdate: insight?.daysSinceUpdate ?? null,
    };
  }

  const stale = insights
    .filter((insight) => insight.status === "stale")
    .slice()
    .sort((a, b) => (b.daysSinceUpdate ?? -1) - (a.daysSinceUpdate ?? -1))[0];
  if (stale) {
    const entry = balance.perDomain.find(
      (item) => item.domain === stale.domain,
    );
    return {
      domain: stale.domain,
      reason: "not-recent",
      sessionsInWindow: entry?.sessions ?? 0,
      daysSinceUpdate: stale.daysSinceUpdate,
    };
  }

  const least = balance.perDomain[balance.perDomain.length - 1];
  if (!least) return null;
  const insight = byDomain.get(least.domain);
  return {
    domain: least.domain,
    reason: "least-practiced",
    sessionsInWindow: least.sessions,
    daysSinceUpdate: insight?.daysSinceUpdate ?? null,
  };
}

/** Human-readable day count used by overview copy without touching a clock. */
export function formatDaysSince(days: number | null): string {
  if (days === null) return "not recorded";
  return days === 0 ? "today" : `${days}d ago`;
}

/** Keep the day constant available to tests/callers that need exact math. */
export const PROGRESS_DAY_MS = DAY_MS;
