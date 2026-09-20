/**
 * Discovery data seam (Campaign 024). One bounded load feeds the featured
 * hero, the discovery shelves and the library grid's mastery/favourite
 * badges, so the Games screen renders a single consistent snapshot instead of
 * three staggered queries.
 *
 * Ranking reuses the personalization kernel untouched (same signals Workout
 * V3 orders by); this module only shapes its output into shelves. Reloads on
 * screen focus so tiers earned elsewhere land without a remount, and degrades
 * to the evidence-free snapshot when storage is unavailable.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { AppDatabase } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { computeMastery, type MasteryInput, type MasterySummary } from '@/mastery';
import { buildPersonalizationContext } from '@/personalization/context';
import {
  computeDomainSignals,
  computeGameEvidence,
  personalBestProximityValue,
  undertrainingValue,
} from '@/personalization/signals';
import { scoreGames, type ScoredRecommendation } from '@/personalization/scoring';
import { getAllGameDefinitions, type GameDefinition } from '@/registry/registry';

/** Stored evidence a shelf ranking reads (structural subset of the db rows). */
export interface ShelfEvidence {
  ratings: {
    domain: string;
    rating: number;
    sessions?: number;
    updatedAt?: number;
  }[];
  aggregates: {
    gameId: string;
    count: number;
    avgNormalized: number;
    bestNormalized: number;
    lastCompletedAt: number;
  }[];
  recentSessions: {
    gameId: string;
    normalizedResult: number;
    completedAt: number;
  }[];
  nowMs: number;
}

/** Ranked shelves over one evidence snapshot (pure; directly unit-testable). */
export interface Shelves {
  /** Positive-evidence leaders first — the same ranking Workout V3 uses. */
  recommended: ScoredRecommendation[];
  /** Recent form sitting close under the lifetime best. */
  nearBest: GameDefinition[];
  /** One pick per stale/never-trained primary domain. */
  rusty: GameDefinition[];
}

/** Caps keep rails short; shelves expand past them through "See all". */
const RECOMMENDED_CAP = 6;
const NEAR_BEST_CAP = 6;
const RUSTY_CAP = 6;

export function computeShelves(
  games: readonly GameDefinition[],
  evidence: ShelfEvidence,
): Shelves {
  const context = buildPersonalizationContext({
    ratings: evidence.ratings,
    aggregates: evidence.aggregates,
    recentSessions: evidence.recentSessions,
    nowMs: evidence.nowMs,
  });
  const scored = new Map(
    scoreGames(games, context).map((entry) => [entry.game.id, entry]),
  );

  const recommended = [...scored.values()]
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RECOMMENDED_CAP);

  const nearBest = games
    .filter((game) => {
      const gameEvidence = computeGameEvidence(game.id, context);
      return (
        personalBestProximityValue(gameEvidence) > 0 &&
        gameEvidence.bestNormalized !== null &&
        gameEvidence.recentBestNormalized !== null &&
        gameEvidence.bestNormalized - gameEvidence.recentBestNormalized <= 0.1 &&
        gameEvidence.bestNormalized > gameEvidence.recentBestNormalized
      );
    })
    .slice(0, NEAR_BEST_CAP);

  const signals = computeDomainSignals(evidence.ratings, {
    nowMs: evidence.nowMs,
  });
  const rustyDomains = new Set<string>();
  for (const [domain, summary] of signals) {
    if (summary.stale || undertrainingValue(summary) > 0) {
      rustyDomains.add(domain);
    }
  }
  const rusty =
    rustyDomains.size === 0
      ? []
      : games
          .filter((game) => rustyDomains.has(game.primaryCategory))
          .slice(0, RUSTY_CAP);

  return { recommended, nearBest, rusty };
}

/** Everything the Games screen renders below its header. */
export interface DiscoverySnapshot extends Shelves {
  favorites: Set<string>;
  /** Tier summary for every registered game id (unplayed fallback included). */
  masteryByGame: Map<string, MasterySummary>;
}

function summarizeMastery(
  games: readonly GameDefinition[],
  inputs: MasteryInput[],
): Map<string, MasterySummary> {
  const byId = new Map(inputs.map((row) => [row.gameId, row]));
  const out = new Map<string, MasterySummary>();
  for (const game of games) {
    out.set(
      game.id,
      computeMastery(
        byId.get(game.id) ?? {
          gameId: game.id,
          sessions: 0,
          bestNormalized: 0,
          avgNormalized: 0,
          hardStrong: 0,
          expertStrong: 0,
          lastCompletedAt: 0,
        },
      ),
    );
  }
  return out;
}

