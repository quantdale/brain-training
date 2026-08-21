/**
 * Games — library screen (WP-2H).
 *
 * Renders the generated game registry (via `@/registry/registry`) as a card
 * grid with discovery basics (constitution §21): text search over name and
 * description, primary-category filter chips, and a favorites-only toggle
 * backed by the db favorites repository. Each card links to the game detail
 * screen (`/game-detail/[id]`), which hosts the Play CTA.
 *
 * Empty states: `games-empty` when nothing is registered; `games-no-results`
 * when filters match nothing.
 */

import { Link, useFocusEffect } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { MinTouchTarget } from '@/components/a11y';
import { ScreenShell } from '@/components/screen-shell';
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
          <TextInput
            testID="games-search"
            accessibilityLabel="Search games"
            placeholder="Search games…"
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { color: theme.text }]}
          />

          <View style={styles.filterRow} testID="games-filters">
            <FilterChip
              testID="games-filter-all"
              label="All"
              active={category === null}
              onPress={() => setCategory(null)}
            />
            {GAME_CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                testID={`games-filter-${c.toLowerCase().replace(/[^a-z]/g, '')}`}
                label={c}
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

          {visible.length === 0 ? (
            <ThemedView
              type="surface"
              style={styles.emptyCard}
              testID="games-no-results"
              accessibilityLiveRegion="polite">
              <ThemedText type="subtitle">No matches</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Try a different search or filter.
              </ThemedText>
            </ThemedView>
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
          <ThemedText type="subtitle" numberOfLines={1}>
            {game.name}
          </ThemedText>
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
          {isFavorite ? (
            <ThemedText type="caption" themeColor="accent">
              ★
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
  searchInput: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.4)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
