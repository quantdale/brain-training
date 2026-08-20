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
import { useTheme } from '@/hooks/use-theme';
import { GameButton, TutorialFrame } from '@/components/game-ui';

import { generateSquare } from '../generator';
import { GAME_ID } from '../types';

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
    return { square, blankIndex, answer };
  }, []);

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Every row and every column contains each symbol exactly once. One cell
            is blank — use the rule to find the only symbol that can fit there.
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
            In this 3×3 grid, the center cell is blank. Its row already has 2 and 3,
            and its column already has 1 and 3 — so the missing symbol is 1.
          </ThemedText>
          <DemoGrid square={demo.square} blankIndex={demo.blankIndex} answer={demo.answer} />
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
            Ready to play for real — faster correct answers earn a higher score!
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

function DemoGrid({
  square,
  blankIndex,
  answer,
}: {
  square: readonly (readonly number[])[];
  blankIndex: number;
  answer: number;
}) {
  const theme = useTheme();
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < DEMO_SIZE; r += 1) {
    for (let c = 0; c < DEMO_SIZE; c += 1) {
      const i = r * DEMO_SIZE + c;
      const isBlank = i === blankIndex;
      const isAnswer = isBlank;
      cells.push(
        <View
          key={i}
          style={[
            styles.cell,
            { borderColor: theme.border, backgroundColor: theme.surface },
            isAnswer && { backgroundColor: theme.accent },
          ]}>
          <ThemedText type="bodyLarge" themeColor="text">
            {isBlank ? String(answer + 1) : String(square[r][c] + 1)}
          </ThemedText>
        </View>,
      );
    }
  }
  return <View style={styles.grid}>{cells}</View>;
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  cell: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
