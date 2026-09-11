/**
 * CueFeedback — the per-cue verdict replay for Pair Recall.
 *
 * Pair Recall advances to the next cue the instant a response is registered, so
 * without a replay the just-answered cue's verdict would never be visible.
 * This block keeps that cue (prompt + palette) mounted below the live cue with
 * the verdict resolved from the reducer's `lastCue` outcome — never the tap
 * handler's guess. On a wrong pick the tapped option (danger-soft fill, danger
 * boundary, ✕ badge) and the true partner (success pair, ✓ badge) show together
 * in the same frame, so the player learns the mapping rather than only the
 * error. The live cue stays mounted and interactive above it; this block is
 * display-only (its options are disabled buttons so the verdict still lives on
 * an interactive node for assistive tech).
 */
import { StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { GAME_ID } from "../types";
import type { PairRecallRound } from "../types";
import { CuePanel } from "./cue-panel";
import type { CueVerdict } from "./cue-panel";

export interface CueFeedbackProps {
  /** The round being recalled. */
  round: PairRecallRound;
  /** Index into `round.cueOrder` of the cue being replayed. */
  cueIndex: number;
  /** The response the player picked (reducer-authoritative). */
  responseId: number;
  /** True when the pick was the cue's true partner (reducer-authoritative). */
  correct: boolean;
}

export function CueFeedback({
  round,
  cueIndex,
  responseId,
  correct,
}: CueFeedbackProps) {
  const theme = useTheme();
  const pair = round.pairs[round.cueOrder[cueIndex]];
  const verdict: CueVerdict = {
    responseId,
    correctResponseId: pair.responseId,
    correct,
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surfaceSunken, borderColor: theme.border },
      ]}
      testID={testId(GAME_ID, "cue-feedback")}
    >
      <ThemedText
        type="small"
        themeColor={correct ? "success" : "danger"}
        testID={testId(GAME_ID, "cue-feedback-status")}
      >
        {correct ? "Previous answer: Correct" : "Previous answer: Wrong pick"}
      </ThemedText>
      <CuePanel
        round={round}
        cueIndex={cueIndex}
        disabled
        verdict={verdict}
        cueTestIDKey="feedback-cue"
        paletteTestIDKey="feedback-palette"
        optionTestIDKey="feedback-response"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    alignItems: "center",
    borderRadius: Radii.large,
    borderWidth: 1,
    padding: Spacing.two,
  },
});
