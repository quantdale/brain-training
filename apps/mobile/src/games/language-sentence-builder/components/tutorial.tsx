/**
 * Tutorial — first-play interactive tutorial for the Sentence Builder game.
 *
 * Steps: intro → demo (tap words in correct order on a short example) → done.
 * The demo is deterministic and resets on replay via key remounting.
 */
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { GameButton, TutorialFrame } from '@/components/game-ui';

import { generateRound } from '../generator';
import { SENTENCE_BANK } from '../content/sentence-bank';
import { GAME_ID } from '../types';
import { WordChips } from './word-grid';

/** Deterministic demo seed so the tutorial is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'sentence-builder-tutorial-demo-v1';

type TutorialStep = 'intro' | 'demo' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Words from a sentence are shuffled. Tap them in the correct order to rebuild the
            original sentence. You get a category hint and a timer for each round.
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
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You&apos;ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The timer pauses when you pause the game, so take your time.
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
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo round: a short scrambled sentence to practice on. */
function DemoRound({ onDone, onSkip }: DemoRoundProps) {
  const demoSentence = useMemo(() => {
    const rng = createRng(TUTORIAL_DEMO_SEED);
    return generateRound({
      rng,
      roundIndex: 0,
      bank: SENTENCE_BANK,
      minWords: 4,
      maxWords: 6,
      prevCategory: null,
      usedCategories: [],
    });
  }, []);

  const { scrambled } = demoSentence;
  const [taps, setTaps] = useState<readonly number[]>([]);
  const completed = taps.length >= scrambled.original.length;

  const handleTapWord = useCallback(
    (scrambledIndex: number) => {
      if (completed) return;
      setTaps((prev) => [...prev, scrambledIndex]);
    },
    [completed],
  );

  // Check if demo is complete and all taps correct.
  const allCorrect = completed && taps.every(
    (scrambledIdx, position) => scrambled.scrambled[scrambledIdx] === scrambled.original[position],
  );

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {completed
          ? allCorrect
            ? 'Perfect!'
            : 'Not quite — try the real game!'
          : `Tap the words in the correct order (${scrambled.original.length - taps.length} left)`}
      </ThemedText>
      <WordChips
        words={scrambled.scrambled}
        tappedIndices={taps}
        disabled={completed}
        testID={testId(GAME_ID, 'tutorial-grid')}
        onTapWord={handleTapWord}
      />
      <GameButton
        testID={testId(GAME_ID, 'tutorial-demo-next')}
        label={allCorrect ? 'Got it' : 'Try the game'}
        onPress={onDone}
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
  body: {
    gap: Spacing.three,
  },
});
