/**
 * Tutorial — first-play interactive tutorial for the Math Missing Operator
 * game.
 *
 * Three steps: a short explanation, a live demo equation (deterministic, from
 * `TUTORIAL_DEMO_SEED`) the player must solve — a wrong pick replays the demo
 * with a fresh equation — and a completion screen. Completion marks the
 * tutorial done via the tutorial lifecycle; a dev-only skip button (rendered
 * by the parent only in dev builds) uses the QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal state without any setState-in-effect cascades (same
 * pattern as the Memory tutorial). The demo has no timer.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { generateEquation } from '../generator';
import { MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS } from '../difficulty';
import { GAME_ID, OPERATORS } from '../types';
import type { Equation, Operator } from '../types';
import { GameButton } from './button';
import { EquationDisplay } from './equation-display';
import { OperatorButton } from './operator-button';

/** Deterministic demo seed so the tutorial equation is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'math-missing-operator-tutorial-demo-v1';
const DEMO_PARAMS = MATH_MISSING_OPERATOR_DIFFICULTY_PARAMS.easy;

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
            An operator is missing from the equation. Pick the one that makes it
            true — the round timer shrinks, so answer fast!
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
        <DemoEquation
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
            Every equation has exactly one correct operator. The numbers grow and
            the timer shrinks as you go.
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

interface DemoEquationProps {
  attempt: number;
  onWrong: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo equation: the player picks an operator; wrong picks replay it. */
function DemoEquation({ attempt, onWrong, onDone, onSkip }: DemoEquationProps) {
  const [equation] = useState<Equation>(() =>
    generateEquation({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: attempt,
      params: DEMO_PARAMS,
      level: 'easy',
    }),
  );

  const handlePick = (operator: Operator) => {
    if (operator === equation.answerOperator) {
      onDone();
    } else {
      onWrong();
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, 'tutorial-demo-status')}>
        Pick the missing operator.
      </ThemedText>
      <EquationDisplay equation={equation} testID={testId(GAME_ID, 'tutorial-equation')} />
      <View style={styles.operators}>
        {OPERATORS.map((operator) => (
          <OperatorButton
            key={operator}
            operator={operator}
            testID={testId(GAME_ID, 'tutorial-op', operator)}
            onPress={() => handlePick(operator)}
          />
        ))}
      </View>
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
  operators: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
