/**
 * Personal-best history for Progress V2: the chronological chain of "new best"
 * events derived strictly from stored evidence.
 *
 * A personal-best event is a session whose value strictly exceeds every earlier
 * one in the set (ties keep the earliest, matching the existing best-tracking
 * convention in `game-insights` / `domain-insights`). The chain answers the
 * questions the record cards cannot: how many times the best was beaten, when
 * it was last raised, and how long the current best has stood.
 */

import type { GameSessionRecord } from '@/db';

import { extractScore } from './metrics-map';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One "new best" event. */
export interface PersonalBestEvent {
  /** Epoch ms of the session that set the best. */
  t: number;
  /** The best value as of this event. */
  value: number;
  /** Owning session id, when the caller can supply one. */
  sessionId: string | null;
}

/** Full personal-best history over a chronological value series. */
export interface PersonalBestHistory {
  /** Strictly improving chain of bests, oldest first. Empty when no points. */
  events: PersonalBestEvent[];
  /** The current (latest) best, or `null` with no data. */
  current: PersonalBestEvent | null;
  /** The best before the current one, or `null` when never beaten. */
  previous: PersonalBestEvent | null;
  /** How many times the initial best was beaten (`events.length - 1`). */
  timesBeaten: number;
  /** Whole days the current best has stood (`null` with no data). */
  standingDays: number | null;
}

/** Minimal point shape accepted by the builder. */
export interface BestPoint {
  t: number;
  value: number;
  sessionId?: string | null;
}

/**
 * Build the PB history from points ordered in any direction; they are sorted
 * ascending by `t` first so the chain is deterministic regardless of input
 * order. Ties on value keep the earliest holder. Sessions sharing one exact
 * timestamp (duplicate/batch imports) collapse to that instant's maximum
 * before scanning — otherwise the chain would depend on which of the tied
 * rows happened to be read first, breaking the order-independence promise.
 */
export function buildPersonalBestHistory(
  points: readonly BestPoint[],
  nowMs: number,
): PersonalBestHistory {
  const ordered = points.slice().sort((a, b) => a.t - b.t);
  // Collapse equal-timestamp groups to their maximum (first row wins exact
  // (t, value) duplicates), making the chain a function of the row set alone.
  const perInstant: BestPoint[] = [];
  for (const p of ordered) {
    const prev = perInstant[perInstant.length - 1];
    if (prev && prev.t === p.t) {
      if (p.value > prev.value) {
        perInstant[perInstant.length - 1] = p;
      }
    } else {
      perInstant.push(p);
    }
  }
  const events: PersonalBestEvent[] = [];
  let best = -Infinity;
  for (const p of perInstant) {
    if (p.value > best) {
      best = p.value;
      events.push({ t: p.t, value: p.value, sessionId: p.sessionId ?? null });
    }
  }
  const current = events.length > 0 ? events[events.length - 1] : null;
  return {
    events,
    current,
    previous: events.length >= 2 ? events[events.length - 2] : null,
    timesBeaten: Math.max(0, events.length - 1),
    standingDays:
      current === null ? null : Math.max(0, Math.floor((nowMs - current.t) / DAY_MS)),
  };
}

/** Map sessions to normalized-performance PB points (every session has one). */
export function normalizedBestPoints(
  sessions: readonly GameSessionRecord[],
): BestPoint[] {
  return sessions.map((s) => ({ t: s.completedAt, value: s.normalizedResult, sessionId: s.id }));
}

/** Map sessions to raw-score PB points; sessions without a score are skipped. */
export function scoreBestPoints(sessions: readonly GameSessionRecord[]): BestPoint[] {
  const out: BestPoint[] = [];
  for (const s of sessions) {
    const score = extractScore(s.rawResult);
    if (score !== null) {
      out.push({ t: s.completedAt, value: score, sessionId: s.id });
    }
  }
  return out;
}

/** Convenience: PB history of the shared normalized performance scale. */
export function buildNormalizedBestHistory(
  sessions: readonly GameSessionRecord[],
  nowMs: number,
): PersonalBestHistory {
  return buildPersonalBestHistory(normalizedBestPoints(sessions), nowMs);
}

/** Convenience: PB history of the raw in-game score (when persisted). */
export function buildScoreBestHistory(
  sessions: readonly GameSessionRecord[],
  nowMs: number,
): PersonalBestHistory | null {
  const points = scoreBestPoints(sessions);
  return points.length === 0 ? null : buildPersonalBestHistory(points, nowMs);
}
