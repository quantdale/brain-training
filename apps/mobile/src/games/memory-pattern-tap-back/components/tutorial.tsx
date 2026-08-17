/**
 * Tutorial — first-play interactive tutorial for the Pattern Tap Back game.
 *
 * Three steps: a short explanation, a live demo on the real grid (a
 * deterministic 3-tile sequence the player must repeat; a wrong tap replays
 * the demo), and a completion screen. Completion marks the tutorial done via
 * the tutorial lifecycle; a dev-only skip button uses the QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal observe/input state without any setState-in-effect
 * cascades.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { generateRoundSequence } from '../generator';
import { GAME_ID } from '../types';
import { GameButton } from './button';
import { TileGrid } from './grid';
import type { TileVisualState } from './tile';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'pattern-tap-back-tutorial-v1';
const DEMO_LENGTH = 3;
const DEMO_GRID_SIZE = 9;
const DEMO_REVEAL_MS = 600;

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
            Tiles light up one by one — watch closely, then tap them back in the same order. Each
            round adds another tile to the sequence.
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
            Ready to play for real — the board hides during pauses, so keep your phone close.
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
  attempt: number;
  onWrong: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: reveals the sequence, then validates the player's taps. */
function DemoGrid({ attempt, onWrong, onDone, onSkip }: DemoGridProps) {
  const [sequence] = useState<readonly number[]>(() =>
    generateRoundSequence({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: attempt,
      length: DEMO_LENGTH,
      gridSize: DEMO_GRID_SIZE,
      prevSequence: null,
    }),
  );
  const [observeIndex, setObserveIndex] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const [wrongTile, setWrongTile] = useState<number | null>(null);

  const observing = observeIndex >= 0 && observeIndex < DEMO_LENGTH;
  const completed = inputIndex >= DEMO_LENGTH;

  // Observe pacing: one tile every DEMO_REVEAL_MS, then hand over to input.
  useEffect(() => {
    if (!observing) {
      return;
    }
    const timer = setTimeout(() => setObserveIndex((index) => index + 1), DEMO_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [observing, observeIndex]);

  const handleTap = (index: number) => {
    if (observing || completed) {
      return;
    }
    if (index === sequence[inputIndex]) {
      setWrongTile(null);
      const next = inputIndex + 1;
      setInputIndex(next);
      if (next >= DEMO_LENGTH) {
        onDone();
      }
    } else {
      setWrongTile(index);
      onWrong();
    }
  };

  const visualFor = (index: number): TileVisualState => {
    if (observing) {
      return index === observeIndex ? 'observed' : 'idle';
    }
    if (sequence.slice(0, inputIndex).includes(index)) {
      return 'selected';
    }
    return index === wrongTile ? 'error' : 'idle';
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {observing
          ? 'Watch the sequence…'
          : completed
            ? 'Perfect!'
            : `Your turn — tap the ${DEMO_LENGTH - inputIndex} lit tile${DEMO_LENGTH - inputIndex > 1 ? 's' : ''}`}
      </ThemedText>
      <TileGrid
        gridSize={DEMO_GRID_SIZE}
        testID={testId(GAME_ID, 'tutorial-grid')}
        visualFor={visualFor}
        disabled={observing}
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
