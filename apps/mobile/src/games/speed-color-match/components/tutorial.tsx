/**
 * Tutorial overlay for the Speed Color Match game.
 *
 * Shows a brief explanation of the game mechanic: match the swatch color,
 * ignore the text color. Includes a demo trial.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID, COLOR_HEX } from '../types';
import { GameButton } from './button';

export const TUTORIAL_DEMO_SEED = 'speed-color-match-tutorial-demo';

export interface TutorialProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.background }]}
      testID={testId(GAME_ID, 'tutorial')}
      accessibilityViewIsModal
      accessible>
      <ThemedText type="title">How to Play</ThemedText>
      <ThemedText type="bodyLarge" style={styles.instruction}>
        A color swatch is shown with a color name. Tap the button matching the
        <ThemedText type="bodyLarge" style={{ color: COLOR_HEX.red }}> SWATCH </ThemedText>
        color, not the text color!
      </ThemedText>

      <View style={styles.demo}>
        <View style={[styles.demoSwatch, { backgroundColor: COLOR_HEX.blue }]} />
        <ThemedText type="headline" style={{ color: COLOR_HEX.red }}>
          RED
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          You would tap BLUE here (matching the swatch)
        </ThemedText>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Faster responses earn more points. Streaks give bonus points!
      </ThemedText>

      <View style={styles.actions}>
        <GameButton
          testID={testId(GAME_ID, 'tutorial-done')}
          label="Got it!"
          onPress={onComplete}
        />
        {onSkip ? (
          <GameButton
            testID={testId(GAME_ID, 'tutorial-skip')}
            label="Skip"
            variant="secondary"
            onPress={onSkip}
          />
        ) : null}
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
  instruction: {
    textAlign: 'center',
    lineHeight: 24,
  },
  demo: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: '#00000022',
  },
  demoSwatch: {
    width: 80,
    height: 80,
    borderRadius: Radii.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
