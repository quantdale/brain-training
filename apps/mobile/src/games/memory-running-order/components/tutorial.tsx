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
import { useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";

import { systemClock, testId, type Clock } from "@/sdk";
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
  clock?: Clock;
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip, clock = systemClock }: TutorialProps) {
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
        <DemoStream clock={clock} onDone={() => setStep("done")} onSkip={onSkip} />
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
  clock: Clock;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: flashes the fixed stream, then validates the last-two recall. */
function DemoStream({ onDone, onSkip, clock }: DemoStreamProps) {
  const [revealedIndex, setRevealedIndex] = useState(0);
  const [answer, setAnswer] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string>("");
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef({ answer: [] as number[], epoch: 0, completed: false });
  const deliveredPresses = useRef(new WeakSet<object>());

  // Derived rather than stored: "input" begins exactly when the reveal
  // stream has finished flashing (avoids a cascading setState in an effect).
  const phase: "reveal" | "input" =
    revealedIndex >= TUTORIAL_DEMO_STREAM.length ? "input" : "reveal";

  const revealing =
    revealedIndex >= 0 && revealedIndex < TUTORIAL_DEMO_STREAM.length;

  useLayoutEffect(() => {
    if (!revealing) {
      return;
    }
    const deadline = clock.now() + DEMO_FLASH_MS;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      if (cancelled) return;
      const remainingMs = deadline - clock.now();
      if (remainingMs > 0) timer = setTimeout(expire, remainingMs);
      else { cancelled = true; setRevealedIndex((index) => index + 1); }
    };
    timer = setTimeout(expire, DEMO_FLASH_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [revealing, revealedIndex, clock]);

  const target = TUTORIAL_DEMO_STREAM.slice(
    TUTORIAL_DEMO_STREAM.length - TUTORIAL_DEMO_RECALL,
  );

  const handleTap = (id: number, event?: GestureResponderEvent) => {
    const input = inputRef.current;
    if (phase !== "input" || input.completed || attempt !== input.epoch || input.answer.length >= TUTORIAL_DEMO_RECALL) {
      return;
    }
    const nativePress = event?.nativeEvent;
    if (nativePress != null) {
      if (deliveredPresses.current.has(nativePress)) return;
      deliveredPresses.current.add(nativePress);
    }
    // Every symbol is already known: distinct rapid picks may share a render.
    const next = [...input.answer, id];
    input.answer = next;
    if (next.length < TUTORIAL_DEMO_RECALL) {
      setAnswer(next);
      setFeedback("");
      return;
    }
    // Final pick: validate the ordered recall.
    const correct = next.every((v, i) => v === target[i]);
    if (correct) {
      input.completed = true;
      setFeedback("Perfect!");
      onDone();
    } else {
      // This demo clears the picks; it does not replay the stream.
      setFeedback("Not quite — try the last two in order again.");
      input.answer = [];
      input.epoch += 1;
      setAttempt(input.epoch);
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
                onPress={(event) => handleTap(sym.id, event)}
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
