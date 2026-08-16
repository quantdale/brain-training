/**
 * Game route — `/game/[id]`.
 *
 * Resolves the id from the generated game registry and renders a placeholder
 * header when the game exists, with a NotReady fallback (registered but not
 * yet implemented, or unknown id). Actual game renderers plug into this route
 * in later waves via the Game SDK.
 */

import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { GameNotReady } from '@/components/game-not-ready';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { getGameDefinition } from '@/registry/registry';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = getGameDefinition(id ?? '');

  if (!game) {
    return (
      <ScreenShell>
        <ThemedText type="title" testID="game-title">
          Game
        </ThemedText>
        <GameNotReady variant="not-found" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ThemedText type="title" testID="game-title">
        {game.name}
      </ThemedText>
      <ThemedView type="accentSoft" style={styles.categoryPill} testID="game-category">
        <ThemedText type="caption" themeColor="accent">
          {game.primaryCategory}
        </ThemedText>
      </ThemedView>
      {game.description ? (
        <ThemedText type="small" themeColor="textSecondary" testID="game-description">
          {game.description}
        </ThemedText>
      ) : null}
      <GameNotReady variant="not-implemented" />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.twoHalf,
  },
});
