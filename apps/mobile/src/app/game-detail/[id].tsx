/**
 * Game detail — `/game-detail/[id]`.
 *
 * Per-game info surface (WP-2H): description, category, versions, favorite
 * toggle (persisted via the db favorites repository), records/aggregates and
 * recent session history from the persistence layer, and a Play CTA into the
 * game route. Back navigation returns to the library.
 */

import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { getDb, type AppDatabase } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { getGameDefinition } from '@/registry/registry';

interface DetailData {
  favorite: boolean;
  aggregate: { count: number; avgNormalized: number; bestNormalized: number; lastCompletedAt: number } | null;
  recent: readonly unknown[];
}

function loadDetail(db: AppDatabase, id: string): Promise<DetailData> {
  return (async () => {
    const [favorite, aggregate, recent] = await Promise.all([
      db.favorites.isFavorite(id),
      db.sessions.getGameAggregate(id),
      db.sessions.listByGame(id, 10),
    ]);
    return { favorite, aggregate, recent };
  })();
}

const EMPTY_DETAIL: DetailData = { favorite: false, aggregate: null, recent: [] };

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = getGameDefinition(id ?? '');

  // Reload persisted data whenever the screen regains focus (e.g. after a
  // played session pops back from the game route).
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data, loaded } = useDbData(
    (db) => loadDetail(db, id ?? ''),
    [id, refreshKey],
    EMPTY_DETAIL,
  );
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(null);
  const [toggleError, setToggleError] = useState(false);

  if (!game) {
    return (
      <ScreenShell>
        <ThemedText type="title" testID="game-detail-title">
          Game
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Unknown game.
        </ThemedText>
        <BackLink />
      </ScreenShell>
    );
  }

  const currentFavorite = favoriteOverride ?? (loaded ? data.favorite : false);

  // Hook must be called unconditionally before early return — keep it above the game null guard.
  // eslint-disable-next-line react-hooks/rules-of-hooks, react-hooks/preserve-manual-memoization
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

  return (
    <ScreenShell>
      <BackLink />

      <ThemedText type="title" testID="game-detail-title">
        {game.name}
      </ThemedText>
      <ThemedView type="accentSoft" style={styles.pill} testID="game-detail-category">
        <ThemedText type="caption" themeColor="accent">
          {game.primaryCategory}
        </ThemedText>
      </ThemedView>
      {game.description ? (
        <ThemedText type="small" themeColor="textSecondary" testID="game-detail-description">
          {game.description}
        </ThemedText>
      ) : null}

      <Pressable
        testID="game-detail-favorite"
        accessibilityRole="button"
        accessibilityLabel={currentFavorite ? 'Remove from favorites' : 'Add to favorites'}
        accessibilityState={{ checked: currentFavorite }}
        onPress={onToggleFavorite}
        disabled={!loaded}>
        <ThemedView type="surface" style={styles.actionRow}>
          <ThemedText type="subtitle">{currentFavorite ? '★ Favorited' : '☆ Add to favorites'}</ThemedText>
        </ThemedView>
      </Pressable>
      {toggleError ? (
        <ThemedText type="caption" themeColor="danger" testID="game-detail-fav-error">
          Could not update favorites.
        </ThemedText>
      ) : null}

      <Link href={`/game/${game.id}`} asChild>
        <Pressable
          testID="game-detail-play"
          accessibilityRole="button"
          accessibilityLabel={`Play ${game.name}`}
          style={styles.playButton}>
          <ThemedText type="smallBold" themeColor="accent">
            Play {game.name}
          </ThemedText>
        </Pressable>
      </Link>

      <ThemedView type="surface" style={styles.card} testID="game-detail-records">
        <ThemedText type="subtitle">Records</ThemedText>
        {data.aggregate ? (
          <View style={styles.rows}>
            <DetailRow label="Sessions" value={String(data.aggregate.count)} />
            <DetailRow label="Best" value={`${Math.round(data.aggregate.bestNormalized * 100)}%`} />
            <DetailRow label="Average" value={`${Math.round(data.aggregate.avgNormalized * 100)}%`} />
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No sessions yet — play once to see records.
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="game-detail-recent">
        <ThemedText type="subtitle">Recent sessions</ThemedText>
        {data.recent.length > 0 ? (
          <View style={styles.rows}>
            {data.recent.map((session) => (
              <SessionRow key={(session as { id: string }).id} session={session} />
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Nothing here yet.
          </ThemedText>
        )}
      </ThemedView>

      <ThemedText type="caption" themeColor="textSecondary" testID="game-detail-versions">
        game v{game.gameVersion} · sdk {game.sdkVersion}
        {game.generatorVersion ? ` · generator v${game.generatorVersion}` : ' · curated content'}
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
      onPress={() => router.back()}>
      <ThemedText type="smallBold" themeColor="accent">
        ‹ Back
      </ThemedText>
    </Pressable>
  );
}

const DetailRow = memo(function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
});

const SessionRow = memo(function SessionRow({ session }: { session: unknown }) {
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
        accessibilityLabel={`Open result from ${new Date(s.completedAt).toLocaleDateString()}`}
        style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          {new Date(s.completedAt).toLocaleDateString()} · {s.difficulty?.level ?? '?'}
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
    alignSelf: 'flex-start',
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
    borderRadius: Radii.large,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  rows: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
