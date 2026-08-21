/**
 * Tutorial — first-play tutorial for the Pair Recall game.
 *
 * Three steps: a short explanation, a static worked example (two fixed pairs
 * and one cued question, identical on every device), and a completion screen
 * that calls out the re-pairing twist. Completion marks the tutorial done via
 * the tutorial lifecycle; a dev-only skip button (rendered by the parent only
 * in dev builds) uses the QA skip path.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R pattern);
 * mechanics stay local.
 */
import { StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { GameButton, TutorialFrame } from "@/components/game-ui";
import { Spacing } from "@/constants/theme";
import { useState } from "react";

import { GAME_ID } from "../types";
import { CuePanel } from "./cue-panel";
import type { PairRecallRound } from "../types";

/** Deterministic demo content so the example is identical on every device. */
const DEMO_ROUND: PairRecallRound = {
  pairs: [
    { stimulusId: 0, responseId: 6 }, // red circle → K
    { stimulusId: 2, responseId: 5 }, // green triangle → J
  ],
  cueOrder: [0, 1],
  responseOptions: [6, 5],
};

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
            Study which partner letter each shape is paired with. Then each shape appears
            alone — tap its partner from the choices. In later rounds shapes come back with
            NEW partners, so don&apos;t trust what you learned before.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, "tutorial-next")}
            label="See an example"
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
        <View style={styles.body}>
          <ThemedText type="headline">Example</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            You studied these pairs:
          </ThemedText>
          <View style={styles.demoPairs}>
            <ThemedText type="default">● → K</ThemedText>
            <ThemedText type="default">▲ → J</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, "tutorial-demo-status")}>
            Now you are asked for the red circle — tap K.
          </ThemedText>
          <CuePanel round={DEMO_ROUND} cueIndex={0} disabled />
          <GameButton
            small
            testID={testId(GAME_ID, "tutorial-next")}
            label="Got it"
            onPress={() => setStep("done")}
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

      {step === "done" ? (
        <View style={styles.body}>
          <ThemedText type="headline">You&apos;ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play — the pairs hide during pauses, so no peeking.
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

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  demoPairs: {
    gap: Spacing.one,
  },
});
