/**
 * Pause overlay — opaque overlay shown when the game is paused.
 * Duplicated here to avoid cross-module imports.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GameButton } from './button';

interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onQuit }: PauseOverlayProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.background }]}
      testID="pause-overlay"
      accessibilityLabel="Game paused">
      <View style={styles.content}>
        <ThemedText type="title">Paused</ThemedText>
        <View style={styles.buttons}>
          <GameButton testID="resume" label="Resume" onPress={onResume} />
          <GameButton testID="quit" label="Quit" variant="secondary" onPress={onQuit} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  content: {
    alignItems: 'center',
    gap: Spacing.four,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});