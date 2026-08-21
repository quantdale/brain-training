/**
 * Tutorial — first-play tutorial for the Number Line Estimation game.
 *
 * Two steps: a short explanation of the estimate-the-flag mechanic, then a
 * completion screen. Completion marks the tutorial done via the tutorial
 * lifecycle; a dev-only skip button (rendered by the parent only in dev
 * builds) uses the QA skip path.
 *
 * The tutorial intentionally shows no live board (the flag position would leak
 * nothing, but a static explanation keeps it deterministic and dependency-
 * free). Replaying simply remounts the body via a `key`.
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
            Each round shows a number line with a flag between the two end
            labels. Tap the spot on the line where you think the flag&apos;s
            value sits — no calculating needed, just a feel for scale. The
            closer your tap lands to the flag&apos;s true value, the more you
            score. Beat the clock per round!
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
            Ranges grow and the tolerance tightens as you climb difficulty.
            The board hides while paused — your time budget freezes too.
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
