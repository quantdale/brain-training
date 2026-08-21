/**
 * Tutorial — first-play interactive tutorial for the Speed Color Match game.
 *
 * Three steps: a short explanation, a live demo trial (the player must tap
 * the button matching the swatch color, not the text color), and a
 * completion screen. Completion marks the tutorial done via the tutorial
 * lifecycle; a dev-only skip button (rendered by the parent only in dev
 * builds) uses the QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal state without any setState-in-effect cascades.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { generateTrials } from '../generator';
import { GAME_ID, COLOR_PALETTE, COLOR_HEX } from '../types';
import type { ColorName, Trial } from '../types';
import { GameButton } from './button';
import { ColorSwatch } from './swatch';
import { ColorButtonGrid } from './color-button';

/** Deterministic demo seed so the tutorial trial is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'speed-color-match-tutorial-demo-v1';
const DEMO_TRIALS = 3;

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
            A color swatch is shown with a color name. Tap the button matching the
            <ThemedText type="small" style={{ color: COLOR_HEX.red }}> SWATCH </ThemedText>
            color, not the text color! Faster responses earn more points.
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
        <DemoTrial
          key={attempt}
          attempt={attempt}
          onWrong={() => setAttempt((value) => value + 1)}
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You&apos;ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — remember: match the swatch color, ignore the
            text. Faster is better!
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

interface DemoTrialProps {
  attempt: number;
  onWrong: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: shows a trial and validates the player's tap. */
function DemoTrial({ attempt, onWrong, onDone, onSkip }: DemoTrialProps) {
  const [trials] = useState<readonly Trial[]>(() =>
    generateTrials({
      rng: createRng(TUTORIAL_DEMO_SEED),
      totalTrials: DEMO_TRIALS,
      incongruentCount: 2,
    }),
  );
  const [trialIndex, setTrialIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<ColorName | null>(null);
  const [completed, setCompleted] = useState(false);

  const trial = trials[trialIndex];
  const isCorrect = selectedColor === trial.swatchColor;

  // Track the pending advance timer so it cannot fire after unmount (e.g. the
  // user quits the tutorial mid-demo) and setState on a dead component.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const handleTapColor = (color: ColorName) => {
    if (completed) return;
    setSelectedColor(color);
    setCompleted(true);

    if (color === trial.swatchColor) {
      // Move to next trial or complete
      if (trialIndex + 1 >= DEMO_TRIALS) {
        onDone();
      } else {
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          setTrialIndex((index) => index + 1);
          setSelectedColor(null);
          setCompleted(false);
        }, 800);
      }
    } else {
      onWrong();
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor={selectedColor !== null && !isCorrect ? 'danger' : 'textSecondary'}
        testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {selectedColor !== null && !isCorrect
          ? 'Not quite — match the swatch color!'
          : `Tap the color matching the swatch (${DEMO_TRIALS - trialIndex} left)`}
      </ThemedText>
      <ColorSwatch
        swatchColor={trial.swatchColor}
        labelColor={trial.labelColor}
        testID={testId(GAME_ID, 'tutorial-swatch')}
      />
      <ColorButtonGrid
        colors={COLOR_PALETTE}
        disabled={completed}
        onPress={handleTapColor}
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
