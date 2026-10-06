/**
 * Games — storefront (Campaign 032; Campaign 055 storefront pass).
 *
 * The route has two explicit jobs: Suggested Next answers “what should I play
 * now?” from the existing personalization snapshot, while Browse All answers
 * “what can I choose?” through the complete registry-backed library. Search and
 * filters intentionally hide the suggestion so an intentional lookup never
 * competes with a recommendation.
 *
 * Campaign 055 composition, compacted by change 076: search and the filter
 * rail sit directly under the title so an intentional lookup is always at
 * the top of the screen; the recommendation is a quiet bordered row (never a
 * decorative hero pushing the tools down); the library below is a dense
 * poster grid of `GamePosterTile`s — identity (board-still world art) before
 * metadata. Routing, search matching, favourites and mastery semantics are
 * unchanged.
 */

import { useMemo, useState } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  Spark,
  TextField,
} from '@/components/ui';
import { SectionHeader } from '@/components/shell';
import { useDiscoveryData } from '@/components/discovery/discovery-data';
import { GamePosterTile } from '@/components/discovery/game-poster-tile';
import { getGameIdentity } from '@/components/discovery/game-identity';
import { SuggestedNext } from '@/components/discovery/suggested-next';
import { useTheme } from '@/hooks/use-theme';
import { useGridColumns } from '@/platform/layout';
import { getAllGameDefinitions, type GameDefinition } from '@/registry/registry';
import { GAME_CATEGORIES } from '@/sdk';
import { Spacing } from '@/theme/tokens';

/** The poster grid is never a single column: compact phones go two-up. */
const MIN_GRID_COLUMNS = 2;

function categoryTestID(category: string): string {
  return `games-filter-${category.toLowerCase().replace(/[^a-z]/g, '')}`;
}

/** Split the visible games into poster rows of `columns` tiles. */
function chunkRows(
  games: readonly GameDefinition[],
  columns: number,
): GameDefinition[][] {
  const width = Math.max(1, columns);
  const rows: GameDefinition[][] = [];
  for (let index = 0; index < games.length; index += width) {
    rows.push(games.slice(index, index + width));
  }
  return rows;
}

