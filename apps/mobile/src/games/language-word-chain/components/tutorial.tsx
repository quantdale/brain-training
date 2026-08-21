/**
 * Tutorial — first-play interactive tutorial for the Word Chain game.
 *
 * Three steps: explanation, a live demo (one blank in a short chain; the
 * player picks the word that continues the chain — a wrong pick reveals the
 * answer and offers a re-drawn demo), and a completion screen. Completion
 * marks the tutorial done via the lifecycle; a dev-only skip (rendered by the
 * parent only in dev builds) uses the QA skip path.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R pattern);
 * mechanics stay local.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { createRng, testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { GameButton, TutorialFrame } from "@/components/game-ui";
import { Spacing } from "@/constants/theme";

import { loadContentPack } from "../content-validation";
import { filterByTiers, generateRound } from "../generator";
import { GAME_ID } from "../types";
import type { WordChainDifficultyParams } from "../types";
import { Option } from "./option";
import type { OptionVisualState } from "./option";

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = "language-word-chain-tutorial-demo-v1";

/** Demo tuning: one easy chain with exactly one blank and three options. */
export const TUTORIAL_DEMO_PARAMS: WordChainDifficultyParams = {
  tierMask: 1,
  rounds: 1,
  timePerRoundMs: 15_000,
  minChainLen: 5,
  maxChainLen: 5,
  minBlanks: 1,
  maxBlanks: 1,
  optionsPerStep: 3,
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
            Words form a chain: each next word starts with the last letter of
            the one before it. Some links are missing — pick the word that
            continues the chain before time runs out.
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
          attempt={attempt}
          onRetry={() => setAttempt((value) => value + 1)}
          onDone={() => setStep("done")}
          onSkip={onSkip}
        />
      ) : null}

      {step === "done" ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — chains expire on their own, and the words
            are hidden while paused.
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
  attempt: number;
  onRetry: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

function DemoRound({ attempt, onRetry, onDone, onSkip }: DemoRoundProps) {
  // Deterministic per attempt: same seed + attempt → identical demo round.
  const [round] = useState(() =>
    generateRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: attempt,
      pool: filterByTiers(loadContentPack().chains, ["t1"]),
      decoyPool: loadContentPack().decoyPool,
      params: TUTORIAL_DEMO_PARAMS,
      usedChainIds: new Set(),
      previousRound: null,
    }),
  );
  const step = round.steps[0];
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const answered = pickedIndex !== null;
  const correct = pickedIndex === step.correctIndex;

  const visualFor = (index: number): OptionVisualState => {
    if (!answered) return "idle";
    if (index === step.correctIndex) return "correct";
    return index === pickedIndex ? "wrong" : "muted";
  };

  const handlePick = (index: number) => {
    if (answered) return;
    setPickedIndex(index);
    if (index === step.correctIndex) onDone();
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, "tutorial-demo-status")}
      >
        {answered && !correct
          ? "Not quite — here’s the word that continues the chain."
          : `Pick the word that follows “${round.words[step.position - 1]}” (it must start with “${step.requiredFirstLetter}”).`}
      </ThemedText>
      <View style={styles.chain} testID={testId(GAME_ID, "tutorial-chain")}>
        {round.words.map((word, index) => (
          <View key={index} style={styles.chipWrap}>
            <ThemedText
              type="bodyLarge"
              style={
                index === step.position ? styles.chipBlank : styles.chipWord
              }
            >
              {index === step.position ? `${step.requiredFirstLetter}…` : word}
            </ThemedText>
          </View>
        ))}
      </View>
      <View style={styles.options}>
        {step.options.map((word, index) => (
          <Option
            key={index}
            index={index}
            label={word}
            visual={visualFor(index)}
            disabled={answered}
            onPressOption={handlePick}
          />
        ))}
      </View>
      {answered && !correct ? (
        <GameButton
          testID={testId(GAME_ID, "tutorial-retry")}
          label="Try another chain"
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
  chain: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chipWrap: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.oneHalf,
  },
  chipWord: {
    fontWeight: "600",
  },
  chipBlank: {
    opacity: 0.6,
  },
  options: {
    gap: Spacing.two,
  },
});
