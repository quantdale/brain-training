/**
 * Tutorial — first-play interactive tutorial for the Grid Recall game.
 *
 * Three steps: a short explanation, a live demo on a small real board (a
 * deterministic 2-cell pattern the player must rebuild; a wrong tap replays the
 * demo), and a completion screen. Completion marks the tutorial done via the
 * tutorial lifecycle; a dev-only skip button (rendered by the parent only in
 * dev builds) uses the QA skip path.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R pattern);
 * mechanics stay local.
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { createRng, testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { GameButton, TutorialFrame } from "@/components/game-ui";
import { Spacing } from "@/constants/theme";

import { generateTargetCells } from "../generator";
import { GAME_ID } from "../types";
import { Board } from "./board";
import type { CellVisualState } from "./cell";

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = "memory-grid-recall-tutorial-demo-v1";
const DEMO_GRID_SIZE = 9;
const DEMO_TARGET_COUNT = 2;
const DEMO_STUDY_MS = 1500;

type TutorialStep = "intro" | "demo" | "done";

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>("intro");

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === "intro" ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A pattern of cells lights up — study it. When it disappears, tap the
            same cells to rebuild the pattern. Longer patterns appear as you
            improve.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, "tutorial-next")}
            label="Try a demo"
            onPress={() => setStep("demo")}
          />
          {onSkip !== undefined ? (
            <GameButton
              testID={testId(GAME_ID, "tutorial-skip")}
              label="Skip tutorial (QA)"
              variant="secondary"
              onPress={onSkip}
            />
          ) : null}
        </View>
      ) : null}

      {step === "demo" ? (
        <DemoBoard onDone={() => setStep("done")} onSkip={onSkip} />
      ) : null}

      {step === "done" ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — the board hides during pauses, so keep your
            phone close.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, "tutorial-done")}
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

/** One demo run: shows the pattern, then validates the player's rebuild. */
function DemoBoard({ onDone, onSkip }: DemoBoardProps) {
  const targets = useMemo<readonly number[]>(
    () =>
      generateTargetCells({
        rng: createRng(TUTORIAL_DEMO_SEED),
        roundIndex: 0,
        gridSize: DEMO_GRID_SIZE,
        targetCount: DEMO_TARGET_COUNT,
        prevTargets: null,
      }),
    [],
  );
  const [studying, setStudying] = useState(true);
  const [selections, setSelections] = useState<number[]>([]);

  useEffect(() => {
    if (!studying) {
      return;
    }
    const timer = setTimeout(() => setStudying(false), DEMO_STUDY_MS);
    return () => clearTimeout(timer);
  }, [studying]);

  const handleTap = (index: number) => {
    if (studying) {
      return;
    }
    setSelections((prev) =>
      prev.includes(index) ? prev.filter((c) => c !== index) : [...prev, index],
    );
  };

  const targetSet = new Set(targets);
  const allCorrect =
    selections.length === targets.length &&
    selections.every((c) => targetSet.has(c));
  const wrongSelected = selections.some((c) => !targetSet.has(c));

  const visualFor = (index: number): CellVisualState => {
    if (studying) {
      return targetSet.has(index) ? "target" : "idle";
    }
    if (targetSet.has(index) && selections.includes(index)) {
      return "correct";
    }
    if (!targetSet.has(index) && selections.includes(index)) {
      return "error";
    }
    return "idle";
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, "tutorial-demo-status")}
      >
        {studying
          ? "Memorize the highlighted cells…"
          : allCorrect
            ? "Perfect!"
            : `Tap the ${DEMO_TARGET_COUNT} highlighted cells to rebuild the pattern`}
      </ThemedText>
      <Board
        gridSize={DEMO_GRID_SIZE}
        testID={testId(GAME_ID, "tutorial-grid")}
        visualFor={visualFor}
        disabled={studying}
        onPressCell={handleTap}
      />
      {!studying && allCorrect ? (
        <GameButton
          testID={testId(GAME_ID, "tutorial-demo-done")}
          label="That’s it"
          onPress={onDone}
        />
      ) : null}
      {!studying && wrongSelected ? (
        <GameButton
          testID={testId(GAME_ID, "tutorial-demo-retry")}
          label="Clear and retry"
          variant="secondary"
          onPress={() => setSelections([])}
        />
      ) : null}
      {onSkip !== undefined ? (
        <GameButton
          testID={testId(GAME_ID, "tutorial-skip")}
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
