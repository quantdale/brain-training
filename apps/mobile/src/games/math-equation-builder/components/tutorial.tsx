/**
 * Tutorial — first-play tutorial for the Equation Builder game.
 * Uses the same pattern as the Memory game tutorial.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { testId } from '@/sdk';

import { GAME_ID } from '../types';

import { GameButton } from './button';

export interface TutorialProps {
  onComplete: () => void;
  onSkip?: () => void;
}

/** Fixed seed used in the tutorial demo. */
export const TUTORIAL_DEMO_SEED = 'equation-builder-tutorial-demo';

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  return (
    <View style={styles.overlay} testID={testId(GAME_ID, 'tutorial')}>
      <ThemedView type="surface" style={styles.card}>
        <ThemedText type="title">How to Play</ThemedText>

        <View style={styles.step}>
          <ThemedText type="subtitle">1. See the target</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A target number is shown at the top.
          </ThemedText>
        </View>

        <View style={styles.step}>
          <ThemedText type="subtitle">2. Use all the numbers</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tap the available numbers to build your equation. You must use ALL of them.
          </ThemedText>
        </View>

        <View style={styles.step}>
          <ThemedText type="subtitle">3. Add operators</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tap +, −, ×, or ÷ between numbers. Equations evaluate left-to-right.
          </ThemedText>
        </View>

        <View style={styles.step}>
          <ThemedText type="subtitle">4. Group with parentheses</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Use the "Group" button to wrap the last operation in parentheses.
          </ThemedText>
        </View>

        <View style={styles.step}>
          <ThemedText type="subtitle">5. Submit and score</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Submit your equation when ready. Faster solves earn more points!
          </ThemedText>
        </View>

        <View style={styles.buttons}>
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
      </ThemedView>
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
    borderRadius: Radii.large,
    padding: Spacing.five,
    gap: Spacing.three,
    maxWidth: 360,
    width: '90%',
  },
  step: {
    gap: Spacing.half,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
});