async function loadDiscovery(db: AppDatabase): Promise<DiscoverySnapshot> {
  const games = getAllGameDefinitions();
  const nowMs = Date.now();
  const [ratings, aggregates, recentSessions, favoriteIds, masteryInputs] =
    await Promise.all([
      db.ratings.getRatings(),
      db.sessions.getAggregates(nowMs),
      db.sessions.listSummaries({ limit: 30, toMs: nowMs }),
      db.favorites.listFavoriteGameIds(),
      db.sessions.getMasteryInputs(nowMs),
    ]);
  return {
    ...computeShelves(games, { ratings, aggregates, recentSessions, nowMs }),
    favorites: new Set(favoriteIds),
    masteryByGame: summarizeMastery(games, masteryInputs),
  };
}

/** Evidence-free snapshot: novelty still ranks the unplayed catalog. */
function fallbackSnapshot(): DiscoverySnapshot {
  const games = getAllGameDefinitions();
  return {
    ...computeShelves(games, { ratings: [], aggregates: [], recentSessions: [], nowMs: 0 }),
    favorites: new Set<string>(),
    masteryByGame: summarizeMastery(games, []),
  };
}

export interface DiscoveryData extends DiscoverySnapshot {
  loaded: boolean;
}

/**
 * Pure snapshot stabilization (061, unit-tested): reuse the previous
 * load's per-game mastery object when its content is identical
 * (JSON-equal: same constructor, stable key order), and the favorites Set
 * when membership is identical. Changed games yield fresh objects so tiles
 * re-render normally. Never mutates either snapshot.
 */
export function stabilizeDiscoverySnapshot(
  prev: DiscoverySnapshot | null,
  next: DiscoverySnapshot,
): DiscoverySnapshot {
  if (prev === null) {
    return next;
  }
  const masteryByGame = new Map<string, MasterySummary>();
  for (const [id, summary] of next.masteryByGame) {
    const old = prev.masteryByGame.get(id);
    masteryByGame.set(
      id,
      old !== undefined && JSON.stringify(old) === JSON.stringify(summary) ? old : summary,
    );
  }
  const favorites = sameMembers(prev.favorites, next.favorites) ? prev.favorites : next.favorites;
  return { ...next, masteryByGame, favorites };
}

export function useDiscoveryData(): DiscoveryData {
  // Every focus bumps the token so the snapshot reflects sessions completed
  // elsewhere; the throw-safe hook degrades to the fallback without storage.
  const [token, setToken] = useState(0);
  useFocusEffect(useCallback(() => setToken((t) => t + 1), []));
  const { data, loaded } = useDbData(loadDiscovery, [token], fallbackSnapshot());
  // 061: stabilize per-game mastery identity across reloads. Fresh loads
  // rebuild every summary object, defeating tile memoization (42 tiles
  // re-render per focus). Reuse the previous object when its content is
  // identical (JSON-equal: same constructor, stable key order); changed
  // games yield fresh objects and re-render normally. Favorites reuse when
  // membership is identical. Shelves stay fresh-computed (few nodes).
  // A new snapshot object is built (no state mutation); the ref write is
  // idempotent across StrictMode double-renders.
  const prevRef = useRef<DiscoverySnapshot | null>(null);
  const stable = useMemo(() => {
    // Deliberate render-phase ref use (no compliant alternative preserves
    // single-paint bailouts): the operation is pure, idempotent, and
    // convergent — re-running it with the same inputs yields the same
    // stabilized snapshot, so StrictMode double-render and concurrent
    // tearing cannot diverge it. An effect-based version would paint twice
    // per load (raw full tile render, then stable), defeating the purpose.
    // eslint-disable-next-line react-hooks/refs
    const next = stabilizeDiscoverySnapshot(prevRef.current, data);
    // eslint-disable-next-line react-hooks/refs
    prevRef.current = next;
    return next;
  }, [data]);
  return { ...stable, loaded };
}

function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const member of a) {
    if (!b.has(member)) {
      return false;
    }
  }
  return true;
}
