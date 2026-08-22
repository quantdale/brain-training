/**
 * Games — library screen (WP-2H + W13 UX wave).
 *
 * Renders the generated game registry (via `@/registry/registry`) as a card
 * grid with discovery basics (constitution §21): text search over name and
 * description, primary-category filter chips (with per-category counts), a
 * favorites-only toggle backed by the db favorites repository, and a live
 * result count. Each card links to the game detail screen
 * (`/game-detail/[id]`), which hosts the Play CTA.
 *
 * Empty states: `games-empty` when nothing is registered; `games-no-results`
 * when filters match nothing (with a one-tap Clear-filters recovery action).
 * The search field carries an inline clear button once a query is typed.
 * when filters match nothing (with a one-tap Clear-filters recovery action).
 */

import { Link, useFocusEffect } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { MinTouchTarget } from '@/components/a11y';
import { ScreenShell } from '@/components/screen-shell';
import { StateCard } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { useDbData } from '@/hooks/use-db-data';
import { useTheme } from '@/hooks/use-theme';
import { getAllGameDefinitions } from '@/registry/registry';
import { GAME_CATEGORIES } from '@/sdk';

export default function GamesScreen() {
  const games = getAllGameDefinitions();
  const theme = useTheme();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);

  // Reload favorites whenever the tab regains focus (favorites are toggled
  // on the detail screen and must appear here without a remount).
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data: favorites } = useDbData(
    (db) => db.favorites.listFavoriteGameIds(),
    [refreshKey],
    [] as string[],
  );
  const favoriteSet = new Set(favorites);

  // Per-category counts keep the filter chips informative at a glance
  // (information density without a separate stats surface).
  const categoryCounts = new Map<string, number>();
  for (const game of games) {
    categoryCounts.set(
      game.primaryCategory,
      (categoryCounts.get(game.primaryCategory) ?? 0) + 1,
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visible = games.filter((game) => {
    if (category && game.primaryCategory !== category) {
      return false;
    }
    if (favOnly && !favoriteSet.has(game.id)) {
      return false;
    }
    if (normalizedQuery.length === 0) {
      return true;
    }
    return (
      game.name.toLowerCase().includes(normalizedQuery) ||
      (game.description ?? '').toLowerCase().includes(normalizedQuery) ||
      game.primaryCategory.toLowerCase().includes(normalizedQuery)
    );
  });

  const clearFilters = useCallback(() => {
    setQuery('');
    setCategory(null);
    setFavOnly(false);
  }, []);

  return (
    <ScreenShell>
      <ThemedText type="title" testID="games-title">
        Games
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Pick a game to train a skill. New games appear here as they are added.
      </ThemedText>

      {games.length === 0 ? (
        <ThemedView
          type="surface"
          style={styles.emptyCard}
          testID="games-empty"
          accessibilityLiveRegion="polite">
          <ThemedText type="subtitle">No games yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The game library is being built. Games appear here as they are
            registered by the Game SDK.
          </ThemedText>
        </ThemedView>
      ) : (
        <>
          <View style={styles.searchRow}>
            <TextInput
              testID="games-search"
              accessibilityLabel="Search games"
              placeholder="Search games…"
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.searchInput, styles.searchInputFlex, { color: theme.text }]}
            />
            {query.length > 0 ? (
              <Pressable
                testID="games-search-clear"
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                style={({ pressed }) => [styles.searchClear, pressed && styles.pressed]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  ✕
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterRow} testID="games-filters">
            <FilterChip
              testID="games-filter-all"
              label={`All · ${games.length}`}
              active={category === null}
              onPress={() => setCategory(null)}
            />
            {GAME_CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                testID={`games-filter-${c.toLowerCase().replace(/[^a-z]/g, '')}`}
                label={`${c} · ${categoryCounts.get(c) ?? 0}`}
                active={category === c}
                onPress={() => setCategory(category === c ? null : c)}
              />
            ))}
            <FilterChip
              testID="games-filter-favorites"
              label="★ Favorites"
              active={favOnly}
              onPress={() => setFavOnly(!favOnly)}
            />
          </View>

          {/* Live result count so filtering feedback is explicit. */}
          <ThemedText type="caption" themeColor="textSecondary" testID="games-count">
            Showing {visible.length} of {games.length} games
          </ThemedText>

          {visible.length === 0 ? (
            <StateCard
              variant="empty"
              title="No matches"
              message="No games match your current search or filters."
              testID="games-no-results"
              action={{
                label: 'Clear filters',
                onPress: clearFilters,
                accessibilityLabel: 'Clear search and filters',
              }}
            />
          ) : (
            <View style={styles.grid} testID="games-grid">
              {visible.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  isFavorite={favoriteSet.has(game.id)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScreenShell>
  );
}

function FilterChip({
  testID,
  label,
  active,
  onPress,
}: {
  testID: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}>
      <ThemedView type={active ? 'accentSoft' : 'surface'} style={styles.chip}>
        <ThemedText type="caption" themeColor={active ? 'accent' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/**
 * Memoized game card. `game` and `isFavorite` are stable per render of the list
 * (the registry object never changes, favorites is a boolean), so memoizing
 * keeps unchanged cards from re-rendering when the search box or another card's
 * favorite state changes. The internal `Link`/`Pressable` is recreated only when
 * this card's own props change.
 */
const GameCard = memo(function GameCard({
  game,
  isFavorite,
}: {
  game: { id: string; name: string; primaryCategory: string; description?: string };
  isFavorite: boolean;
}) {
  return (
    <Link key={game.id} href={`/game-detail/${game.id}`} asChild>
      <Pressable
        testID={`game-card-${game.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${game.name}, ${game.primaryCategory} game${isFavorite ? ', favorited' : ''}`}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="surface" style={styles.card}>
          {/* Name + favorite marker share the top row so the star reads as a
              card-level badge instead of orphaning below the description. */}
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle" numberOfLines={1} style={styles.cardTitle}>
              {game.name}
            </ThemedText>
            {isFavorite ? (
              <ThemedText
                type="caption"
                themeColor="accent"
                accessibilityLabel="Favorited">
                ★
              </ThemedText>
            ) : null}
          </View>
          <ThemedView type="accentSoft" style={styles.categoryPill}>
            <ThemedText type="caption" themeColor="accent">
              {game.primaryCategory}
            </ThemedText>
          </ThemedView>
          {game.description ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
              {game.description}
            </ThemedText>
          ) : null}
        </ThemedView>
      </Pressable>
    </Link>
  );
});

const styles = StyleSheet.create({
  emptyCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchInput: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.4)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  searchInputFlex: {
    flex: 1,
  },
  searchClear: {
    ...MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    ...MinTouchTarget,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.twoHalf,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  card: {
    flexBasis: '45%',
    flexGrow: 1,
    minWidth: 150,
    borderRadius: Radii.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: {
    flexShrink: 1,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.twoHalf,
  },
  pressed: {
    opacity: 0.7,
  },
});
