/**
 * Tutorial — first-play interactive tutorial for the Spatial Transform Match game.
 *
 * Three steps: a short explanation, a live demo on a small grid (a
 * deterministic pattern the player must transform), and a completion screen.
 * Completion marks the tutorial done via the tutorial lifecycle; a dev-only
 * skip button (rendered by the parent only in dev builds) uses the QA skip path.
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

import { applyTransform, generateSourcePattern } from '../generator';
import { GAME_ID, TRANSFORM_LABELS } from '../types';
import type { TransformType } from '../types';
import { GameButton } from './button';
import { PatternGrid } from './pattern-grid';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'spatial-transform-match-tutorial-v1';
const DEMO_GRID_SIZE = 9;
const DEMO_FILLED_CELLS = 3;
const DEMO_SIDE = 3;
const DEMO_TRANSFORM: TransformType = 'rotate90';

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
            You'll see a grid pattern, then a transform label (like "Rotate 90° clockwise").
            Pick the option that matches the transformed version of the pattern.
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
        <DemoRound
          key={attempt}
          attempt={attempt}
          onCorrect={() => setStep('done')}
          onWrong={() => setAttempt((value) => value + 1)}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You've got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — the source pattern hides after a brief reveal, so stay focused.
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

interface DemoRoundProps {
  attempt: number;
  onCorrect: () => void;
  onWrong: () => void;
  onSkip?: () => void;
}

/** One demo run: shows a pattern + transform, then validates the player's pick. */
function DemoRound({ attempt, onCorrect, onWrong, onSkip }: DemoRoundProps) {
  const [source] = useState<readonly number[]>(() =>
    generateSourcePattern(
      createRng(TUTORIAL_DEMO_SEED),
      attempt,
      DEMO_GRID_SIZE,
      DEMO_FILLED_CELLS,
    ),
  );
  const correctPattern = applyTransform(source, DEMO_TRANSFORM, DEMO_SIDE);
  const wrongPattern = applyTransform(source, 'rotate180', DEMO_SIDE);
  const options = [correctPattern, wrongPattern];

  const handleOptionPress = (index: number) => {
    if (index === 0) {
      onCorrect();
    } else {
      onWrong();
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        Apply "{TRANSFORM_LABELS[DEMO_TRANSFORM]}" and pick the correct result.
      </ThemedText>
      <PatternGrid
        gridSize={DEMO_GRID_SIZE}
        pattern={source}
        testID={testId(GAME_ID, 'tutorial-source')}
        accessibilityLabel="Demo source pattern"
      />
      <ThemedText type="caption" themeColor="textSecondary">
        {TRANSFORM_LABELS[DEMO_TRANSFORM]}
      </ThemedText>
      <View style={styles.optionRow}>
        {options.map((opt, i) => (
          <GameButton
            key={i}
            testID={testId(GAME_ID, 'tutorial-option', String(i))}
            label={`Option ${i + 1}`}
            variant="secondary"
            onPress={() => handleOptionPress(i)}
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
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  body: {
    gap: Spacing.three,
  },
  optionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
