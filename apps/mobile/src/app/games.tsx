/**
 * Games — library screen.
 *
 * Renders the generated game registry (via `@/registry/registry`) as a card
 * grid. Until games register, shows the empty state. Each card links to the
 * dynamic `app/game/[id].tsx` route.
 */

import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { getAllGameDefinitions } from '@/registry/registry';

export default function GamesScreen() {
  const games = getAllGameDefinitions();

  return (
    <ScreenShell>
      <ThemedText type="title" testID="games-title">
        Games
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Pick a game to train a skill. New games appear here as they are added.
      </ThemedText>

      {games.length === 0 ? (
        <ThemedView type="surface" style={styles.emptyCard} testID="games-empty">
          <ThemedText type="subtitle">No games yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The game library is being built. Games appear here as they are
            registered by the Game SDK.
          </ThemedText>
        </ThemedView>
      ) : (
        <View style={styles.grid} testID="games-grid">
          {games.map((game) => (
            <Link key={game.id} href={`/game/${game.id}`} asChild>
              <Pressable
                testID={`game-card-${game.id}`}
                accessibilityRole="button"
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
                </ThemedView>
              </Pressable>
            </Link>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
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
