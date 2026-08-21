/**
 * PauseOverlay — shared opaque pause surface (task 10.2).
 *
 * Canonical pause contract: see `@/sdk/pause` (`createPauseOverlaySpec`).
 * The overlay is fully opaque so no challenge pixel peeks through; the
 * parent screen hides its content from the accessibility tree while
 * paused (importantForAccessibility / accessibilityElementsHidden).
 *
 * Theme-aware, generic: callers supply `gameId`, `onResume`, `onQuit`.
 */
import { StyleSheet, View } from 'react-native';

import { createPauseOverlaySpec, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GameButton } from './game-button';

export interface PauseOverlayProps {
  gameId: string;
  onResume: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ gameId, onResume, onQuit }: PauseOverlayProps) {
  const theme = useTheme();
  const spec = createPauseOverlaySpec(gameId);

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.background }]}
      testID={spec.testID}
      accessibilityLabel={spec.accessibilityLabel}
      accessibilityViewIsModal>
      <ThemedText type="headline" testID={testId(gameId, 'pause-title')}>
        Paused
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        The challenge is hidden and the timers are frozen.
      </ThemedText>
      <View style={styles.actions}>
        <GameButton testID={testId(gameId, 'resume')} label="Resume" onPress={onResume} />
        <GameButton testID={testId(gameId, 'quit')} label="Quit" variant="secondary" onPress={onQuit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radii.large,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
});
