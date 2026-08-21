/**
 * ClueTable — the entity × attribute grid of the Deduction Table round.
 *
 * Purely structural: every cell renders as "?" because nothing is known
 * upfront — the player deduces the asked value from the clue list. The grid
 * gives the round its "table" identity and stays neutral for accessibility
 * (labels never contain answers).
 */
import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { GAME_ID } from "../types";
import type { LogicDeductionRound } from "../types";

export interface ClueTableProps {
  round: LogicDeductionRound;
  /** Semantic testID of the table container. */
  testID: string;
}

export const ClueTable = memo(function ClueTable({
  round,
  testID,
}: ClueTableProps) {
  const theme = useTheme();
  return (
    <View
      style={styles.table}
      testID={testID}
      accessibilityLabel={`Deduction table: ${round.entityCount} entities by ${round.attributes.length} attributes`}
    >
      <View style={styles.row}>
        <View style={[styles.corner, { borderColor: theme.border }]} />
        {round.attributes.map((attr) => (
          <View
            key={attr.id}
            style={[styles.headerCell, { borderColor: theme.border }]}
          >
            <ThemedText type="caption" themeColor="textSecondary">
              {attr.label}
            </ThemedText>
          </View>
        ))}
      </View>
      {round.entities.map((entity) => (
        <View key={entity} style={styles.row}>
          <View
            style={[styles.entityCell, { borderColor: theme.border }]}
            testID={testId(GAME_ID, "entity", entity)}
          >
            <ThemedText type="smallBold">{entity}</ThemedText>
          </View>
          {round.attributes.map((attr) => (
            <View
              key={attr.id}
              style={[styles.cell, { borderColor: theme.border }]}
            >
              <ThemedText type="small" themeColor="textSecondary">
                ?
              </ThemedText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  table: {
    alignSelf: "stretch",
    gap: 0,
  },
  row: {
    flexDirection: "row",
  },
  corner: {
    width: 40,
    borderWidth: 1,
    borderTopLeftRadius: Radii.small,
  },
  headerCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.one,
    borderWidth: 1,
  },
  entityCell: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.one,
    borderWidth: 1,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.one,
    borderWidth: 1,
  },
});
