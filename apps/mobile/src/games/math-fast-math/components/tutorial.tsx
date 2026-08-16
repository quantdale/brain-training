/**
 * Tutorial — first-play interactive tutorial for the Fast Math game.
 *
 * Three steps: a short explanation, a live demo on the real problem/number
 * pad (two deterministic addition problems the player must answer; a wrong
 * answer clears the input and asks to retry), and a completion screen.
 * Completion marks the tutorial done via the tutorial lifecycle; a dev-only
 * skip button (rendered by the parent only in dev builds) uses the QA skip
 * path.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { generateSessionProblems } from '../generator';
import { GAME_ID } from '../types';
import type { MathDifficultyParams, MathProblem } from '../types';
import { GameButton } from './button';
import { NumberPad } from './number-pad';
import { ProblemDisplay } from './problem';

/** Deterministic demo seed so the tutorial problems are identical on every device. */
export const TUTORIAL_DEMO_SEED = 'math-fast-math-tutorial-demo-v1';

/** Demo tuning: two untimed additions with small operands. */
export const TUTORIAL_DEMO_PARAMS: Readonly<MathDifficultyParams> = Object.freeze<MathDifficultyParams>({
  rounds: 2,
  timeBudgetMs: null,
  operators: ['+'],
  ranges: {
    '+': { maxLeft: 9, maxRight: 9 },
    '−': { maxLeft: 9, maxRight: 9 },
    '×': { maxLeft: 5, maxRight: 5 },
    '÷': { maxLeft: 16, maxRight: 4 },
  },
});

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
            Solve each arithmetic problem with the number pad — answer before the bar
            runs out to earn a speed bonus. Every problem is exact: division always
            divides evenly, so trust the math.
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
        <Demo
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — keep an eye on the timer, and remember the
            challenge hides while paused.
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

interface DemoProps {
  onDone: () => void;
  onSkip?: () => void;
}

/** Two demo problems; each must be answered correctly to advance. */
function Demo({ onDone, onSkip }: DemoProps) {
  const [problems] = useState<readonly MathProblem[]>(() =>
    generateSessionProblems(createRng(TUTORIAL_DEMO_SEED), TUTORIAL_DEMO_PARAMS),
  );
  const [problemIndex, setProblemIndex] = useState(0);
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);

  const problem = problems[problemIndex];

  const handleDigit = (digit: number) => {
    setWrong(false);
    setInput((value) => (value.length < 6 ? `${value}${digit}` : value));
  };

  const handleBackspace = () => setInput((value) => value.slice(0, -1));

  const handleSubmit = () => {
    if (input.length === 0) {
      return;
    }
    if (Number(input) === problem.answer) {
      setInput('');
      setWrong(false);
      if (problemIndex + 1 >= problems.length) {
        onDone();
      } else {
        setProblemIndex((index) => index + 1);
      }
    } else {
      setInput('');
      setWrong(true);
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor={wrong ? 'danger' : 'textSecondary'}
        testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {wrong
          ? 'Not quite — try again.'
          : `Solve ${problems.length - problemIndex} more problem${problems.length - problemIndex > 1 ? 's' : ''}.`}
      </ThemedText>
      <ProblemDisplay problem={problem} input={input} />
      <NumberPad onDigit={handleDigit} onBackspace={handleBackspace} onSubmit={handleSubmit} />
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
