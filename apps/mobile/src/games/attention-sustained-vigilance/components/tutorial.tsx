/**
 * Tutorial — first-play tutorial for the Sustained Vigilance game.
 *
 * Two steps: a short explanation of the go/hold stream mechanic, then a
 * completion screen. Completion marks the tutorial done via the tutorial
 * lifecycle; a dev-only skip button (rendered by the parent only in dev
 * builds) uses the QA skip path.
 *
 * The tutorial intentionally shows no live board (a static explanation keeps
 * it deterministic and dependency-free). Replaying simply remounts the body
 * via a `key`.
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
            Numbers appear one at a time. Tap GO for every number — but when
            the stop number shows up, do nothing and let it pass. It is fast
            and repetitive on purpose: the challenge is staying alert the whole
            way through and holding your finger when the stop number appears.
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
            Faster levels shrink the response window, speed up the stream, and
            make the stop number rarer. Pausing hides the stream and freezes
            every timer — no peeking, no lost time.
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
