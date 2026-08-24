/**
 * Tutorial — first-play interactive tutorial for the Target Count game.
 *
 * Three steps: a short explanation, a live demo with a small static example
 * grid, and a completion screen. The demo shows a tiny grid and explains that
 * the player taps the NUMBER of target symbols (not a location).
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R task 10.3);
 * mechanics stay local. The outer `TutorialFrame` provides the card shell and
 * the `testId(GAME_ID, 'tutorial')` wrapper previously owned by the local
 * `ThemedView`, so existing testIDs and content are preserved.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { GAME_ID } from '../types';
import { GameButton, TutorialFrame } from '@/components/game-ui';
import { Grid } from './grid';
import { SYMBOLS, SYMBOL_NAMES } from '../generator';

/** Deterministic demo content so the tutorial example is identical on every device. */
const DEMO_TARGET_INDEX = SYMBOLS.indexOf('★');
const DEMO_CELLS = ['★', '●', '★', '▲', '■', '★', '◆', '●', '★'];

type TutorialStep = 'intro' | 'demo' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');
  const demoTargetCount = DEMO_CELLS.filter((c) => c === SYMBOLS[DEMO_TARGET_INDEX]).length;

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A grid of symbols appears. Count how many of the highlighted target symbol are shown, then tap the matching number before time runs out. Quick and accurate counting earns the most points.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="See an example"
            onPress={() => setStep('demo')}
          />
          {onSkip !== undefined ? (
            <GameButton
              testID={testId(GAME_ID, 'tutorial-skip')}
              label="Skip tutorial (QA)"
              variant="secondary"
              onPress={onSkip}
            />
          ) : null}
        </View>
      ) : null}

      {step === 'demo' ? (
        <View style={styles.body}>
          <ThemedText type="headline">Example</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
            Count the {SYMBOL_NAMES[DEMO_TARGET_INDEX]} {SYMBOLS[DEMO_TARGET_INDEX]} — there are {demoTargetCount} of them. Tap {demoTargetCount}.
          </ThemedText>
          <Grid cells={DEMO_CELLS} testIdCell={(i) => testId(GAME_ID, 'tutorial-cell', String(i))} disabled />
          <GameButton
            small
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Got it"
            onPress={() => setStep('done')}
          />
          {onSkip !== undefined ? (
            <GameButton
              testID={testId(GAME_ID, 'tutorial-skip')}
              label="Skip tutorial (QA)"
              variant="secondary"
              onPress={onSkip}
            />
          ) : null}
        </View>
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You&apos;re ready</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The grid is shown only briefly, so stay focused. Good luck!
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-done')}
            label="Got it"
            onPress={onComplete}
          />
        </View>
      ) : null}
    </TutorialFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
});
