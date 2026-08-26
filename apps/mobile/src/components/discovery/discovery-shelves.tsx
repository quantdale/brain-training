/**
 * Discovery shelves for the Games library (Campaign 014 W6): transparent,
 * rule-based replay rails computed from already-stored evidence.
 *
 * - "Recommended for today" — the personalization kernel's ranked picks
 *   (weak/undertrained domain, novelty, trend, PB proximity, difficulty fit,
 *   overexposure), exactly the signals Workout V3 orders by.
 * - "Near a personal best" — games whose recent form sits close under their
 *   lifetime best, where one good session sets a new record.
 * - "Getting rusty" — one game per stale/never-trained primary domain.
 *
 * No engagement-optimization tricks: every rail has an understandable rule,
 * and the component renders nothing when there is no evidence yet.
 */
import { Link } from "expo-router";
import { StyleSheet } from "react-native";

import { SectionHeader } from "@/components/shell";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";
import type { AppDatabase } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { useTheme } from "@/hooks/use-theme";
import { buildPersonalizationContext } from "@/personalization/context";
import {
  computeDomainSignals,
  computeGameEvidence,
  personalBestProximityValue,
  undertrainingValue,
} from "@/personalization/signals";
import { scoreGames } from "@/personalization/scoring";
import { registry } from "@/registry/registry.generated";

interface ShelfData {
  /** Load-time clock (captured outside render; gates staleness signals). */
  nowMs: number;
  ratings: { domain: string; rating: number; sessions?: number; updatedAt?: number }[];
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
}

async function loadShelfData(db: AppDatabase): Promise<ShelfData> {
  const [ratings, aggregates, recent] = await Promise.all([
    db.ratings.getRatings(),
    db.sessions.getAggregates(),
    db.sessions.listSummaries({ limit: 30 }),
  ]);
  return { nowMs: Date.now(), ratings, aggregates, recentSessions: recent };
}

const EMPTY: ShelfData = {
  nowMs: 0,
  ratings: [],
  aggregates: [],
  recentSessions: [],
};

export function DiscoveryShelves() {
  const theme = useTheme();
  const { data, loaded } = useDbData(loadShelfData, [], EMPTY);
  if (!loaded) {
    return null;
  }
  const context = buildPersonalizationContext({
    ratings: data.ratings,
    aggregates: data.aggregates,
    recentSessions: data.recentSessions,
    nowMs: data.nowMs,
  });
  const scored = new Map(
    scoreGames(registry, context).map((entry) => [entry.game.id, entry]),
  );

  // Recommended: positive-evidence leaders first (the same ranking V3 uses).
  const recommended = [...scored.values()]
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  // Near a personal best: active signal + genuinely close gap.
  const nearBest = registry.filter((game) => {
    const evidence = computeGameEvidence(game.id, context);
    return (
      personalBestProximityValue(evidence) > 0 &&
      evidence.bestNormalized !== null &&
      evidence.recentBestNormalized !== null &&
      evidence.bestNormalized - evidence.recentBestNormalized <= 0.1 &&
      evidence.bestNormalized > evidence.recentBestNormalized
    );
  }).slice(0, 4);

  // Getting rusty: undertrained/stale primary domains → one game each.
  const signals = computeDomainSignals(data.ratings, { nowMs: data.nowMs });
  const rustyDomains = new Set<string>();
  for (const [domain, summary] of signals) {
    if (summary.stale || undertrainingValue(summary) > 0) {
      rustyDomains.add(domain);
    }
  }
  const rusty =
    rustyDomains.size === 0
      ? []
      : registry.filter((game) => rustyDomains.has(game.primaryCategory)).slice(0, 3);

  if (recommended.length === 0 && nearBest.length === 0 && rusty.length === 0) {
    return null;
  }

  const renderShelf = (
    title: string,
    testID: string,
    entries: { id: string; name: string; note?: string }[],
  ) =>
    entries.length > 0 ? (
      <ThemedView style={styles.shelf} testID={testID}>
        <SectionHeader title={title} />
        {entries.map((entry) => (
          <Link key={entry.id} href={`/game-detail/${entry.id}`} asChild>
            <ThemedView
              type="surface"
              style={StyleSheet.flatten([
                styles.item,
                { borderColor: theme.border },
              ])}
              testID={`${testID}.${entry.id}`}
            >
              <ThemedText type="default" numberOfLines={1}>
                {entry.name}
              </ThemedText>
              {entry.note ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}
                >
                  {entry.note}
                </ThemedText>
              ) : null}
            </ThemedView>
          </Link>
        ))}
      </ThemedView>
    ) : null;

  return (
    <ThemedView testID="games-discovery">
      {renderShelf(
        "Recommended for today",
        "games-discovery-recommended",
        recommended.map((entry) => ({
          id: entry.game.id,
          name: entry.game.name,
          note: entry.components[0]?.reason,
        })),
      )}
      {renderShelf(
        "Near a personal best",
        "games-discovery-near-best",
        nearBest.map((game) => ({ id: game.id, name: game.name })),
      )}
      {renderShelf(
        "Getting rusty",
        "games-discovery-rusty",
        rusty.map((game) => ({ id: game.id, name: game.name })),
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  shelf: {
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  item: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 2,
  },
});
