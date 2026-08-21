/**
 * CuePanel — the recall-phase view: the current stimulus cue plus the round's
 * response palette.
 *
 * Accessibility: the cue names the stimulus identity; every response option is
 * labeled with its own letter identity. No option is ever marked as the
 * correct partner — correctness is conveyed only after the player answers
 * (via the canonical feedback events and the post-round reveal), so the answer
 * cannot be read off the accessibility tree.
 *
 * Options are memoized with stable handlers so re-renders between cues skip
 * unchanged buttons.
 */
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { testId } from "@/sdk";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { responseById, stimulusById } from "../pairs";
import { GAME_ID } from "../types";
import type { PairRecallRound } from "../types";

export interface CuePanelProps {
  /** The round being recalled (cue order + palette come from it). */
  round: PairRecallRound;
  /** Index into the round's `cueOrder` for the current cue. */
  cueIndex: number;
  disabled?: boolean;
  /** Stable tap handler supplied by the screen (avoids per-render closures). */
  onRespond?: (responseId: number) => void;
}

const ResponseOption = memo(function ResponseOption({
  responseId,
  disabled,
  onRespond,
}: {
  responseId: number;
  disabled: boolean;
  onRespond?: (responseId: number) => void;
}) {
  const theme = useTheme();
  const response = responseById(responseId);
  return (
    <Pressable
      testID={testId(GAME_ID, "response", String(responseId))}
      accessibilityRole="button"
      accessibilityLabel={response.label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onRespond ? () => onRespond(responseId) : undefined}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.letter, { color: theme.text }]} allowFontScaling={false}>
        {response.glyph}
      </Text>
    </Pressable>
  );
});

export function CuePanel({ round, cueIndex, disabled = false, onRespond }: CuePanelProps) {
  const theme = useTheme();
  const pairIndex = round.cueOrder[cueIndex];
  const pair = round.pairs[pairIndex];
  const stimulus = stimulusById(pair.stimulusId);

  return (
    <View style={styles.panel}>
      <View
        style={styles.cueCard}
        testID={testId(GAME_ID, "cue")}
        accessibilityLabel={`Which partner goes with ${stimulus.label}?`}
      >
        <Text style={[styles.stimulus, { color: stimulus.color }]} allowFontScaling={false}>
          {stimulus.glyph}
        </Text>
        <Text style={[styles.cueQuestion, { color: theme.textSecondary }]}>→ ?</Text>
      </View>
      <View style={styles.palette} testID={testId(GAME_ID, "palette")}>
        {round.responseOptions.map((responseId) => (
          <ResponseOption
            key={responseId}
            responseId={responseId}
            disabled={disabled}
            onRespond={onRespond}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.three,
    alignItems: "center",
  },
  cueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: Radii.large,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  stimulus: {
    fontSize: 44,
    fontWeight: "700",
  },
  cueQuestion: {
    fontSize: 28,
  },
  palette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    justifyContent: "center",
  },
  option: {
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    paddingVertical: Spacing.oneHalf,
    paddingHorizontal: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
  letter: {
    fontSize: 22,
    fontWeight: "700",
  },
});