export default function GamesScreen() {
  const theme = useTheme();
  const games = getAllGameDefinitions();
  // Two-up on phones, following the layout tier once it offers more.
  const columns = Math.max(MIN_GRID_COLUMNS, useGridColumns());
  // Single snapshot for Suggested Next and poster badges (favourites +
  // mastery); refreshes on focus so detail-screen toggles land without a
  // remount.
  const discovery = useDiscoveryData();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);

  // Per-category counts keep the filter chips informative at a glance
  // (information density without a separate stats surface).
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const game of games) {
      counts.set(game.primaryCategory, (counts.get(game.primaryCategory) ?? 0) + 1);
    }
    return counts;
  }, [games]);

  const normalizedQuery = query.trim().toLowerCase();
  // Discovery rails never compete with an intentional lookup.
  const isDefaultView = normalizedQuery.length === 0 && category === null && !favOnly;

  const visible = useMemo(
    () =>
      games.filter((game) => {
        if (category && game.primaryCategory !== category) {
          return false;
        }
        if (favOnly && !discovery.favorites.has(game.id)) {
          return false;
        }
        if (normalizedQuery.length === 0) {
          return true;
        }
        const identity = getGameIdentity(game);
        return (
          game.name.toLowerCase().includes(normalizedQuery) ||
          (game.description ?? '').toLowerCase().includes(normalizedQuery) ||
          game.primaryCategory.toLowerCase().includes(normalizedQuery) ||
          identity.verb.toLowerCase().includes(normalizedQuery) ||
          identity.interaction.toLowerCase().includes(normalizedQuery)
        );
      }),
    [games, category, favOnly, normalizedQuery, discovery.favorites],
  );

  const rows = useMemo(() => chunkRows(visible, columns), [visible, columns]);

  const clearFilters = () => {
    setQuery('');
    setCategory(null);
    setFavOnly(false);
  };

  const hasActiveFilters =
    normalizedQuery.length > 0 || category !== null || favOnly;
  const favoritesEmpty =
    favOnly &&
    normalizedQuery.length === 0 &&
    category === null &&
    discovery.favorites.size === 0;

  return (
    <ScreenShell>
      <View style={styles.headerBlock}>
        <ThemedText type="eyebrow" themeColor="accentText">
          TRAIN YOUR BRAIN
        </ThemedText>
        <ThemedText type="title" testID="games-title">
          Games
        </ThemedText>
        <ThemedText type="bodySmall" themeColor="textSecondary">
          Pick a game to train a skill. New games appear here as they are added.
        </ThemedText>
      </View>

      {games.length === 0 ? (
        <EmptyState
          testID="games-empty"
          icon={<Spark size={40} color={theme.accent} />}
          title="No games yet"
          message="The game library is being built."
        />
      ) : (
        <>
          {/* Search + filters first (change 076): the tools are reachable at
              the top of the screen; the quiet suggestion row follows. */}
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <TextField
                testID="games-search"
                accessibilityLabel="Search all games"
                placeholder="Search games…"
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
              />
            </View>
            {query.length > 0 ? (
              <IconButton
                testID="games-search-clear"
                label="Clear search"
                onPress={() => setQuery('')}
                icon={
                  <ThemedText type="body" themeColor="textSecondary" allowFontScaling={false}>
                    ✕
                  </ThemedText>
                }
              />
            ) : null}
          </View>

          <View style={styles.browseBlock} testID="games-browse-all">
            <SectionHeader title="Browse all games" />
            {/* One scrollable rail instead of a wrapping pill cloud
                (campaign 052: crowded filters pushed the grid down). */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              testID="games-filters">
              <Chip
                testID="games-filter-all"
                label="All"
                count={games.length}
                selected={category === null}
                onPress={() => setCategory(null)}
              />
              {GAME_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  testID={categoryTestID(c)}
                  label={c}
                  count={categoryCounts.get(c) ?? 0}
                  selected={category === c}
                  onPress={() => setCategory(category === c ? null : c)}
                />
              ))}
              <Chip
                testID="games-filter-favorites"
                label="★ Favorites"
                count={discovery.favorites.size}
                selected={favOnly}
                onPress={() => setFavOnly((value) => !value)}
              />
              {hasActiveFilters ? (
                <Button
                  testID="games-filter-reset"
                  label="Reset"
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  onPress={clearFilters}
                />
              ) : null}
              {isDefaultView ? <SuggestedNext data={discovery} /> : null}
        </ScrollView>
          </View>

          {/* Live result count so filtering feedback is explicit. */}
          <ThemedText type="caption" themeColor="textSecondary" testID="games-count">
            Showing {visible.length} of {games.length} games
          </ThemedText>

          {visible.length === 0 ? (
            <EmptyState
              testID={favoritesEmpty ? 'games-favorites-empty' : 'games-no-results'}
              icon={<Spark size={40} color={theme.warning} />}
              title={favoritesEmpty ? 'No favorites yet' : 'No matches'}
              message={
                favoritesEmpty
                  ? 'Favorite a game from its details and it will appear here.'
                  : 'No games match your current search or filters.'
              }
              actionLabel={favoritesEmpty ? 'Browse all games' : 'Clear filters'}
              onAction={clearFilters}
            />
          ) : (
            <View style={styles.grid} testID="games-grid">
              {rows.map((row) => (
                <View key={row[0].id} style={styles.gridRow}>
                  {row.map((game) => (
                    <View key={game.id} style={styles.gridCell}>
                      <GamePosterTile
                        game={game}
                        isFavorite={discovery.favorites.has(game.id)}
                        mastery={discovery.masteryByGame.get(game.id) ?? null}
                      />
                    </View>
                  ))}
                  {/* Keep the last row on the grid's column width. */}
                  {row.length < columns
                    ? Array.from({ length: columns - row.length }, (_, index) => (
                        <View key={`spacer-${index}`} style={styles.gridCell} />
                      ))
                    : null}
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: Spacing.half,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  searchField: {
    flex: 1,
  },
  browseBlock: {
    gap: Spacing.two,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  grid: {
    gap: Spacing.two,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  gridCell: {
    flex: 1,
  },
});
