/**
 * PauseOverlay — opaque overlay shown when the session is paused.
 * Hides the game board from the accessibility tree and provides
 * resume / quit controls.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { testId } from '@/sdk';

import { GAME_ID } from '../types';

import { GameButton } from './button';

export interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onQuit }: PauseOverlayProps) {
  return (
    <View style={styles.overlay} testID={testId(GAME_ID, 'pause-overlay')}>
      <View style={styles.card}>
        <ThemedText type="title">Paused</ThemedText>
        <View style={styles.buttons}>
          <GameButton testID={testId(GAME_ID, 'resume')} label="Resume" onPress={onResume} />
          <GameButton
            testID={testId(GAME_ID, 'quit')}
            label="Quit"
            variant="secondary"
            onPress={onQuit}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: Radii.large,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.four,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
});
