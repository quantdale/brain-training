/**
 * Per-game analytics for the Progress drill-down.
 *
 * Operates on the canonical `GameSessionRecord` rows for a single game (the
 * caller filters by `gameId`). It derives aggregates, personal records, and
 * trend series from *stored evidence only*: the shared `normalizedResult`, the
 * shared `durationMs`, and game-specific metrics (score / accuracy / reaction
 * time / difficulty) extracted via the best-effort adapter in `metrics-map`.
 *
 * Metrics that a game does not emit are reported as unavailable (`hasX: false`)
 * and their series are left empty — the UI omits the corresponding trend rather
 * than showing a fabricated number.
 */

import type { GameSessionRecord } from '@/db';

import {
  extractAccuracy,
  extractDifficultyRating,
  extractReactionMs,
  extractScore,
} from './metrics-map';
import type { Point } from './types';
import { filterByWindow } from './windows';

/** Personal records and aggregates for one game. */
export interface GameInsight {
  gameId: string;
  /** Total completed sessions. */
  count: number;
  /** Mean normalized performance (0..1) across all sessions. */
  avgNormalized: number;
  /** Best normalized performance (0..1). */
  bestNormalized: number;
  /** Session id of the best-normalized session, or `null`. */
  bestNormalizedSessionId: string | null;
  /** First / most-recent completion timestamps (0 when none). */
  firstCompletedAt: number;
  lastCompletedAt: number;
  /** Fastest completion (min `durationMs`), with its session id. */
  fastestMs: number | null;
  fastestMsSessionId: string | null;
  /** Which game-specific metrics are available in the stored data. */
  available: {
    score: boolean;
    accuracy: boolean;
    reaction: boolean;
    difficulty: boolean;
  };
  /** Best raw score observed (`null` when score is unavailable). */
  bestScore: number | null;
  bestScoreSessionId: string | null;
  /** Best accuracy observed, 0..1 (`null` when unavailable). */
  bestAccuracy: number | null;
  /** Best (lowest) reaction time in ms (`null` when unavailable). */
  bestReactionMs: number | null;
  /** Trend series, oldest first. Empty when the metric is unavailable. */
  series: {
    normalized: Point[];
    score: Point[];
    accuracy: Point[];
    reaction: Point[];
    difficulty: Point[];
  };
}

function sortedByTime(sessions: readonly GameSessionRecord[]): GameSessionRecord[] {
  return sessions.slice().sort((a, b) => a.completedAt - b.completedAt);
}

/**
 * Build the per-game insight from its sessions. `sessions` must all belong to
 * `gameId` (the function does not filter by game). Returns `null` when there are
 * no sessions (caller renders an empty state instead).
 */
export function buildGameInsight(
  gameId: string,
  sessions: readonly GameSessionRecord[],
): GameInsight | null {
  if (sessions.length === 0) {
    return null;
  }

  const ordered = sortedByTime(sessions);

  let sumNormalized = 0;
  let bestNormalized = -Infinity;
  let bestNormalizedSessionId: string | null = null;
  let fastestMs: number | null = null;
  let fastestMsSessionId: string | null = null;
  let bestScore: number | null = null;
  let bestScoreSessionId: string | null = null;
  let bestAccuracy: number | null = null;
  let bestReactionMs: number | null = null;

  const normalizedSeries: Point[] = [];
  const scoreSeries: Point[] = [];
  const accuracySeries: Point[] = [];
  const reactionSeries: Point[] = [];
  const difficultySeries: Point[] = [];

  let hasScore = false;
  let hasAccuracy = false;
  let hasReaction = false;
  let hasDifficulty = false;

  for (const session of ordered) {
    sumNormalized += session.normalizedResult;
    if (session.normalizedResult > bestNormalized) {
      bestNormalized = session.normalizedResult;
      bestNormalizedSessionId = session.id;
    }
    if (fastestMs === null || session.durationMs < fastestMs) {
      fastestMs = session.durationMs;
      fastestMsSessionId = session.id;
    }

    normalizedSeries.push({ t: session.completedAt, value: session.normalizedResult });

    const score = extractScore(session.rawResult);
    if (score !== null) {
      hasScore = true;
      scoreSeries.push({ t: session.completedAt, value: score });
      if (bestScore === null || score > bestScore) {
        bestScore = score;
        bestScoreSessionId = session.id;
      }
    }

    const accuracy = extractAccuracy(session.rawResult);
    if (accuracy !== null) {
      hasAccuracy = true;
      accuracySeries.push({ t: session.completedAt, value: accuracy });
      if (bestAccuracy === null || accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
      }
    }

    const reaction = extractReactionMs(session.rawResult);
    if (reaction !== null) {
      hasReaction = true;
      reactionSeries.push({ t: session.completedAt, value: reaction });
      if (bestReactionMs === null || reaction < bestReactionMs) {
        bestReactionMs = reaction;
      }
    }

    const difficulty = extractDifficultyRating(session.difficulty);
    if (difficulty !== null) {
      hasDifficulty = true;
      difficultySeries.push({ t: session.completedAt, value: difficulty });
    }
  }

  return {
    gameId,
    count: ordered.length,
    avgNormalized: sumNormalized / ordered.length,
    bestNormalized: bestNormalized === -Infinity ? 0 : bestNormalized,
    bestNormalizedSessionId,
    firstCompletedAt: ordered[0].completedAt,
    lastCompletedAt: ordered[ordered.length - 1].completedAt,
    fastestMs,
    fastestMsSessionId,
    available: {
      score: hasScore,
      accuracy: hasAccuracy,
      reaction: hasReaction,
      difficulty: hasDifficulty,
    },
    bestScore,
    bestScoreSessionId,
    bestAccuracy,
    bestReactionMs,
    series: {
      normalized: normalizedSeries,
      score: scoreSeries,
      accuracy: accuracySeries,
      reaction: reactionSeries,
      difficulty: difficultySeries,
    },
  };
}

