/**
 * Tutorial — first-play interactive tutorial for the Deduction Table game.
 *
 * Three steps: explanation, a live demo (read the clues, answer the question;
 * a wrong pick reveals the answer and offers a retry), and a completion
 * screen. The demo round is generated deterministically from a fixed seed so
 * it is identical on every device. Completion marks the tutorial done via the
 * lifecycle; a dev-only skip (rendered by the parent only in dev builds) uses
 * the QA skip path. Migrated to shared `TutorialFrame` + `GameButton`.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { createRng, testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { GameButton, TutorialFrame } from "@/components/game-ui";
import { Spacing } from "@/constants/theme";

import { generateRound } from "../generator";
import { GAME_ID } from "../types";
import type { LogicDeductionDifficultyParams } from "../types";
import { ClueTable } from "./clue-table";
import { Option } from "./option";
import type { OptionVisualState } from "./option";

/** Deterministic demo seed so the tutorial puzzle is identical on every device. */
export const TUTORIAL_DEMO_SEED = "logic-deduction-table-tutorial-demo-v1";

/** Small fixed demo tuning (well below easy) so the demo solves quickly. */
export const TUTORIAL_DEMO_PARAMS: LogicDeductionDifficultyParams = {
  entityCount: 3,
  attributeCount: 2,
  clueCount: 4,
  rounds: 1,
  roundTimeMs: 60_000,
};

type TutorialStep = "intro" | "demo" | "done";

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>("intro");
  const [attempt, setAttempt] = useState(0);

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === "intro" ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A table of entities and a set of clues appear. Use the clues to work
            out the one value the question asks for — and answer before the
            timer runs out.
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
        <DemoRound
          key={attempt}
          onRetry={() => setAttempt((value) => value + 1)}
          onDone={() => setStep("done")}
          onSkip={onSkip}
        />
      ) : null}

      {step === "done" ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — puzzles get bigger as you improve, and the
            challenge is hidden while paused.
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

interface DemoRoundProps {
  onRetry: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: clues + question + options; a wrong pick offers a retry. */
function DemoRound({ onRetry, onDone, onSkip }: DemoRoundProps) {
  const round = useMemo(
    () =>
      generateRound({
        rng: createRng(TUTORIAL_DEMO_SEED),
        roundIndex: 0,
        params: TUTORIAL_DEMO_PARAMS,
        prevRound: null,
      }),
    [],
  );
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const answered = pickedIndex !== null;
  const correct = pickedIndex === round.correctIndex;

  const visualFor = (index: number): OptionVisualState => {
    if (!answered) return "idle";
    if (index === round.correctIndex) return "correct";
    return index === pickedIndex ? "wrong" : "muted";
  };

  const handlePick = useCallback(
    (index: number) => {
      if (answered) return;
      setPickedIndex(index);
      if (index === round.correctIndex) onDone();
    },
    [answered, round.correctIndex, onDone],
  );

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ClueTable round={round} testID={testId(GAME_ID, "tutorial-table")} />
      <View style={styles.clues}>
        {round.clues.map((clue, i) => (
          <ThemedText
            key={i}
            type="small"
            themeColor="textSecondary"
            testID={testId(GAME_ID, "tutorial-clue", String(i))}
          >
            • {clue.text}
          </ThemedText>
        ))}
      </View>
      <ThemedText type="subtitle" testID={testId(GAME_ID, "tutorial-question")}>
        {round.question.text}
      </ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, "tutorial-demo-status")}
      >
        {answered && !correct
          ? "Not quite — here’s the value that fits."
          : "Pick the value the question asks for."}
      </ThemedText>
      <View style={styles.options}>
        {round.options.map((value, index) => (
          <Option
            key={index}
            index={index}
            label={value}
            visual={visualFor(index)}
            selected={answered && index === pickedIndex}
            disabled={answered}
            onPressOption={handlePick}
          />
        ))}
      </View>
      {answered && !correct ? (
        <GameButton
          testID={testId(GAME_ID, "tutorial-retry")}
          label="Try again"
          onPress={onRetry}
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
  clues: {
    gap: Spacing.one,
  },
  options: {
    gap: Spacing.two,
  },
});
