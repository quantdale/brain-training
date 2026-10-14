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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { GestureResponderEvent } from 'react-native';

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

  // A tutorial owns its rendered step/attempt until it advances or closes.
  // Publish that boundary before React commits so queued native controls
  // cannot retry, complete or skip a later teaching cue.
  const ownerRef = useRef({
    step: 'intro' as TutorialStep | 'closed', attempt: 0, mounted: true,
  });
  const deliveredPresses = useRef(new WeakSet<object>());
  useEffect(() => {
    const owner = ownerRef.current;
    owner.mounted = true;
    return () => { owner.mounted = false; };
  }, []);
  const claimPress = useCallback((event?: GestureResponderEvent) => {
    const payload = event?.nativeEvent;
    if (payload == null) return true;
    if (deliveredPresses.current.has(payload)) return false;
    deliveredPresses.current.add(payload);
    return true;
  }, []);
  const isCurrentDemo = useCallback(() => {
    const owner = ownerRef.current;
    return owner.mounted && owner.step === 'demo' && owner.attempt === attempt;
  }, [attempt]);
  const handleDemoDone = () => {
    if (!isCurrentDemo()) return;
    ownerRef.current.step = 'done';
    setStep('done');
  };
  const handleRetry = (event?: GestureResponderEvent) => {
    if (!isCurrentDemo() || !claimPress(event)) return;
    ownerRef.current.attempt += 1;
    setAttempt(ownerRef.current.attempt);
  };
  const handleNext = (event?: GestureResponderEvent) => {
    const owner = ownerRef.current;
    if (!owner.mounted || owner.step !== 'intro' || !claimPress(event)) return;
    owner.step = 'demo';
    setStep('demo');
  };
  const handleComplete = (event?: GestureResponderEvent) => {
    const owner = ownerRef.current;
    if (!owner.mounted || owner.step !== 'done' || !claimPress(event)) return;
    owner.step = 'closed';
    onComplete();
  };
  const handleSkip = (event?: GestureResponderEvent) => {
    const owner = ownerRef.current;
    if (!owner.mounted || owner.step !== step || owner.attempt !== attempt ||
        !claimPress(event)) return;
    owner.step = 'closed';
    onSkip?.();
  };

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
            onPress={handleNext}
          />
          {onSkip !== undefined ? (
            <GameButton
              testID={testId(GAME_ID, "tutorial-skip")}
              label="Skip tutorial (QA)"
              variant="secondary"
              onPress={handleSkip}
            />
          ) : null}
        </View>
      ) : null}

      {step === "demo" ? (
        <DemoRound
          key={attempt}
          onRetry={handleRetry}
          onDone={handleDemoDone}
          isCurrentDemo={isCurrentDemo}
          claimPress={claimPress}
          onSkip={onSkip === undefined ? undefined : handleSkip}
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
            onPress={handleComplete}
          />
        </View>
      ) : null}
    </TutorialFrame>
  );
}

interface DemoRoundProps {
  onRetry: () => void;
  onDone: () => void;
  isCurrentDemo: () => boolean;
  claimPress: (event?: GestureResponderEvent) => boolean;
  onSkip?: () => void;
}

/** One demo run: clues + question + options; a wrong pick offers a retry. */
function DemoRound({ onRetry, onDone, onSkip, isCurrentDemo, claimPress }: DemoRoundProps) {
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
  const pickedRef = useRef(false);
  const answered = pickedIndex !== null;
  const correct = pickedIndex === round.correctIndex;

  const visualFor = (index: number): OptionVisualState => {
    if (!answered) return "idle";
    if (index === round.correctIndex) return "correct";
    return index === pickedIndex ? "wrong" : "muted";
  };

  const handlePick = useCallback(
    (index: number, event?: GestureResponderEvent) => {
      if (!isCurrentDemo() || pickedRef.current || !claimPress(event)) return;
      // Keep the first choice even when React batches two native callbacks.
      pickedRef.current = true;
      setPickedIndex(index);
      if (index === round.correctIndex) onDone();
    },
    [isCurrentDemo, claimPress, round.correctIndex, onDone],
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
