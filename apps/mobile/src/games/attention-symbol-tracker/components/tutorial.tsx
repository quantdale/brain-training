/**
 * Tutorial — first-play interactive tutorial for the Symbol Tracker game.
 *
 * Three steps: a short explanation, a live demo on a small real board (a
 * deterministic round the player must track through the scramble; a wrong tap
 * offers a retry), and a completion screen. Completion marks the tutorial done
 * via the tutorial lifecycle; a dev-only skip button (rendered by the parent
 * only in dev builds) uses the QA skip path.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R pattern);
 * mechanics stay local.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { generateRound } from '../generator';
import { GAME_ID } from '../types';
import { Board } from './board';
import type { CellVisualState } from './cell';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'attention-symbol-tracker-tutorial-demo-v1';
const DEMO_GRID_SIZE = 9;
const DEMO_TOKEN_COUNT = 4;
const DEMO_TRACK_COUNT = 2;
const DEMO_DISTRACTORS = 0;
const DEMO_OBSERVE_MS = 1500;

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
            Some symbols flash with a highlight — remember them by what they
            are. The board then scrambles and decoys appear: tap the symbols
            you were told to track. More symbols to track as you improve.
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

      {step === 'demo' ? <DemoBoard onDone={() => setStep('done')} onSkip={onSkip} /> : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — the board hides during pauses, so keep your
            phone close.
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
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: shows the tracked symbols, scrambles, validates the picks. */
function DemoBoard({ onDone, onSkip }: DemoBoardProps) {
  const demo = useMemo(
    () =>
      generateRound({
        rng: createRng(TUTORIAL_DEMO_SEED),
        roundIndex: 0,
        gridSize: DEMO_GRID_SIZE,
        tokenCount: DEMO_TOKEN_COUNT,
        trackCount: DEMO_TRACK_COUNT,
        distractors: DEMO_DISTRACTORS,
        prevTracked: null,
      }),
    [],
  );
  const [studying, setStudying] = useState(true);
  const [selections, setSelections] = useState<number[]>([]);

  useEffect(() => {
    if (!studying) {
      return;
    }
    const timer = setTimeout(() => setStudying(false), DEMO_OBSERVE_MS);
    return () => clearTimeout(timer);
  }, [studying]);

  const handleTap = (index: number) => {
    if (studying) {
      return;
    }
    const symbolId = demo.respondBoard[index];
    if (symbolId === undefined || symbolId < 0) {
      return;
    }
    setSelections((prev) =>
      prev.includes(symbolId) ? prev.filter((id) => id !== symbolId) : [...prev, symbolId],
    );
  };

  const trackedSet = new Set(demo.trackedSymbolIds);
  const allCorrect =
    selections.length === demo.trackedSymbolIds.length &&
    selections.every((id) => trackedSet.has(id));
  const wrongSelected = selections.some((id) => !trackedSet.has(id));

  const visualFor = (index: number): CellVisualState => {
    if (studying) {
      const symbolId = demo.observeBoard[index];
      return symbolId !== undefined && trackedSet.has(symbolId) ? 'target' : 'idle';
    }
    const symbolId = demo.respondBoard[index] ?? -1;
    if (trackedSet.has(symbolId) && selections.includes(symbolId)) {
      return 'correct';
    }
    if (!trackedSet.has(symbolId) && selections.includes(symbolId)) {
      return 'error';
    }
    return 'idle';
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, 'tutorial-demo-status')}
      >
        {studying
          ? `Memorize the ${DEMO_TRACK_COUNT} highlighted symbols…`
          : allCorrect
            ? 'Perfect!'
            : `Tap the ${DEMO_TRACK_COUNT} symbols that were highlighted`}
      </ThemedText>
      <Board
        gridSize={DEMO_GRID_SIZE}
        board={studying ? demo.observeBoard : demo.respondBoard}
        testID={testId(GAME_ID, 'tutorial-grid')}
        visualFor={visualFor}
        disabled={studying}
        onPressCell={handleTap}
      />
      {!studying && allCorrect ? (
        <GameButton
          testID={testId(GAME_ID, 'tutorial-demo-done')}
          label="That’s it"
          onPress={onDone}
        />
      ) : null}
      {!studying && wrongSelected ? (
        <GameButton
          testID={testId(GAME_ID, 'tutorial-demo-retry')}
          label="Clear and retry"
          variant="secondary"
          onPress={() => setSelections([])}
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
});
