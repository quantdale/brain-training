/**
 * Tutorial — first-play interactive tutorial for the Visual Search game.
 *
 * Three steps: a short explanation, a live demo on a small 4-tile grid (one
 * odd tile the player must tap; a wrong tap replays the demo), and a
 * completion screen. Completion marks the tutorial done via the tutorial
 * lifecycle; a dev-only skip button (rendered by the parent only in dev
 * builds) uses the QA skip path.
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

import { generateRoundTarget } from '../generator';
import { GAME_ID } from '../types';
import { GameButton } from './button';
import { TileGrid } from './grid';
import type { TileVisualState } from './tile';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'attention-visual-search-tutorial-v1';
const DEMO_GRID_SIZE = 4;

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
            One tile on the board looks different from the rest. Find it and tap it — fast,
            before the timer runs out. Each round gets shorter and the board gets bigger.
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
          <ThemedText type="headline">You’ve got it</ThemedText>
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

/** One demo run: shows the odd tile; the player must tap it. */
function DemoGrid({ attempt, onWrong, onDone, onSkip }: DemoGridProps) {
  const [targetIndex] = useState<number>(() =>
    generateRoundTarget({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: attempt,
      gridSize: DEMO_GRID_SIZE,
      prevTargetIndex: null,
    }),
  );
  const [found, setFound] = useState(false);
  const [wrongTile, setWrongTile] = useState<number | null>(null);

  const handleTap = (index: number) => {
    if (found) {
      return;
    }
    if (index === targetIndex) {
      setFound(true);
      onDone();
    } else {
      setWrongTile(index);
      onWrong();
    }
  };

  const visualFor = (index: number): TileVisualState => {
    if (found) {
      return index === targetIndex ? 'selected' : 'idle';
    }
    return index === wrongTile ? 'error' : index === targetIndex ? 'target' : 'idle';
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {found ? 'Perfect!' : 'Tap the tile that looks different'}
      </ThemedText>
      <TileGrid
        gridSize={DEMO_GRID_SIZE}
        testID={testId(GAME_ID, 'tutorial-grid')}
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
