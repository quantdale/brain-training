/**
 * Game detail — `/game-detail/[id]` (Campaign 024 UX wave).
 *
 * Per-game info surface: description, category, versions, favorite toggle
 * (persisted via the db favorites repository), and the single primary Play
 * CTA into `/game/[id]`. Mastery is the hero — a `ProgressRing` with the
 * tier as a numeral plus the concrete next-milestone line. Personal bests
 * render as `StatBlock`s in their metric identity colours; recent sessions
 * are `ListRow`s with role, label and hint into `/results`.
 *
 * Reloads persisted data on focus (a played session pops back here), keeps
 * hooks above the unknown-game early return, and never invents records for
 * an unplayed game.
 */

import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { MinTouchTarget } from "@/components/a11y";
import { masteryTierLabel } from "@/components/discovery/game-card";
import { ScreenShell } from "@/components/screen-shell";
import { StateCard } from "@/components/shell";
import { formatRelativeDay } from "@/components/shell/format";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button, Card, ListRow, ProgressRing, StatBlock } from "@/components/ui";
import { Radii, Spacing } from "@/constants/theme";
import { getDb, type AppDatabase } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { computeMastery, MASTERY_TIERS, type MasteryInput } from "@/mastery";
import { getGameDefinition } from "@/registry/registry";

interface DetailData {
  /** Load-time clock for relative-day formatting (set outside render). */
  nowMs: number;
  favorite: boolean;
  aggregate: {
    count: number;
    avgNormalized: number;
    bestNormalized: number;
    lastCompletedAt: number;
  } | null;
  recent: readonly unknown[];
  /** Campaign 014: mastery evidence for this game (null ⇒ unplayed). */
  masteryInput: MasteryInput | null;
}

function loadDetail(db: AppDatabase, id: string): Promise<DetailData> {
  return (async () => {
    const nowMs = Date.now();
    const [favorite, aggregate, recent, masteryInput] = await Promise.all([
      db.favorites.isFavorite(id),
      db.sessions.getGameAggregate(id, nowMs),
      db.sessions.listByGame(id, 10, nowMs),
      db.sessions.getMasteryInputByGame(id, nowMs),
    ]);
    return { nowMs, favorite, aggregate, recent, masteryInput };
  })();
}

