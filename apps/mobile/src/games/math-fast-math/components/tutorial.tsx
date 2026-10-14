/**
 * Tutorial — first-play interactive tutorial for the Fast Math game (canary C migration).
 *
 * Mechanics stay here; the card shell is the shared `TutorialFrame` and all
 * per-game buttons are the shared `GameButton`. The per-game `problem`/`num-pad`
 * mechanics remain local.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { GameButton, TutorialFrame } from '@/components/game-ui';

import { generateSessionProblems } from '../generator';
import { GAME_ID } from '../types';
import type { MathDifficultyParams, MathProblem } from '../types';
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

  // A tutorial owns its rendered step/attempt until it advances or closes.
  // Publish that boundary before React commits so queued native controls
  // cannot retry, complete or skip a later teaching cue.
  const ownerRef = useRef({
    step: 'intro' as TutorialStep | 'closed', attempt: 0, mounted: true,
  });
  const deliveredPresses = useRef(new WeakSet<object>());
  useEffect(() => {
    const owner = ownerRef.current;
    owner.mounted = true;
    return () => { owner.mounted = false; };
  }, []);
  const claimPress = useCallback((event?: GestureResponderEvent) => {
    const payload = event?.nativeEvent;
    if (payload == null) return true;
    if (deliveredPresses.current.has(payload)) return false;
    deliveredPresses.current.add(payload);
    return true;
  }, []);
  const isCurrentDemo = useCallback(() => {
    const owner = ownerRef.current;
    return owner.mounted && owner.step === 'demo' && owner.attempt === 0;
  }, []);
  const handleDemoDone = () => {
    if (!isCurrentDemo()) return;
    ownerRef.current.step = 'done';
    setStep('done');
  };
  const handleNext = (event?: GestureResponderEvent) => {
    const owner = ownerRef.current;
    if (!owner.mounted || owner.step !== 'intro' || !claimPress(event)) return;
    owner.step = 'demo';
    setStep('demo');
  };
  const handleComplete = (event?: GestureResponderEvent) => {
    const owner = ownerRef.current;
    if (!owner.mounted || owner.step !== 'done' || !claimPress(event)) return;
    owner.step = 'closed';
    onComplete();
  };
  const handleSkip = (event?: GestureResponderEvent) => {
    const owner = ownerRef.current;
    if (!owner.mounted || owner.step !== step || owner.attempt !== 0 ||
        !claimPress(event)) return;
    owner.step = 'closed';
    onSkip?.();
  };

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Solve each arithmetic problem with the number pad — answer before the bar runs out to earn a
            speed bonus. Every problem is exact: division always divides evenly, so trust the math.
          </ThemedText>
          <GameButton testID={testId(GAME_ID, 'tutorial-next')} label="Try a demo" onPress={handleNext} />
          {onSkip !== undefined ? (
            <GameButton
              testID={testId(GAME_ID, 'tutorial-skip')}
              label="Skip tutorial (QA)"
              variant="secondary"
              onPress={handleSkip}
            />
          ) : null}
        </View>
      ) : null}

      {step === 'demo' ? (
        <Demo
          onDone={handleDemoDone}
          isCurrentDemo={isCurrentDemo}
          claimPress={claimPress}
          onSkip={onSkip === undefined ? undefined : handleSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — keep an eye on the timer, and remember the challenge hides while paused.
          </ThemedText>
          <GameButton testID={testId(GAME_ID, 'tutorial-done')} label="Got it" onPress={handleComplete} />
        </View>
      ) : null}
    </TutorialFrame>
  );
}

interface DemoProps {
  onDone: () => void;
  isCurrentDemo: () => boolean;
  claimPress: (event?: GestureResponderEvent) => boolean;
  onSkip?: () => void;
}

/** Two demo problems; each must be answered correctly to advance. */
function Demo({ onDone, onSkip, isCurrentDemo, claimPress }: DemoProps) {
  const [problems] = useState<readonly MathProblem[]>(() =>
    generateSessionProblems(createRng(TUTORIAL_DEMO_SEED), TUTORIAL_DEMO_PARAMS),
  );
  const [problemIndex, setProblemIndex] = useState(0);
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef({ problemIndex: 0, input: '' });

  const problem = problems[problemIndex];

  const ownsProblem = () => isCurrentDemo() && inputRef.current.problemIndex === problemIndex;
  const handleDigit = (digit: number, event?: GestureResponderEvent) => {
    if (!ownsProblem() || !claimPress(event)) return;
    const current = inputRef.current;
    current.input = current.input.length < 6 ? `${current.input}${digit}` : current.input;
    setWrong(false);
    setInput(current.input);
  };
  const handleBackspace = (event?: GestureResponderEvent) => {
    if (!ownsProblem() || !claimPress(event)) return;
    inputRef.current.input = inputRef.current.input.slice(0, -1);
    setInput(inputRef.current.input);
  };
  const handleSubmit = (event?: GestureResponderEvent) => {
    if (!ownsProblem() || inputRef.current.input.length === 0 || !claimPress(event)) return;
    const correct = Number(inputRef.current.input) === problem.answer;
    inputRef.current.input = '';
    setInput('');
    setWrong(!correct);
    if (!correct) return;
    const nextIndex = problemIndex + 1;
    // Claim the next problem before a second delivered submit can reuse this
    // answer; distinct batched digits still stage against the current cue.
    inputRef.current.problemIndex = nextIndex;
    if (nextIndex >= problems.length) onDone();
    else setProblemIndex(nextIndex);
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
  body: { gap: Spacing.three },
});
