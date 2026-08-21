/**
 * PairBoard — the study-phase view of one round's associations.
 *
 * Renders each pair as a card: stimulus glyph (shape + color) → response
 * letter chip. This is the STUDY phase, so showing the answers is the point;
 * during recall/pause the board is not rendered at all (the screen swaps it
 * for the cue panel / hides it behind the opaque pause overlay), so the
 * associations can never be read off the UI when they must be recalled.
 *
 * Cards are memoized with stable per-card data so re-renders (e.g. the study
 * countdown) skip unchanged cards.
 */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { testId } from "@/sdk";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { responseById, stimulusById } from "../pairs";
import { GAME_ID } from "../types";
import type { PairRecallRound } from "../types";

export interface PairBoardProps {
  /** The round whose pairs are shown. */
  round: PairRecallRound;
  disabled?: boolean;
}

const PairCard = memo(function PairCard({
  stimulusId,
  responseId,
}: {
  stimulusId: number;
  responseId: number;
}) {
  const theme = useTheme();
  const stimulus = stimulusById(stimulusId);
  const response = responseById(responseId);
  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={testId(GAME_ID, "pair", String(stimulusId))}
      accessibilityLabel={`${stimulus.label} goes with ${response.label}`}
    >
      <Text style={[styles.stimulus, { color: stimulus.color }]} allowFontScaling={false}>
        {stimulus.glyph}
      </Text>
      <Text style={[styles.arrow, { color: theme.textSecondary }]} allowFontScaling={false}>
        →
      </Text>
      <View
        style={[styles.chip, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}
      >
        <Text style={[styles.letter, { color: theme.text }]} allowFontScaling={false}>
          {response.glyph}
        </Text>
      </View>
    </View>
  );
});

export function PairBoard({ round }: PairBoardProps) {
  return (
    <View style={styles.board} testID={testId(GAME_ID, "pair-board")}>
      {round.pairs.map((pair) => (
        <PairCard
          key={pair.stimulusId}
          stimulusId={pair.stimulusId}
          responseId={pair.responseId}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    justifyContent: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.oneHalf,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.oneHalf,
  },
  stimulus: {
    fontSize: 26,
    fontWeight: "700",
  },
  arrow: {
    fontSize: 16,
  },
  chip: {
    minWidth: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.small,
    borderWidth: 1,
    paddingVertical: 2,
  },
  letter: {
    fontSize: 18,
    fontWeight: "700",
  },
});
