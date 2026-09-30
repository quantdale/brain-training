/**
 * Cell — one grid cell of the Grid Recall board.
 *
 * Visual states: `idle`, `target` (shown during study), `selected` (the
 * player's own input-phase tap), `correct` (was a target, after scoring),
 * `error` (wrong tap, after scoring).
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6, copying the
 * attention-symbol-tracker cell): `correct`/`error` change the fill AND the
 * border weight AND add a ✓/✕ badge, so a wrong tap never reads as correct.
 * The badge is decorative for screen readers — the cell's accessibility label
 * carries the verdict ("Correct: …" / "Wrong pick: …").
 *
 * Accessibility: labels are neutral ("Cell N") while the round is live. The
 * `correct`/`error` states are only ever produced for the post-submit
 * round-result board, so the verdict wording (and the solution itself) can
 * never be read off the accessibility tree during the obscured input/pause
 * phases. A cell is only marked `selected` via the a11y state when it is the
 * player's own input-phase selection.
 */
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { Radii } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/theme/tokens";
import { MIN_TOUCH_TARGET } from "@/components/a11y";

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
        ? theme.dangerSoft
        : visual === "correct"
          ? theme.successSoft
          : visual === "selected"
            ? theme.accentSoft
            : theme.surface;
  const borderColor =
    visual === "error"
      ? theme.danger
      : visual === "correct"
        ? theme.success
        : theme.border;
  const borderWidth = visual === "error" || visual === "correct" ? 3 : 1.5;
  const verdictGlyph = visual === "correct" ? "✓" : visual === "error" ? "✕" : null;
  const verdictFill = visual === "correct" ? theme.success : visual === "error" ? theme.danger : null;
  const verdictOn =
    visual === "correct" ? theme.successOn : visual === "error" ? theme.dangerOn : null;
  const accessibilityLabel =
    visual === "correct"
      ? `Correct: Cell ${index + 1}`
      : visual === "error"
        ? `Wrong pick: Cell ${index + 1}`
        : `Cell ${index + 1}`;

  return (
    <Pressable
      testID={testId(GAME_ID, "cell", String(index))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: visual === "selected" }}
      disabled={disabled}
      onPress={onPressCell ? () => onPressCell(index) : undefined}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor, borderColor, borderWidth },
        (pressed || visual === "target") && styles.dim,
      ]}>
      {verdictGlyph !== null && verdictFill !== null && verdictOn !== null ? (
        <View
          testID={testId(GAME_ID, "cell-verdict", String(index))}
          style={[styles.verdict, { backgroundColor: verdictFill }]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: verdictOn }} allowFontScaling={false}>
            {verdictGlyph}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  cell: {
    aspectRatio: 1,
    // Explicit touch-target floor; the grid layout sizes cells well above it
    // on every tier, so this only guards degenerate widths.
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
  },
  dim: {
    opacity: 0.85,
  },
  // Verdict badge: content-sized disc pinned to the cell corner. The fill +
  // glyph pair is the non-colour-alone verdict channel. No animation here, so
  // there is nothing for reduced motion to collapse.
  verdict: {
    position: "absolute",
    top: Spacing.one,
    right: Spacing.one,
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
