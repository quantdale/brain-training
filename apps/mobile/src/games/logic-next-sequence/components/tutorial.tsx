/**
 * Tutorial — first-play interactive tutorial for the Next in Sequence game.
 *
 * Three steps: a short explanation, a live demo on a real generated puzzle
 * (a deterministic easy arithmetic puzzle the player must solve by tapping
 * the right option; a wrong tap replays the demo), and a completion screen.
 * Completion marks the tutorial done via the tutorial lifecycle; a dev-only
 * skip button (rendered by the parent only in dev builds) uses the QA skip
 * path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal state without any setState-in-effect cascades.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { LOGIC_DIFFICULTY_PARAMS } from '../difficulty';
import { describePattern, generatePuzzle } from '../generator';
import { GAME_ID } from '../types';
import { GameButton } from './button';
import { Option } from './option';
import { SequenceChips } from './sequence';

/** Deterministic demo seed so the tutorial puzzle is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'logic-tutorial-demo-v1';

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
            A number sequence hides a pattern. Find the rule that makes the
            numbers grow, then pick the term that comes next. Only one of the
            four options is correct.
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
        <DemoPuzzle
          key={attempt}
          attempt={attempt}
          onWrong={() => setAttempt((value) => value + 1)}
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — the sequence hides during pauses, so keep
            your eyes on the numbers.
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

interface DemoPuzzleProps {
  attempt: number;
  onWrong: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: shows a generated easy puzzle and validates the tap. */
function DemoPuzzle({ attempt, onWrong, onDone, onSkip }: DemoPuzzleProps) {
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);

  // Deterministic per attempt: same seed always yields the same demo puzzle.
  const puzzle = generatePuzzle({
    rng: createRng(TUTORIAL_DEMO_SEED),
    roundIndex: attempt,
    tier: LOGIC_DIFFICULTY_PARAMS.easy.recipeTier,
    params: LOGIC_DIFFICULTY_PARAMS.easy,
    prevPuzzle: null,
  });

  const handleTap = (index: number) => {
    if (wrongIndex !== null) {
      return;
    }
    if (index === puzzle.answerIndex) {
      onDone();
    } else {
      // Show the feedback; the "Try again" button remounts the demo.
      setWrongIndex(index);
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, 'tutorial-demo-status')}>
        Which number comes next?
      </ThemedText>
      <SequenceChips terms={puzzle.terms} nextValue={null} testID={testId(GAME_ID, 'tutorial-sequence')} />
      <View style={styles.options}>
        {puzzle.options.map((value, index) => (
          <Option
            key={index}
            index={index}
            label={String(value)}
            visual={wrongIndex !== null && index === wrongIndex ? 'wrong' : 'idle'}
            onPress={() => handleTap(index)}
          />
        ))}
      </View>
      {wrongIndex !== null ? (
        <>
          <ThemedText
            type="small"
            themeColor="danger"
            testID={testId(GAME_ID, 'tutorial-feedback')}>
            Not quite — {describePattern(puzzle.family, puzzle.params)} Try again.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-retry')}
            label="Try again"
            onPress={onWrong}
          />
        </>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
