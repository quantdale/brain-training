/**
 * Tutorial — first-play interactive tutorial for the Odd One Out game.
 *
 * Three steps: a short explanation, a live demo on the real 3×3 board (one
 * fixed deterministic board; a wrong tap replays the demo), and a completion
 * screen. Completion marks the tutorial done via the tutorial lifecycle; a
 * dev-only skip button (rendered by the parent only in dev builds) uses the
 * QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal wrong-tap state without any setState-in-effect
 * cascades. The demo board is FIXED (roundIndex 0 regardless of attempt) so
 * the player learns the specific pattern instead of chasing a moving target.
 * The odd item is never disclosed via accessibility labels during the demo.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { generateBoard } from '../generator';
import { GAME_ID } from '../types';
import type { OddOneOutBoard } from '../types';
import { GameButton } from './button';
import { ItemGrid } from './grid';
import type { TileVisualState } from './tile';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'attention-odd-one-out-tutorial-demo-v1';
const DEMO_GRID_SIZE = 9;

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
            Every board has exactly one item that differs from the others — a different
            shape, color, or angle. Find it and tap it before the timer runs out. Wrong
            taps cost points, so look carefully.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Watch a demo"
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
        <DemoGrid
          key={attempt}
          onWrong={() => setAttempt((value) => value + 1)}
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Rounds get trickier as you go — the odd item gets subtler and the timer
            gets shorter. Ready?
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

interface DemoGridProps {
  onWrong: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: a fixed board the player must solve; a wrong tap replays it. */
function DemoGrid({ onWrong, onDone, onSkip }: DemoGridProps) {
  const [board] = useState<OddOneOutBoard>(() =>
    generateBoard({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      subtlety: 0,
      gridSize: DEMO_GRID_SIZE,
      prevBoard: null,
    }),
  );
  const [wrongIndex, setWrongIndex] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);

  const handleTap = (index: number) => {
    if (solved) {
      return;
    }
    if (index === board.oddIndex) {
      setSolved(true);
      onDone();
    } else {
      setWrongIndex(index);
      onWrong();
    }
  };

  const visualFor = (index: number): TileVisualState => {
    if (solved) {
      return index === board.oddIndex ? 'found' : 'idle';
    }
    return index === wrongIndex ? 'error' : 'idle';
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, 'tutorial-demo-status')}>
        One of these items is different — tap it.
      </ThemedText>
      <ItemGrid
        gridSize={DEMO_GRID_SIZE}
        testID={testId(GAME_ID, 'tutorial-grid')}
        board={board}
        visualFor={visualFor}
        onPressTile={handleTap}
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
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  body: {
    gap: Spacing.three,
  },
});
