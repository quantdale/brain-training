/**
 * PauseOverlay — pause surface for the Tap Rush game.
 *
 * Satisfies the SDK `PauseOverlaySpec` (see `createPauseOverlaySpec`): the
 * surface is fully opaque so no challenge pixel can peek through, and while
 * paused the field's children are hidden from the accessibility tree by the
 * screen (importantForAccessibility / accessibilityElementsHidden).
 *
 * Note: `strongBlur: true` is declared via the shared spec; a real blurred
 * backdrop needs `expo-blur`, which is not installed — the binding opaque
 * requirement is met with a solid themed surface instead (same convention as
 * the memory game).
 */
import { StyleSheet, View } from 'react-native';

import { createPauseOverlaySpec, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
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
  const spec = createPauseOverlaySpec(GAME_ID);

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.background }]}
      testID={spec.testID}
      accessibilityLabel={spec.accessibilityLabel}
      accessibilityViewIsModal
      accessible>
      <ThemedText type="headline" testID={testId(GAME_ID, 'pause-title')}>
        Paused
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        The field is hidden and the target window is frozen.
      </ThemedText>
      <View style={styles.actions}>
        <GameButton testID={testId(GAME_ID, 'resume')} label="Resume" onPress={onResume} />
        <GameButton testID={testId(GAME_ID, 'quit')} label="Quit" variant="secondary" onPress={onQuit} />
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
