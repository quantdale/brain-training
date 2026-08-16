/**
 * GameNotReady — fallback shown inside `app/game/[id].tsx` when a game is
 * registered but not yet implemented, or when the id is unknown.
 *
 * The empty-state semantics are carried by `variant` so the shell's smoke
 * tests can assert which fallback rendered.
 */

import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

export function GameNotReady({
  variant = 'not-implemented',
}: {
  /** `not-implemented` = game exists but has no renderer yet; `not-found` = unknown id. */
  variant?: 'not-implemented' | 'not-found';
}) {
  return (
    <ThemedView type="surface" style={styles.card}>
      <View style={styles.content}>
        <ThemedText type="subtitle" themeColor="text">
          {variant === 'not-found' ? 'Game not found' : 'Not ready yet'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          {variant === 'not-found'
            ? 'This game is not in the library. It may have been renamed or removed.'
            : 'This game is registered but its implementation lands in a later wave. Check the library again soon.'}
        </ThemedText>
        <Link href="/games" asChild>
          <Pressable
            testID={`game-not-ready-${variant === 'not-found' ? 'not-found' : 'back-to-library'}`}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <ThemedText type="smallBold" themeColor="accent">
              Back to library
            </ThemedText>
          </Pressable>
        </Link>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  content: {
    gap: Spacing.two,
  },
  body: {
    marginBottom: Spacing.two,
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.6,
  },
});
