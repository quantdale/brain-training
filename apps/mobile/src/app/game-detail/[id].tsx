/**
 * Game detail — `/game-detail/[id]`.
 *
 * Per-game info surface (WP-2H + W13 UX wave): description, category,
 * versions, favorite toggle (persisted via the db favorites repository),
 * records/aggregates (including last-played recency) and recent session
 * history from the persistence layer, and a prominent Play CTA into the game
 * route. Back navigation returns to the library.
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
import { ScreenShell } from "@/components/screen-shell";
import { InfoRow } from "@/components/shell";
import { formatRelativeDay } from "@/components/shell/format";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";
import { getDb, type AppDatabase } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
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
}

function loadDetail(db: AppDatabase, id: string): Promise<DetailData> {
  return (async () => {
    const [favorite, aggregate, recent] = await Promise.all([
      db.favorites.isFavorite(id),
      db.sessions.getGameAggregate(id),
      db.sessions.listByGame(id, 10),
    ]);
    return { nowMs: Date.now(), favorite, aggregate, recent };
  })();
}

const EMPTY_DETAIL: DetailData = {
  nowMs: 0,
  favorite: false,
  aggregate: null,
  recent: [],
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

  const { data, loaded } = useDbData(
    (db) => loadDetail(db, id ?? ""),
    [id, refreshKey],
    EMPTY_DETAIL,
  );
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(
    null,
  );
  const [toggleError, setToggleError] = useState(false);

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
        </ThemedView>
        <BackLink />
      </ScreenShell>
    );
  }

  const currentFavorite = favoriteOverride ?? (loaded ? data.favorite : false);

  // Hook must be called unconditionally before early return — keep it above the game null guard.
  // eslint-disable-next-line react-hooks/rules-of-hooks
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
    } catch (error) {
      setFavoriteOverride(null);
      setToggleError(true);
    }
  }, [currentFavorite, game?.id]);

  const nowMs = data.nowMs;

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

      {/* Primary CTA: filled pill so the main action reads as the main action. */}
      <Link href={`/game/${game.id}`} asChild>
        <Pressable
          testID="game-detail-play"
          accessibilityRole="button"
          accessibilityLabel={`Play ${game.name}`}
        >
          <ThemedView type="accentSoft" style={styles.playButton}>
            <ThemedText type="bodyLarge" themeColor="accent">
              Play {game.name}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>

      <ThemedView
        type="surface"
        style={styles.card}
        testID="game-detail-records"
      >
        <ThemedText type="subtitle">Records</ThemedText>
        {data.aggregate ? (
          <View style={styles.rows}>
            <InfoRow label="Sessions" value={String(data.aggregate.count)} />
            <InfoRow
              label="Best"
              value={`${Math.round(data.aggregate.bestNormalized * 100)}%`}
            />
            <InfoRow
              label="Average"
              value={`${Math.round(data.aggregate.avgNormalized * 100)}%`}
            />
            <InfoRow
              label="Last played"
              value={formatRelativeDay(data.aggregate.lastCompletedAt, nowMs)}
            />
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No sessions yet — play once to see records.
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView
        type="surface"
        style={styles.card}
        testID="game-detail-recent"
      >
        <ThemedText type="subtitle">Recent sessions</ThemedText>
        {data.recent.length > 0 ? (
          <View style={styles.rows}>
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
  return (
    <Link href={`/results?id=${s.id}`} asChild>
      <Pressable
        testID={`game-detail-session-${s.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Open result from ${formatRelativeDay(s.completedAt, nowMs)}, ${Math.round(s.normalizedResult * 100)} percent`}
        // Flatten: array styles inside asChild Links throw in expo-router's
        // Radix Slot shim (dev builds) — campaign 011 device finding.
        style={StyleSheet.flatten([styles.row, MinTouchTarget])}
      >
        <ThemedText type="small" themeColor="textSecondary">
          {formatRelativeDay(s.completedAt, nowMs)} ·{" "}
          {s.difficulty?.level ?? "?"}
        </ThemedText>
        <ThemedText type="smallBold">
          {Math.round(s.normalizedResult * 100)}% · +{s.xp} XP
        </ThemedText>
      </Pressable>
    </Link>
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
  playButton: {
    ...MinTouchTarget,
    borderRadius: Radii.large,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.three,
  },
  rows: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
});