const EMPTY_DETAIL: DetailData = {
  nowMs: 0,
  favorite: false,
  aggregate: null,
  recent: [],
  masteryInput: null,
};

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = getGameDefinition(id ?? "");

  // Reload persisted data whenever the screen regains focus (e.g. after a
  // played session pops back from the game route).
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data, loaded, error } = useDbData(
    (db) => loadDetail(db, id ?? ""),
    [id, refreshKey],
    EMPTY_DETAIL,
  );
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(
    null,
  );
  const [toggleError, setToggleError] = useState(false);

  const currentFavorite = favoriteOverride ?? (loaded ? data.favorite : false);
  // Recovery action for the error state: bumping the key reruns the load.
  const retryLoad = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Hooks stay above the unknown-game early return so the hook count cannot
  // change across navigations between valid and invalid ids.
  const onToggleFavorite = useCallback(async () => {
    if (!game) return;
    try {
      const db = getDb();
      const next = !currentFavorite;
      setFavoriteOverride(next);
      if (next) {
        await db.favorites.setFavorite(game.id);
      } else {
        await db.favorites.removeFavorite(game.id);
      }
      setToggleError(false);
      setRefreshKey((k) => k + 1); // resync the db-backed favorite state
    } catch {
      setFavoriteOverride(null);
      setToggleError(true);
    }
  }, [currentFavorite, game]);

  if (!game) {
    return (
      <ScreenShell>
        <ThemedText type="title" testID="game-detail-title">
          Game
        </ThemedText>
        <ThemedView type="surface" style={styles.card}>
          <ThemedText type="subtitle">Unknown game</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            This game is not in your library. It may have been renamed or
            removed — browse the library to find something to play.
          </ThemedText>
          <Link href="/games" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse the game library"
              testID="game-detail-unknown-browse"
            >
              <ThemedText type="smallBold" themeColor="accent">
                Browse games ›
              </ThemedText>
            </Pressable>
          </Link>
        </ThemedView>
        <BackLink />
      </ScreenShell>
    );
  }

  const nowMs = data.nowMs;
  // Unplayed evidence reads as the bottom tier, so the hero is honest before
  // the first session and before the load settles.
  const summary = computeMastery(
    data.masteryInput ?? {
      gameId: game.id,
      sessions: 0,
      bestNormalized: 0,
      avgNormalized: 0,
      hardStrong: 0,
      expertStrong: 0,
      lastCompletedAt: 0,
    },
  );
  const tierName = masteryTierLabel(summary.tier);
  const tierMax = MASTERY_TIERS.length - 1;

  return (
    <ScreenShell>
      <BackLink />

      <ThemedText type="title" testID="game-detail-title">
        {game.name}
      </ThemedText>
      <ThemedView
        type="accentSoft"
        style={styles.pill}
        testID="game-detail-category"
      >
        <ThemedText type="caption" themeColor="accent">
          {game.primaryCategory}
        </ThemedText>
      </ThemedView>
      {game.description ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          testID="game-detail-description"
        >
          {game.description}
        </ThemedText>
      ) : null}
      {game.hasTutorial ? (
        <ThemedText type="caption" themeColor="textSecondary">
          Includes a short guided tutorial on first play.
        </ThemedText>
      ) : null}

      <Pressable
        testID="game-detail-favorite"
        accessibilityRole="button"
        accessibilityLabel={
          currentFavorite ? "Remove from favorites" : "Add to favorites"
        }
        // `selected` (not `checked`): with role=button, screen readers announce
        // selected/unselected; `checked` is only spoken for toggle/checkbox roles.
        accessibilityState={{ selected: currentFavorite }}
        onPress={onToggleFavorite}
        disabled={!loaded}
      >
        <ThemedView type="surface" style={styles.actionRow}>
          <ThemedText type="subtitle">
            {currentFavorite ? "★ Favorited" : "☆ Add to favorites"}
          </ThemedText>
        </ThemedView>
      </Pressable>
      {toggleError ? (
        <ThemedText
          type="caption"
          themeColor="danger"
          testID="game-detail-fav-error"
          accessibilityLiveRegion="polite"
        >
          Could not update favorites.
        </ThemedText>
      ) : null}

      {/* Mastery hero: the tier as a numeral inside the ring, the concrete
          next milestone beneath it. */}
      <Card variant="hero" padding="lg" testID="game-detail-mastery">
        <View style={styles.masteryRow}>
          <ProgressRing
            value={tierMax > 0 ? summary.rank / tierMax : 0}
            label={`Mastery ${summary.rank} of ${tierMax}, ${tierName}`}
            testID="game-detail-mastery-ring"
          >
            <ThemedText type="numeralXl">{String(summary.rank)}</ThemedText>
          </ProgressRing>
          <View style={styles.masteryTexts}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Mastery
            </ThemedText>
            <ThemedText type="headline">{tierName}</ThemedText>
            <ThemedText type="bodySmall" themeColor="textSecondary">
              {summary.nextMilestone ?? "Mastered — the top tier."}
            </ThemedText>
          </View>
        </View>
      </Card>

      {/* The screen's one primary action. */}
      <Button
        label={`Play ${game.name}`}
        size="lg"
        testID="game-detail-play"
        onPress={() => router.push(`/game/${game.id}`)}
      />

      {!loaded ? (
        <StateCard
          variant="loading"
          title="Loading…"
          message="Fetching your records for this game."
          testID="game-detail-loading"
        />
      ) : error ? (
        <StateCard
          variant="error"
          title="Couldn't load records"
          message="Your history for this game is unavailable right now."
          testID="game-detail-error"
          action={{ label: "Try again", onPress: retryLoad }}
        />
      ) : (
        <>
          <ThemedView
            type="surface"
            style={styles.card}
            testID="game-detail-records"
          >
            <ThemedText type="subtitle">Records</ThemedText>
            {data.aggregate ? (
              <View style={styles.statsRow}>
                <View style={styles.statCell}>
                  <StatBlock
                    label="Sessions"
                    value={String(data.aggregate.count)}
                    delta={`Last played ${formatRelativeDay(data.aggregate.lastCompletedAt, nowMs)}`}
                    testID="game-detail-stat-sessions"
                  />
                </View>
                <View style={styles.statCell}>
                  <StatBlock
                    label="Best"
                    value={`${Math.round(data.aggregate.bestNormalized * 100)}%`}
                    metric="score"
                    testID="game-detail-stat-best"
                  />
                </View>
                <View style={styles.statCell}>
                  <StatBlock
                    label="Average"
                    value={`${Math.round(data.aggregate.avgNormalized * 100)}%`}
                    metric="score"
                    testID="game-detail-stat-average"
                  />
                </View>
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No sessions yet — play once to see records.
              </ThemedText>
            )}
            {/* Drill-down: per-game trends live on the analytics screen. */}
            {data.aggregate ? (
              <Link href={`/progress-game?gameId=${game.id}`} asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View detailed trends for this game"
                  testID="game-detail-stats-link"
                >
                  <ThemedText type="smallBold" themeColor="accent">
                    View detailed trends ›
                  </ThemedText>
                </Pressable>
              </Link>
            ) : null}
          </ThemedView>

          <ThemedView
            type="surface"
            style={styles.card}
            testID="game-detail-recent"
          >
            <ThemedText type="subtitle">Recent sessions</ThemedText>
            {data.recent.length > 0 ? (
              <View>
                {data.recent.map((session) => (
                  <SessionRow
                    key={(session as { id: string }).id}
                    session={session}
                    nowMs={nowMs}
                  />
                ))}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Nothing here yet.
              </ThemedText>
            )}
          </ThemedView>
        </>
      )}

      <ThemedText
        type="caption"
        themeColor="textSecondary"
        testID="game-detail-versions"
      >
        game v{game.gameVersion} · sdk {game.sdkVersion}
        {game.generatorVersion
          ? ` · generator v${game.generatorVersion}`
          : " · curated content"}
      </ThemedText>
    </ScreenShell>
  );
}

