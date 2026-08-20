/**
 * Tutorial — first-play interactive tutorial for the Word Scramble game.
 *
 * Three steps: a short explanation, a live demo round (the player must pick
 * the correct unscrambled word from the options), and a completion screen.
 * Completion marks the tutorial done via the tutorial lifecycle; a dev-only
 * skip button (rendered by the parent only in dev builds) uses the QA skip
 * path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal state without any setState-in-effect cascades.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R);
 * mechanics stay local.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { generateRound } from '../generator';
import { GAME_ID } from '../types';
import { OptionButton } from './option-button';
import type { OptionVisualState } from './option-button';
import { ScrambledDisplay } from './scrambled-display';

/** Deterministic demo seed so the tutorial round is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'word-scramble-tutorial-demo-v1';

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
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            You&apos;ll see a scrambled word and a category hint. Pick the correct
            unscrambled word from the options below. Faster correct answers
            earn bonus points!
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
        <DemoRound
          key={attempt}
          attempt={attempt}
          onRetry={() => setAttempt((value) => value + 1)}
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You&apos;ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — answer quickly, the rounds expire on their
            own. The challenge is hidden while paused.
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

interface DemoRoundProps {
  attempt: number;
  onRetry: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: draws a deterministic round and validates the pick. */
function DemoRound({ attempt, onRetry, onDone, onSkip }: DemoRoundProps) {
  const [round] = useState(() =>
    generateRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: attempt,
      optionsCount: 4,
      minWordLength: 4,
      maxWordLength: 8,
      prevAnswer: null,
    }),
  );
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const answered = pickedIndex !== null;
  const correct = pickedIndex === round.correctIndex;

  const visualFor = (index: number): OptionVisualState => {
    if (!answered) {
      return 'idle';
    }
    if (index === round.correctIndex) {
      return 'correct';
    }
    return index === pickedIndex ? 'wrong' : 'idle';
  };

  const handlePick = useCallback(
    (index: number) => {
      if (answered) {
        return;
      }
      setPickedIndex(index);
      if (index === round.correctIndex) {
        onDone();
      }
    },
    [answered, round.correctIndex, onDone],
  );

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {answered && !correct
          ? 'Not quite — try again!'
          : 'Unscramble the word and pick the correct option.'}
      </ThemedText>
      <ScrambledDisplay
        scrambled={round.scrambled}
        category={round.category}
      />
      <View style={styles.options}>
        {round.options.map((option, index) => (
          <OptionButton
            key={index}
            index={index}
            label={option}
            visual={visualFor(index)}
            disabled={answered}
            onPressOption={handlePick}
          />
        ))}
      </View>
      {answered && !correct ? (
        <GameButton
          testID={testId(GAME_ID, 'tutorial-retry')}
          label="Try again"
          variant="secondary"
          onPress={onRetry}
        />
      ) : null}
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
  body: {
    gap: Spacing.three,
  },
  options: {
    gap: Spacing.two,
  },
});
