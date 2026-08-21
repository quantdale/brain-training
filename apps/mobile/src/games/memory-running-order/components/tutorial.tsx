/**
 * Tutorial — first-play interactive tutorial for the Running Order game.
 *
 * Three steps: a short explanation, a live demo on a tiny real stream (a fixed
 * 3-symbol stream; the player must reproduce the LAST TWO in order; a wrong
 * tap clears and retries), and a completion screen. Completion marks the
 * tutorial done via the tutorial lifecycle; a dev-only skip button (rendered
 * by the parent only in dev builds) uses the QA skip path.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R pattern);
 * mechanics stay local.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { GameButton, TutorialFrame } from "@/components/game-ui";
import { Spacing } from "@/constants/theme";

import { RUNNING_ORDER_SYMBOLS } from "../symbols";
import { GAME_ID } from "../types";
import { SymbolView } from "./symbol-view";

/** Deterministic demo stream so the tutorial is identical on every device. */
export const TUTORIAL_DEMO_STREAM = [0, 1, 2]; // red circle, blue square, green triangle
export const TUTORIAL_DEMO_RECALL = 2; // remember the last two
const DEMO_FLASH_MS = 800;

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
            Symbols flash across the screen one at a time. Only the LAST few
            matter — you must recall them IN ORDER. The earlier ones are just
            distractors to ignore.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, "tutorial-next")}
            label="Watch a demo"
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
        <DemoStream onDone={() => setStep("done")} onSkip={onSkip} />
      ) : null}

      {step === "done" ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — the stream hides during pauses, so keep
            your phone close.
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

interface DemoStreamProps {
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: flashes the fixed stream, then validates the last-two recall. */
function DemoStream({ onDone, onSkip }: DemoStreamProps) {
  const [revealedIndex, setRevealedIndex] = useState(0);
  const [phase, setPhase] = useState<"reveal" | "input">("reveal");
  const [answer, setAnswer] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string>("");

  const revealing =
    revealedIndex >= 0 && revealedIndex < TUTORIAL_DEMO_STREAM.length;

  useEffect(() => {
    if (!revealing) {
      return;
    }
    const timer = setTimeout(
      () => setRevealedIndex((i) => i + 1),
      DEMO_FLASH_MS,
    );
    return () => clearTimeout(timer);
  }, [revealing, revealedIndex]);

  useEffect(() => {
    if (revealedIndex >= TUTORIAL_DEMO_STREAM.length) {
      setPhase("input");
    }
  }, [revealedIndex]);

  const target = TUTORIAL_DEMO_STREAM.slice(
    TUTORIAL_DEMO_STREAM.length - TUTORIAL_DEMO_RECALL,
  );

  const handleTap = (id: number) => {
    if (phase !== "input" || answer.length >= TUTORIAL_DEMO_RECALL) {
      return;
    }
    const next = [...answer, id];
    if (next.length < TUTORIAL_DEMO_RECALL) {
      setAnswer(next);
      setFeedback("");
      return;
    }
    // Final pick: validate the ordered recall.
    const correct = next.every((v, i) => v === target[i]);
    if (correct) {
      setFeedback("Perfect!");
      onDone();
    } else {
      setFeedback("Not quite — watch again and try the last two in order.");
      setAnswer([]);
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, "tutorial-demo-status")}
      >
        {phase === "reveal"
          ? `Watch the symbols… (${revealedIndex + 1}/${TUTORIAL_DEMO_STREAM.length})`
          : `Tap the last ${TUTORIAL_DEMO_RECALL} in order`}
      </ThemedText>

      {phase === "reveal" && revealing ? (
        <SymbolView
          symbolId={TUTORIAL_DEMO_STREAM[revealedIndex]}
          size={64}
          testID={testId(GAME_ID, "tutorial-flash")}
        />
      ) : null}

      {phase === "input" ? (
        <>
          <View
            style={styles.palette}
            testID={testId(GAME_ID, "tutorial-palette")}
          >
            {RUNNING_ORDER_SYMBOLS.map((sym) => (
              <SymbolView
                key={sym.id}
                symbolId={sym.id}
                size={36}
                testID={testId(GAME_ID, "tutorial-palette", String(sym.id))}
                highlighted={answer.includes(sym.id)}
                onPress={() => handleTap(sym.id)}
                disabled={answer.length >= TUTORIAL_DEMO_RECALL}
              />
            ))}
          </View>
          {feedback ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              testID={testId(GAME_ID, "tutorial-demo-feedback")}
            >
              {feedback}
            </ThemedText>
          ) : null}
        </>
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
  palette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    justifyContent: "center",
  },
});
