/**
 * Cell — one grid cell of the Grid Recall board.
 *
 * Visual states: `idle`, `target` (shown during study), `selected` (the
 * player's own input-phase tap), `correct` (was a target, after scoring),
 * `error` (wrong tap, after scoring). Cells are plain surfaces; the pattern is
 * positional, so no per-cell glyphs are rendered.
 *
 * Accessibility: labels are neutral ("Cell N") and never reveal the answer. A
 * cell is only marked `selected` via the a11y state when it is the player's own
 * input-phase selection — the target pattern is conveyed visually only, so it
 * cannot be read off the accessibility tree during the obscured input/pause
 * phases.
 */
import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";

import { testId } from "@/sdk";
import { Radii } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { GAME_ID } from "../types";

export type CellVisualState =
  | "idle"
  | "target"
  | "selected"
  | "correct"
  | "error";

export interface CellProps {
  /** 0-based cell index; also the stable part of the semantic testID. */
  index: number;
  visual: CellVisualState;
  disabled?: boolean;
  /** Stable tap handler supplied by the board (avoids per-render closures). */
  onPressCell?: (index: number) => void;
}

export const Cell = memo(function Cell({
  index,
  visual,
  disabled = false,
  onPressCell,
}: CellProps) {
  const theme = useTheme();
  const backgroundColor =
    visual === "target"
      ? theme.accent
      : visual === "error"
        ? theme.danger
        : visual === "correct"
          ? theme.success
          : visual === "selected"
            ? theme.accentSoft
            : theme.surface;

  return (
    <Pressable
      testID={testId(GAME_ID, "cell", String(index))}
      accessibilityRole="button"
      accessibilityLabel={`Cell ${index + 1}`}
      accessibilityState={{ disabled, selected: visual === "selected" }}
      disabled={disabled}
      onPress={onPressCell ? () => onPressCell(index) : undefined}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor, borderColor: theme.border },
        (pressed || visual === "target") && styles.dim,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  cell: {
    aspectRatio: 1,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
  },
  dim: {
    opacity: 0.85,
  },
});
