/**
 * Tutorial — first-play interactive tutorial for the Rule Grid game.
 *
 * Three steps: a short explanation of the one rule, a static demo of a tiny
 * 3×3 grid with one blank and the unique correct answer highlighted, and a
 * completion screen. Migrated to shared `TutorialFrame` + `GameButton`.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { GameButton, TutorialFrame } from '@/components/game-ui';

import { generateSquare } from '../generator';
import { GAME_ID } from '../types';
import { Grid } from './grid';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'rule-grid-tutorial-demo-v1';
const DEMO_SIZE = 3;

type TutorialStep = 'intro' | 'demo' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');

  const demo = useMemo(() => {
    const square = generateSquare(DEMO_SIZE, createRng(TUTORIAL_DEMO_SEED));
    const blankIndex = 4; // center cell
    const blankRow = Math.floor(blankIndex / DEMO_SIZE);
    const blankCol = blankIndex % DEMO_SIZE;
    const answer = square[blankRow][blankCol];
    const rowValues = square[blankRow].filter((_, column) => column !== blankCol).map((value) => value + 1);
    const columnValues = square.filter((_, row) => row !== blankRow).map((row) => row[blankCol] + 1);
    return { square, blankIndex, answer, rowValues, columnValues };
  }, []);

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Every row and every column contains each symbol exactly once. Several
            cells are hidden — on harder grids you must chain deductions: a fact
            you prove first unlocks the next. Find the only symbol that can fit
            the asked cell.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="See an example"
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
        <View style={styles.body}>
          <ThemedText type="headline">Example</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            In this 3×3 grid, the center cell is blank. Its row already has {demo.rowValues.join(' and ')},
            {' '}and its column already has {demo.columnValues.join(' and ')} — so the missing symbol is {demo.answer + 1}.
          </ThemedText>
          <Grid
            size={DEMO_SIZE}
            square={demo.square}
            blankIndex={demo.blankIndex}
            targetValue={demo.answer}
            renderSymbol={(value) => String(value + 1)}
            testIdCell={(index) => testId(GAME_ID, 'tutorial-cell', String(index))}
          />
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Got it"
            onPress={() => setStep('done')}
          />
        </View>
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You&apos;ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — answer correctly before time runs out to earn points!
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

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
});
