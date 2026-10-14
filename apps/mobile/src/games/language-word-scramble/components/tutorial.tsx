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
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

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
    return owner.mounted && owner.step === 'demo' && owner.attempt === attempt;
  }, [attempt]);
  const handleDemoDone = () => {
    if (!isCurrentDemo()) return;
    ownerRef.current.step = 'done';
    setStep('done');
  };
  const handleRetry = (event?: GestureResponderEvent) => {
    if (!isCurrentDemo() || !claimPress(event)) return;
    ownerRef.current.attempt += 1;
    setAttempt(ownerRef.current.attempt);
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
    if (!owner.mounted || owner.step !== step || owner.attempt !== attempt ||
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
            You&apos;ll see a scrambled word and a category hint. Pick the
            correct unscrambled word from the options below, then submit.
            Longer words earn more points — take your time, rounds never
            expire.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Try a demo"
            onPress={handleNext}
          />
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
        <DemoRound
          key={attempt}
          attempt={attempt}
          onRetry={handleRetry}
          onDone={handleDemoDone}
          isCurrentDemo={isCurrentDemo}
          claimPress={claimPress}
          onSkip={onSkip === undefined ? undefined : handleSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You&apos;ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — pick an option, then submit when
            you&apos;re sure. The challenge is hidden while paused.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-done')}
            label="Got it"
            onPress={handleComplete}
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
  isCurrentDemo: () => boolean;
  claimPress: (event?: GestureResponderEvent) => boolean;
  onSkip?: () => void;
}

/** One demo run: draws a deterministic round and validates the pick. */
function DemoRound({ attempt, onRetry, onDone, onSkip, isCurrentDemo, claimPress }: DemoRoundProps) {
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
  const pickedRef = useRef(false);
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
    (index: number, event?: GestureResponderEvent) => {
      if (!isCurrentDemo() || pickedRef.current || !claimPress(event)) return;
      // Keep the first choice even when React batches two native callbacks.
      pickedRef.current = true;
      setPickedIndex(index);
      if (index === round.correctIndex) onDone();
    },
    [isCurrentDemo, claimPress, round.correctIndex, onDone],
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
