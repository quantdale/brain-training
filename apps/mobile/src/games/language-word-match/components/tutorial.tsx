/**
 * Tutorial — first-play interactive tutorial for the Word Match game.
 *
 * Three steps: a short explanation, a live demo on a real pack item (a
 * deterministic t1 selection the player must answer; a wrong pick reveals the
 * correct word and offers a retry), and a completion screen. Completion marks
 * the tutorial done via the tutorial lifecycle; a dev-only skip button
 * (rendered by the parent only in dev builds) uses the QA skip path.
 *
 * The demo is remounted with a new `key` on every retry, which resets its
 * internal answer state without any setState-in-effect cascades; each attempt
 * draws a fresh deterministic selection (per-attempt RNG fork).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { loadContentPack } from '../content-validation';
import { filterByTiers, selectRound } from '../generator';
import { GAME_ID } from '../types';
import { GameButton } from './button';
import { Option } from './option';
import type { OptionVisualState } from './option';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'language-word-match-tutorial-demo-v1';

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
            A prompt word appears. Tap the option that means the same thing —
            the best synonym. Answer before time runs out.
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
          <ThemedText type="headline">You’ve got it</ThemedText>
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
    </ThemedView>
  );
}

interface DemoRoundProps {
  attempt: number;
  onRetry: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: draws a deterministic t1 selection and validates the pick. */
function DemoRound({ attempt, onRetry, onDone, onSkip }: DemoRoundProps) {
  const [round] = useState(() =>
    selectRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: attempt,
      pool: filterByTiers(loadContentPack().items, ['t1']),
      usedItemIds: new Set(),
      previousRound: null,
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
    return index === pickedIndex ? 'wrong' : 'muted';
  };

  const handlePick = (index: number) => {
    if (answered) {
      return;
    }
    setPickedIndex(index);
    if (index === round.correctIndex) {
      onDone();
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {answered && !correct
          ? 'Not quite — here’s the match.'
          : 'Pick the synonym of the word below.'}
      </ThemedText>
      <ThemedText type="subtitle" testID={testId(GAME_ID, 'tutorial-prompt')}>
        {round.prompt}
      </ThemedText>
      <View style={styles.options}>
        {round.options.map((word, index) => (
          <Option
            key={index}
            index={index}
            label={word}
            visual={visualFor(index)}
            disabled={answered}
            onPress={() => handlePick(index)}
          />
        ))}
      </View>
      {answered && !correct ? (
        <GameButton
          testID={testId(GAME_ID, 'tutorial-retry')}
          label="Try again"
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
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  body: {
    gap: Spacing.three,
  },
  options: {
    gap: Spacing.two,
  },
});