function BackLink() {
  return (
    <Pressable
      testID="game-detail-back"
      accessibilityRole="button"
      accessibilityLabel="Back to Games"
      onPress={() => router.back()}
      style={MinTouchTarget}
    >
      <ThemedText type="smallBold" themeColor="accent">
        ‹ Back
      </ThemedText>
    </Pressable>
  );
}

const SessionRow = memo(function SessionRow({
  session,
  nowMs,
}: {
  session: unknown;
  nowMs: number;
}) {
  const s = session as {
    id: string;
    normalizedResult: number;
    xp: number;
    completedAt: number;
    difficulty?: { level?: string } | null;
  };
  const day = formatRelativeDay(s.completedAt, nowMs);
  const percent = Math.round(s.normalizedResult * 100);
  return (
    <ListRow
      testID={`game-detail-session-${s.id}`}
      title={`${day} · ${s.difficulty?.level ?? "?"}`}
      meta={`${percent}% · +${s.xp} XP`}
      onPress={() => router.push(`/results?id=${s.id}`)}
      accessibilityLabel={`Open result from ${day}, ${percent} percent`}
      accessibilityHint="Opens the session result"
    />
  );
});

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: Radii.pill,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.twoHalf,
  },
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  actionRow: {
    borderRadius: Radii.medium,
    padding: Spacing.three,
  },
  masteryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.four,
  },
  masteryTexts: {
    flex: 1,
    flexShrink: 1,
    gap: Spacing.one,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  statCell: {
    flex: 1,
  },
});