/**
 * Compare a recent window against the full lifetime for a set of sessions.
 * Returns averages / bests for each, plus signed deltas (recent minus lifetime)
 * for whatever metrics the game supports. `recentWindowKey` selects the recent
 * slice (e.g. `30d`); lifetime always uses every session.
 */
export interface RecentVsLifetime {
  recentCount: number;
  lifetimeCount: number;
  recentAvgNormalized: number | null;
  lifetimeAvgNormalized: number;
  deltaAvgNormalized: number | null;
  recentBestNormalized: number | null;
  lifetimeBestNormalized: number;
  deltaBestNormalized: number | null;
  /** Recent vs lifetime best raw score, when score is available. */
  recentBestScore: number | null;
  lifetimeBestScore: number | null;
  deltaBestScore: number | null;
}

export function compareRecentVsLifetime(
  sessions: readonly GameSessionRecord[],
  recentWindowKey: '7d' | '30d' | '90d',
  nowMs: number,
): RecentVsLifetime {
  const lifetime = sortedByTime(sessions);
  const recent = filterByWindow(lifetime, nowMs, recentWindowKey);

  const avg = (list: GameSessionRecord[]) =>
    list.length === 0 ? null : list.reduce((s, x) => s + x.normalizedResult, 0) / list.length;
  const best = (list: GameSessionRecord[]) =>
    list.length === 0 ? null : list.reduce((m, x) => Math.max(m, x.normalizedResult), -Infinity);
  const bestScore = (list: GameSessionRecord[]) => {
    let value: number | null = null;
    for (const s of list) {
      const sc = extractScore(s.rawResult);
      if (sc !== null && (value === null || sc > value)) {
        value = sc;
      }
    }
    return value;
  };

  const recentAvg = avg(recent);
  const lifetimeAvg = avg(lifetime) ?? 0;
  const recentBest = best(recent);
  const lifetimeBest = best(lifetime);
  const recentScore = bestScore(recent);
  const lifetimeScore = bestScore(lifetime);

  return {
    recentCount: recent.length,
    lifetimeCount: lifetime.length,
    recentAvgNormalized: recentAvg,
    lifetimeAvgNormalized: lifetimeAvg,
    deltaAvgNormalized: recentAvg === null ? null : recentAvg - lifetimeAvg,
    recentBestNormalized: recentBest === null || recentBest === -Infinity ? null : recentBest,
    lifetimeBestNormalized: lifetimeBest === null || lifetimeBest === -Infinity ? 0 : lifetimeBest,
    deltaBestNormalized:
      recentBest === null || recentBest === -Infinity || lifetimeBest === null
        ? null
        : recentBest - lifetimeBest,
    recentBestScore: recentScore,
    lifetimeBestScore: lifetimeScore,
    deltaBestScore:
      recentScore !== null && lifetimeScore !== null ? recentScore - lifetimeScore : null,
  };
}
