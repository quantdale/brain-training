/**
 * Tutorial — first-play interactive tutorial for the Equation Builder game.
 *
 * Three steps: a short explanation, a live demo on a real puzzle (a
 * deterministic easy puzzle the player must solve by tapping numbers and
 * operators to build an equation; a wrong submission replays the demo),
 * and a completion screen. Completion marks the tutorial done via the
 * tutorial lifecycle; a dev-only skip button (rendered by the parent only
 * in dev builds) uses the QA skip path.
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

import { generatePuzzle } from '../generator';
import { GAME_ID } from '../types';
import type { Operator, EquationToken } from '../types';
import { GameButton } from './button';
import { EquationDisplay } from './equation-display';
import { NumberPad } from './number-pad';
import { OperatorPad } from './operator-pad';

/** Deterministic demo seed so the tutorial puzzle is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'equation-builder-tutorial-demo-v1';
const DEMO_PARAMS = {
  numbersCount: 3,
  targetMin: 10,
  targetMax: 30,
  operators: ['+', '-'] as readonly Operator[],
  rounds: 1,
  timeBudgetMs: null,
};

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
            A target number is shown at the top. Tap the available numbers to build your
            equation — you must use ALL of them. Add operators (+, −, ×, ÷) between
            numbers, and use the Group button for parentheses when needed. Submit when
            ready — faster solves earn more points!
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
          <ThemedText type="headline">You've got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — the timer keeps ticking, so think fast and submit
            when you're confident!
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

/** One demo run: shows a generated easy puzzle and validates the equation. */
function DemoPuzzle({ attempt, onWrong, onDone, onSkip }: DemoPuzzleProps) {
  const [puzzle] = useState(() =>
    generatePuzzle({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: attempt,
      params: DEMO_PARAMS,
      prevTarget: null,
    }),
  );
  const [equationTokens, setEquationTokens] = useState<readonly EquationToken[]>([]);
  const [usedNumberIndices, setUsedNumberIndices] = useState<readonly number[]>([]);
  const [expectOperator, setExpectOperator] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [result, setResult] = useState<number | null>(null);

  const handleNumberPress = (index: number) => {
    if (expectOperator || usedNumberIndices.includes(index) || submitted) return;
    setEquationTokens([...equationTokens, puzzle.numbers[index]]);
    setUsedNumberIndices([...usedNumberIndices, index]);
    setExpectOperator(true);
  };

  const handleOperatorPress = (operator: Operator) => {
    if (!expectOperator || submitted) return;
    setEquationTokens([...equationTokens, operator]);
    setExpectOperator(false);
  };

  const handleSubmit = () => {
    if (equationTokens.length === 0 || submitted) return;

    // Simple left-to-right evaluation for the demo
    let current = 0;
    let op: Operator | null = null;
    for (const token of equationTokens) {
      if (typeof token === 'number') {
        if (op === null) {
          current = token;
        } else {
          switch (op) {
            case '+': current += token; break;
            case '-': current -= token; break;
            case '×': current *= token; break;
            case '÷': current = token !== 0 ? current / token : 0; break;
          }
          op = null;
        }
      } else {
        op = token;
      }
    }

    const correct = current === puzzle.target;
    setSubmitted(true);
    setIsCorrect(correct);
    setResult(current);

    if (correct) {
      onDone();
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {submitted && !isCorrect
          ? 'Not quite — try again!'
          : `Build an equation that equals ${puzzle.target}`}
      </ThemedText>
      <EquationDisplay
        target={puzzle.target}
        tokens={equationTokens}
        result={result}
        isCorrect={isCorrect}
      />
      <NumberPad
        numbers={puzzle.numbers}
        usedIndices={usedNumberIndices}
        disabled={submitted}
        onNumberPress={handleNumberPress}
      />
      <OperatorPad
        operators={puzzle.operators}
        disabled={!expectOperator || submitted}
        onOperatorPress={handleOperatorPress}
      />
      <GameButton
        testID={testId(GAME_ID, 'tutorial-submit')}
        label="Submit"
        disabled={equationTokens.length === 0 || submitted}
        onPress={handleSubmit}
      />
      {submitted && !isCorrect ? (
        <GameButton
          testID={testId(GAME_ID, 'tutorial-retry')}
          label="Try again"
          variant="secondary"
          onPress={onWrong}
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
});
