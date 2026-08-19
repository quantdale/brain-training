/**
 * Tutorial — explains the Color Stroop game mechanics (campaign 006R canary A).
 *
 * Multi-step card: welcome, the INK rule, rule-change flips, and speed. The
 * local board/demo pieces stay here; the consistent card shell + testID are
 * provided by the shared `TutorialFrame` so per-game copies don't each
 * reinvent the same surface. `GameButton` is the shared primitive.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { testId, isDevBuild } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { GameButton, TutorialFrame } from '@/components/game-ui';

import { GAME_ID, STROOP_COLOR_HEX } from '../types';

/** Fixed seed for the tutorial demo trial. */
export const TUTORIAL_DEMO_SEED = 'tutorial-demo';

interface TutorialProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to Color Stroop!',
      body: 'You will see color words displayed in different ink colors.',
    },
    {
      title: 'Answer the INK Color',
      body: 'By default, tap the button matching the color the word is written in, not what the word says.',
    },
    {
      title: 'Watch for Rule Changes!',
      body: 'Sometimes a "RULE CHANGE!" banner appears. After that, tap the color the WORD says instead.',
    },
    {
      title: 'Speed Matters',
      body: 'Faster correct answers earn more points. Try to respond quickly but accurately!',
    },
  ];

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <TutorialFrame gameId={GAME_ID}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {currentStep.title}
        </ThemedText>
        <ThemedText type="bodyLarge" style={styles.body}>
          {currentStep.body}
        </ThemedText>

        {step === 1 && (
          <View style={styles.demo}>
            <ThemedText type="bodyLarge" style={{ color: STROOP_COLOR_HEX.red, fontWeight: '700' }}>
              RED
            </ThemedText>
            <ThemedText type="caption" style={styles.demoLabel}>
              Word says RED, but it's written in red ink → Answer: red
            </ThemedText>
          </View>
        )}

        {step === 2 && (
          <View style={styles.demo}>
            <ThemedText type="caption" style={styles.ruleChange}>
              RULE CHANGE! Answer the WORD
            </ThemedText>
            <ThemedText type="bodyLarge" style={{ color: STROOP_COLOR_HEX.blue, fontWeight: '700' }}>
              GREEN
            </ThemedText>
            <ThemedText type="caption" style={styles.demoLabel}>
              Word says GREEN, written in blue → Answer: green (word says)
            </ThemedText>
          </View>
        )}

        <View style={styles.buttons}>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label={isLast ? 'Got it!' : 'Next'}
            onPress={() => {
              if (isLast) {
                onComplete();
              } else {
                setStep(step + 1);
              }
            }}
          />
          {isDevBuild() && onSkip && (
            <GameButton
              testID={testId(GAME_ID, 'tutorial-skip')}
              label="Skip (QA)"
              variant="secondary"
              onPress={onSkip}
            />
          )}
        </View>
      </View>
    </TutorialFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 400,
    gap: Spacing.three,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  demo: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: '#E3E6EF',
    gap: Spacing.two,
  },
  demoLabel: {
    textAlign: 'center',
    color: '#5D6474',
  },
  ruleChange: {
    color: '#D98E04',
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
