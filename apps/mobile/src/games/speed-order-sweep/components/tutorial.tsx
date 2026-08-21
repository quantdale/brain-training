/**
 * Tutorial — first-play interactive tutorial for the Order Sweep game.
 *
 * Three steps: a short explanation, a live demo on a real (small) board
 * (four deterministic tokens; a wrong tap replays the demo), and a completion
 * screen. Completion marks the tutorial done via the tutorial lifecycle; a
 * dev-only skip button (rendered by the parent only in dev builds) uses the
 * QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal sweep state without any setState-in-effect cascades
 * (same pattern as the tap-rush tutorial). The demo has no timer on purpose:
 * it teaches the ordering rule, not the time pressure.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { generateRound } from '../generator';
import { GAME_ID } from '../types';
import type { OrderSweepRound } from '../types';
import { GameButton } from './button';
import { TokenGrid } from './token-grid';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'speed-order-sweep-tutorial-demo-v1';
const DEMO_COUNT = 4;
const DEMO_COLUMNS = 2;
const DEMO_MAX_VALUE = 12;

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
            Every number appears on the board at once — sweep them from
            smallest to largest before the bar runs out. Wrong taps break your
            streak, and perfect rounds shrink the next window.
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
        <DemoBoard
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
            In the real game the clock is running — scan fast, sweep in order,
            and remember the field hides while paused.
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

interface DemoBoardProps {
  attempt: number;
  onWrong: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: four tokens in ascending order; a wrong tap replays. */
function DemoBoard({ attempt, onWrong, onDone, onSkip }: DemoBoardProps) {
  const [round] = useState<readonly OrderSweepRound[]>(() => [
    generateRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: attempt,
      count: DEMO_COUNT,
      columns: DEMO_COLUMNS,
      maxValue: DEMO_MAX_VALUE,
    }),
  ]);
  const [clearedCount, setClearedCount] = useState(0);
  const board = round[0];
  const completed = clearedCount >= board.order.length;

  const handleTap = (tokenId: number) => {
    if (completed) {
      return;
    }
    const token = board.tokens.find((candidate) => candidate.id === tokenId);
    if (token === undefined) {
      return;
    }
    if (token.value === board.order[clearedCount]) {
      const next = clearedCount + 1;
      setClearedCount(next);
      if (next >= board.order.length) {
        onDone();
      }
    } else {
      onWrong();
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {completed ? 'Perfect!' : `Tap the smallest number (${DEMO_COUNT - clearedCount} left)`}
      </ThemedText>
      <TokenGrid
        round={board}
        clearedCount={clearedCount}
        disabled={false}
        onTap={handleTap}
        testID={testId(GAME_ID, 'tutorial-grid')}
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
