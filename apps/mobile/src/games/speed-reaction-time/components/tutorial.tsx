/**
 * Tutorial — first-play interactive tutorial for the Reaction Time game.
 *
 * Three steps: a short explanation, a live demo on the real trigger (the demo
 * signal appears after a fixed delay; tapping during the wait restarts the
 * demo — a false start shows the penalty in a safe context — and tapping the
 * GO completes it), and a completion screen. Completion marks the tutorial
 * done via the tutorial lifecycle; a dev-only skip button (rendered by the
 * parent only in dev builds) uses the QA skip path.
 *
 * The demo uses a fixed delay (no RNG) so it behaves identically on every
 * device; the demo is remounted with a new `key` on every replay attempt,
 * which resets its internal wait/GO state without any setState-in-effect
 * cascades.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { GAME_ID } from '../types';
import { GameButton } from './button';
import { TriggerButton } from './trigger';

/** Fixed demo wait so the tutorial is identical on every device. */
export const TUTORIAL_DEMO_DELAY_MS = 1200;

type TutorialStep = 'intro' | 'demo' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');
  const [attempt, setAttempt] = useState(0);

  return (
    <ThemedView type="surface" style={styles.card} testID={testId(GAME_ID, 'tutorial')}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Watch the big button. After a random wait it turns green — tap it the instant it
            does. Your reaction time is measured in milliseconds. Tap too early and the round
            is a false start: too many and the session ends.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            From Normal upward some rounds flash red with an ✕ instead: that one asks you to
            HOLD — keep perfectly still until it fades. Tapping it costs a false start;
            withholding it scores like a fast round.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Try a demo"
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
        <DemoTrigger
          key={attempt}
          onFalseStart={() => setAttempt((value) => value + 1)}
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — remember: early taps are false starts, red ✕ signals mean
            hold still, and the challenge hides during pauses, so keep your finger close.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-done')}
            label="Got it"
            onPress={onComplete}
          />
        </View>
      ) : null}
    </ThemedView>
  );
}

interface DemoTriggerProps {
  onFalseStart: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: shows the GO after a fixed delay, then validates the tap. */
function DemoTrigger({ onFalseStart, onDone, onSkip }: DemoTriggerProps) {
  const [goShown, setGoShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGoShown(true), TUTORIAL_DEMO_DELAY_MS);
    return () => clearTimeout(timer);
    // The `attempt` key remounts this component on every false start, so the
    // timer always runs exactly once per attempt.
  }, []);

  const handlePress = () => {
    if (goShown) {
      onDone();
    } else {
      onFalseStart(); // parent bumps `attempt` → remount restarts the demo
    }
  };

  const statusText = goShown ? 'Tap the button now!' : 'Watch the button…';

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {statusText}
      </ThemedText>
      <TriggerButton
        active={goShown}
        testID={testId(GAME_ID, 'tutorial-trigger')}
        onPress={handlePress}
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
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  body: {
    gap: Spacing.three,
  },
});
