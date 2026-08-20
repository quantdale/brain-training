/**
 * Board — responsive square grid hosting `Cell`s.
 *
 * The grid is always square (`gridSize` cells, side = sqrt(gridSize)); cell
 * padding keeps the aspect-ratio cells flush without overflowing the row.
 */
import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { Spacing } from "@/constants/theme";

import { Cell } from "./cell";
import type { CellVisualState } from "./cell";

export interface BoardProps {
  gridSize: number;
  /** Semantic testID of the board container. */
  testID: string;
  visualFor: (index: number) => CellVisualState;
  disabled?: boolean;
  onPressCell: (index: number) => void;
}

export const Board = memo(function Board({
  gridSize,
  testID,
  visualFor,
  disabled = false,
  onPressCell,
}: BoardProps) {
  const side = Math.round(Math.sqrt(gridSize));
  return (
    <View
      style={styles.grid}
      testID={testID}
      accessibilityLabel="Grid Recall board"
    >
      {Array.from({ length: gridSize }, (_, index) => (
        <View key={index} style={[styles.cell, { width: `${100 / side}%` }]}>
          <Cell
            index={index}
            visual={visualFor(index)}
            disabled={disabled}
            onPressCell={onPressCell}
          />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignSelf: "stretch",
  },
  cell: {
    padding: Spacing.one,
  },
});
