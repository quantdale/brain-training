/**
 * Tutorial — first-play tutorial for the Value Order game.
 *
 * Two steps: a short explanation of the smallest-to-largest ranking mechanic,
 * then a completion screen. Completion marks the tutorial done via the
 * tutorial lifecycle; a dev-only skip button (rendered by the parent only in
 * dev builds) uses the QA skip path.
 *
 * The tutorial intentionally shows no live board (a static explanation keeps
 * it deterministic and dependency-free). Replaying simply remounts the body
 * via a `key`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
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

  // A tutorial owns its rendered step/attempt until it advances or closes.
  // Publish that boundary before React commits so queued native controls
  // cannot retry, complete or skip a later teaching cue.
  const ownerRef = useRef({
    step: 'intro' as TutorialStep | 'closed', attempt: 0, mounted: true,
  });
  const deliveredPresses = useRef(new WeakSet<object>());
  useEffect(() => {
    const owner = ownerRef.current;
    owner.mounted = true;
    return () => { owner.mounted = false; };
  }, []);
  const claimPress = useCallback((event?: GestureResponderEvent) => {
    const payload = event?.nativeEvent;
    if (payload == null) return true;
    if (deliveredPresses.current.has(payload)) return false;
    deliveredPresses.current.add(payload);
    return true;
  }, []);
  const handleNext = (event?: GestureResponderEvent) => {
    const owner = ownerRef.current;
    if (!owner.mounted || owner.step !== 'intro' || !claimPress(event)) return;
    owner.step = 'done';
    setStep('done');
  };
  const handleComplete = (event?: GestureResponderEvent) => {
    const owner = ownerRef.current;
    if (!owner.mounted || owner.step !== 'done' || !claimPress(event)) return;
    owner.step = 'closed';
    onComplete();
  };
  const handleSkip = (event?: GestureResponderEvent) => {
    const owner = ownerRef.current;
    if (!owner.mounted || owner.step !== step || owner.attempt !== 0 ||
        !claimPress(event)) return;
    owner.step = 'closed';
    onSkip?.();
  };

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body} key="intro">
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Each round shows a set of tiles. Tap them from the{' '}
            <ThemedText type="small">smallest</ThemedText> value to the{' '}
            <ThemedText type="small">largest</ThemedText> — before the clock
            runs out. Some tiles hide their value behind a quick expression
            like 6 × 4, so stay sharp. One wrong tap ends the round!
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Got it"
            onPress={handleNext}
          />
          {onSkip !== undefined ? (
            <GameButton
              testID={testId(GAME_ID, 'tutorial-skip')}
              label="Skip tutorial (QA)"
              variant="secondary"
              onPress={handleSkip}
            />
          ) : null}
        </View>
      ) : null}

      {step === 'done' ? (
        <View style={styles.body} key="done">
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Faster perfect rounds score more, and higher difficulties add more
            tiles with wider ranges. The board hides while paused — your time
            budget freezes too.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-done')}
            label="Start playing"
            onPress={handleComplete}
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
