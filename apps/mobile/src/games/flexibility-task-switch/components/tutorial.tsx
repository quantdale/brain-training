/**
 * Tutorial — first-play interactive tutorial for the Task Switch game.
 *
 * Two steps: an explanation, then a live demo where the player applies one
 * cued task to a token (a parity trial, then the task switches to magnitude).
 * Completion marks the tutorial done via the tutorial lifecycle; a dev-only skip
 * button (rendered by the parent only in dev builds) uses the QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which resets
 * its internal step state without setState-in-effect cascades.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R); mechanics
 * stay local.
 */
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { createRng, testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { GameButton, TutorialFrame } from "@/components/game-ui";
import { Spacing } from "@/constants/theme";

import { generateRound } from "../generator";
import { GAME_ID, TASK_LABELS } from "../types";
import { TokenView } from "./token-view";

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = "flexibility-task-switch-tutorial-demo-v1";
const DEMO_NUM_COLORS = 3;
const DEMO_NUM_SHAPES = 3;
const DEMO_NUM_NUMBERS = 9;

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
            A token and a TASK CUE are shown together. Do what the cue asks:
            tell whether the number is even/odd, low/high, or name its color.
            The cue changes from trial to trial — when the task switches, take a
            breath and re-read the cue before you answer.
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
        <Demo
          key={attempt}
          onWrong={() => setAttempt((value) => value + 1)}
          onDone={() => setStep("done")}
          onSkip={onSkip}
        />
      ) : null}

      {step === "done" ? (
        <View style={styles.body}>
          <ThemedText type="headline">You&apos;ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Switch cost is the whole point: responding right after a task switch
            is harder. Keep your accuracy up and the switches will feel
            smoother.
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

interface DemoProps {
  onWrong: () => void;
  onDone: () => void;
  /** Dev-only QA skip; passed through from the parent. */
  onSkip?: () => void;
}

/** One demo run: a parity trial, then a magnitude trial (a task switch). */
function Demo({ onWrong, onDone, onSkip }: DemoProps) {
  const rounds = useMemo(() => {
    const rng = createRng(TUTORIAL_DEMO_SEED);
    const parity = generateRound(rng, 0, null, {
      rounds: 2,
      switchRate: 1,
      taskPool: ["parity", "magnitude"],
      numColors: DEMO_NUM_COLORS,
      numShapes: DEMO_NUM_SHAPES,
      numNumbers: DEMO_NUM_NUMBERS,
      speedTargetMs: 5000,
    });
    const magnitude = generateRound(rng, 1, parity.task, {
      rounds: 2,
      switchRate: 1,
      taskPool: ["parity", "magnitude"],
      numColors: DEMO_NUM_COLORS,
      numShapes: DEMO_NUM_SHAPES,
      numNumbers: DEMO_NUM_NUMBERS,
      speedTargetMs: 5000,
    });
    return { parity, magnitude };
  }, []);
  const [phase, setPhase] = useState<"parity" | "magnitude">("parity");
  const [wrongPick, setWrongPick] = useState<number | null>(null);

  const round = phase === "parity" ? rounds.parity : rounds.magnitude;
  const handlePick = (index: number) => {
    if (wrongPick !== null) {
      return;
    }
    const correct = index === round.correctIndex;
    if (correct) {
      if (phase === "parity") {
        setPhase("magnitude");
      } else {
        onDone();
      }
    } else {
      setWrongPick(index);
      onWrong();
    }
  };

  const visualFor = (index: number) => (index === wrongPick ? "error" : "idle");

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, "tutorial-demo-status")}
      >
        {phase === "parity"
          ? "Cue: " + TASK_LABELS.parity
          : "Task switched — now " + TASK_LABELS.magnitude}
      </ThemedText>
      <View
        style={styles.targetRow}
        testID={testId(GAME_ID, "tutorial-target")}
      >
        <TokenView
          token={round.token}
          testID={testId(GAME_ID, "tutorial-token")}
          disabled
        />
      </View>
      <View style={styles.grid} testID={testId(GAME_ID, "tutorial-grid")}>
        {(round.options as readonly string[]).map((option, index) => (
          <GameButton
            key={index}
            testID={`${testId(GAME_ID, "tutorial-grid")}.option.${index}`}
            label={option}
            onPress={() => handlePick(index)}
            variant={visualFor(index) === "error" ? "danger" : "primary"}
          />
        ))}
      </View>
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
  targetRow: {
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
    justifyContent: "center",
  },
});
