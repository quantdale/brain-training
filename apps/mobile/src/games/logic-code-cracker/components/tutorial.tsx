/**
 * Tutorial — first-play interactive tutorial for the Code Cracker game.
 *
 * Three steps: a short explanation, a live demo with a small code, and a
 * completion screen. The demo lets the player guess a simple 3-color code
 * to understand the feedback mechanics.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { computeFeedback, generateSecretCode } from '../generator';
import { GAME_ID } from '../types';
import { GameButton } from './button';
import { ColorPicker, COLOR_PALETTE, COLOR_NAMES } from './color-picker';
import { CurrentGuess } from './current-guess';
import { FeedbackPegs } from './feedback-pegs';
import { SecretReveal } from './secret-reveal';

/** Deterministic demo seed so the tutorial code is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'code-cracker-tutorial-demo-v1';
const DEMO_CODE_LENGTH = 3;
const DEMO_COLOR_COUNT = 4;

type TutorialStep = 'intro' | 'demo' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');

  return (
    <ThemedView type="surface" style={styles.card} testID={testId(GAME_ID, 'tutorial')}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A secret code of colors is hidden. Tap colors to build a guess, then
            submit it. You'll get feedback: black pegs mean correct color in the
            right spot, white pegs mean correct color in the wrong spot. Use
            logic to crack the code!
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
        <DemoRound onDone={() => setStep('done')} onSkip={onSkip} />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You've got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — fewer guesses means a higher score!
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

interface DemoRoundProps {
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: shows the feedback mechanics with a simple 3-color code. */
function DemoRound({ onDone, onSkip }: DemoRoundProps) {
  const [secretCode] = useState<readonly number[]>(() =>
    generateSecretCode({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      codeLength: DEMO_CODE_LENGTH,
      colorCount: DEMO_COLOR_COUNT,
      prevSecretCode: null,
    }),
  );
  const [guesses, setGuesses] = useState<{ guess: number[]; feedback: { exact: number; colorOnly: number } }[]>([]);
  const [currentGuess, setCurrentGuess] = useState<number[]>([]);

  const handleSelectColor = (colorIndex: number) => {
    if (currentGuess.length >= DEMO_CODE_LENGTH) {
      return;
    }
    setCurrentGuess([...currentGuess, colorIndex]);
  };

  const handleSubmit = () => {
    if (currentGuess.length !== DEMO_CODE_LENGTH) {
      return;
    }
    const feedback = computeFeedback(secretCode, currentGuess);
    setGuesses([...guesses, { guess: [...currentGuess], feedback }]);
    setCurrentGuess([]);

    // Auto-complete after first guess in the demo.
    if (guesses.length >= 0) {
      onDone();
    }
  };

  const handleClear = () => {
    setCurrentGuess([]);
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {guesses.length === 0
          ? `Tap ${DEMO_CODE_LENGTH} colors to make a guess, then submit.`
          : 'Great! Now you know how feedback works.'}
      </ThemedText>

      {guesses.length === 0 ? (
        <>
          <CurrentGuess
            currentGuess={currentGuess}
            codeLength={DEMO_CODE_LENGTH}
            showClear
            onClear={handleClear}
          />
          <ColorPicker
            colorCount={DEMO_COLOR_COUNT}
            onSelectColor={handleSelectColor}
          />
          <GameButton
            small
            testID={testId(GAME_ID, 'tutorial-submit')}
            label="Submit guess"
            disabled={currentGuess.length !== DEMO_CODE_LENGTH}
            onPress={handleSubmit}
          />
        </>
      ) : (
        <>
          {guesses.map((entry, index) => (
            <View key={index} style={styles.demoGuess}>
              <CurrentGuess
                currentGuess={entry.guess}
                codeLength={DEMO_CODE_LENGTH}
              />
              <FeedbackPegs feedback={entry.feedback} />
            </View>
          ))}
        </>
      )}

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
  demoGuess: {
    alignItems: 'center',
    gap: Spacing.two,
  },
});
