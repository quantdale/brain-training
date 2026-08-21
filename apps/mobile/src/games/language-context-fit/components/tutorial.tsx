/**
 * Tutorial — first-play interactive tutorial for the Context Fit game.
 *
 * Three steps: explanation, a live demo (read the sentence with a blank, pick
 * the best-fitting word; a wrong pick reveals the answer and offers a retry),
 * and a completion screen. Completion marks the tutorial done via the
 * lifecycle; a dev-only skip (rendered by the parent only in dev) uses QA skip.
 * Migrated to shared `TutorialFrame` + `GameButton`.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { loadContentPack } from '../content-validation';
import { filterByTiers, selectRound } from '../generator';
import { GAME_ID } from '../types';
import { Option } from './option';
import type { OptionVisualState } from './option';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'language-context-fit-tutorial-demo-v1';

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
            A short sentence appears with a blank. Pick the one word that fits
            the context best. Answer before the timer runs out.
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
          <GameButton testID={testId(GAME_ID, 'tutorial-done')} label="Got it" onPress={onComplete} />
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
    if (!answered) return 'idle';
    if (index === round.correctIndex) return 'correct';
    return index === pickedIndex ? 'wrong' : 'muted';
  };

  const handlePick = useCallback(
    (index: number) => {
      if (answered) return;
      setPickedIndex(index);
      if (index === round.correctIndex) onDone();
    },
    [answered, round.correctIndex, onDone],
  );

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {answered && !correct
          ? 'Not quite — here’s the word that fits.'
          : 'Pick the word that best fills the blank.'}
      </ThemedText>
      <ThemedText type="subtitle" testID={testId(GAME_ID, 'tutorial-context')}>
        {round.context}
      </ThemedText>
      <View style={styles.options}>
        {round.options.map((word, index) => (
          <Option
            key={index}
            index={index}
            label={word}
            visual={visualFor(index)}
            disabled={answered}
            onPressOption={handlePick}
          />
        ))}
      </View>
      {answered && !correct ? (
        <GameButton testID={testId(GAME_ID, 'tutorial-retry')} label="Try again" onPress={onRetry} />
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
