/**
 * PauseOverlay — opaque overlay shown when the session is paused.
 *
 * Covers the game board and provides Resume and Quit buttons.
 * The parent hides the game content from the accessibility tree
 * while this overlay is visible.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import { GameButton } from './button';

export interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onQuit }: PauseOverlayProps) {
  const theme = useTheme();

  return (
    <ThemedView type="surface" style={styles.overlay} testID={testId(GAME_ID, 'pause-overlay')}>
      <View style={styles.card}>
        <ThemedText type="headline">Paused</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          The game is paused. Resume when you're ready.
        </ThemedText>
        <View style={styles.actions}>
          <GameButton
            testID={testId(GAME_ID, 'resume')}
            label="Resume"
            onPress={onResume}
          />
          <GameButton
            testID={testId(GAME_ID, 'quit')}
            label="Quit"
            variant="secondary"
            onPress={onQuit}
          />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
    maxWidth: 320,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
