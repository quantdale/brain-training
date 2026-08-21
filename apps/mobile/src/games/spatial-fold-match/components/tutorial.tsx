/**
 * Tutorial — first-play interactive tutorial for the Spatial Fold Match game.
 *
 * Three steps: a short explanation, a live demo (memorize a small pattern,
 * watch it fold, pick the folded result among two options; a wrong pick
 * offers a retry), and a completion screen. Completion marks the tutorial
 * done via the tutorial lifecycle; a dev-only skip button (rendered by the
 * parent only in dev builds) uses the QA skip path.
 *
 * Migrated to shared `TutorialFrame` + `GameButton`; mechanics stay local.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { generateRoundData } from '../generator';
import { GAME_ID } from '../types';
import { GridView } from './grid-view';
import { OptionGrid } from './option-grid';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'spatial-fold-match-tutorial-demo-v1';

const DEMO_ROWS = 3;
const DEMO_COLS = 3;
const DEMO_FILLED_CELLS = 3;
const DEMO_REVEAL_MS = 1500;

type TutorialStep = 'intro' | 'demo' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A pattern appears — memorize it. Then the grid folds along an axis
            and the two halves merge: a cell stays filled when either half has
            it. Pick the correctly folded result.
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
        <DemoFold onDone={() => setStep('done')} onSkip={onSkip} />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — the board hides during pauses, so keep
            your phone close.
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

interface DemoFoldProps {
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: memorize the source pattern, then pick the folded result. */
function DemoFold({ onDone, onSkip }: DemoFoldProps) {
  // Single allowed fold → fully deterministic demo round for the fixed seed.
  const demo = useMemo(
    () =>
      generateRoundData({
        rng: createRng(TUTORIAL_DEMO_SEED),
        roundIndex: 0,
        gridRows: DEMO_ROWS,
        gridCols: DEMO_COLS,
        filledCells: DEMO_FILLED_CELLS,
        foldsAllowed: ['foldV'],
        optionCount: 2,
        prevSource: null,
        prevFold: null,
      }),
    [],
  );
  const [studying, setStudying] = useState(true);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!studying) {
      return undefined;
    }
    const timer = setTimeout(() => setStudying(false), DEMO_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [studying]);

  const answered = pickedIndex !== null;
  const correct = pickedIndex === demo.correctOptionIndex;

  const handlePick = (index: number) => {
    if (studying || answered) {
      return;
    }
    setPickedIndex(index);
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {studying
          ? 'Memorize the pattern…'
          : answered
            ? correct
              ? 'Perfect — that is the folded result!'
              : 'Not quite — that one does not match.'
            : demo.foldLabel}
      </ThemedText>
      {studying ? (
        <GridView
          grid={demo.source}
          testID={testId(GAME_ID, 'tutorial-source')}
          accessibilityLabel="Demo source pattern"
        />
      ) : (
        <>
          <View style={styles.options}>
            {demo.options.map((grid, index) => (
              <OptionGrid
                key={index}
                index={index}
                grid={grid}
                selected={pickedIndex === index}
                correct={answered && index === demo.correctOptionIndex}
                disabled={answered}
                onPressOption={handlePick}
              />
            ))}
          </View>
          {answered && correct ? (
            <GameButton
              testID={testId(GAME_ID, 'tutorial-demo-done')}
              label="That’s it"
              onPress={onDone}
            />
          ) : null}
          {answered && !correct ? (
            <GameButton
              testID={testId(GAME_ID, 'tutorial-retry')}
              label="Clear and retry"
              variant="secondary"
              onPress={() => setPickedIndex(null)}
            />
          ) : null}
        </>
      )}
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
