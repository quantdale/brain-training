/**
 * Tutorial — first-play tutorial for the Quick Compare game.
 *
 * Two steps: a short explanation of the "two values, one fast decision"
 * mechanic, then a completion screen. Completion marks the tutorial done via
 * the tutorial lifecycle; a dev-only skip button (rendered by the parent only
 * in dev builds) uses the QA skip path.
 *
 * The demo intentionally avoids any timing/animation dependency so it never
 * leaks the answer and never depends on nondeterministic rendering. Replaying
 * simply remounts the body via a `key`.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { testId } from '@/sdk';
import { GAME_ID } from '../types';
import { GameButton } from './button';

type TutorialStep = 'intro' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body} key="intro">
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Each round shows two values and a question — Are they the same?
            Which number is larger? Which sum is larger? Pick the right answer
            before the bar runs out — at higher tiers the answer hides among
            plausible look-alike numbers. Faster, correct answers score more.
          </ThemedText>
          <GameButton
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
        <View style={styles.body} key="done">
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Decide fast and accurately. The window shrinks as you climb
            difficulty, and the board hides while paused.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-done')}
            label="Start playing"
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
