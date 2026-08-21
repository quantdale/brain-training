/**
 * Tutorial — first-play tutorial for the Cue Keeper game.
 *
 * Three steps: a short explanation, a static worked example (one fixed new
 * signal, identical on every device), and a completion screen that calls out
 * the no-reminders twist. Completion marks the tutorial done via the tutorial
 * lifecycle; a dev-only skip button (rendered by the parent only in dev
 * builds) uses the QA skip path.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R pattern);
 * mechanics stay local.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { GameButton, TutorialFrame } from "@/components/game-ui";
import { Spacing } from "@/constants/theme";

import { GAME_ID } from "../types";
import { ResponseControls } from "./response-controls";

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
            First you brief your signals — symbols you must watch for. Then symbols
            stream past one at a time: tap GO for normal ones, but the moment one of
            YOUR signals appears, tap SIGNAL. The watchlist is never shown again, so
            keep it in your head.
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
          <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, "tutorial-demo-status")}>
            You briefed the orange star as your signal. It is about to appear —
            when it does, tap SIGNAL. Every other symbol gets GO.
          </ThemedText>
          <ResponseControls disabled onRespond={() => undefined} />
          <ThemedText type="caption" themeColor="textSecondary">
            Between rounds new signals join and old ones retire — announced once,
            then never again.
          </ThemedText>
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
            Ready to play — pausing hides the stream and freezes the clock, so no
            peeking.
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
});
