/**
 * Option — one answer card of the Deduction Table question.
 *
 * Visual states: `idle` (question phase), `correct` (the true answer, after
 * scoring), `wrong` (the player's own wrong pick, after scoring), `muted`
 * (everything else, after scoring).
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6): borders stay constant, the
 * fill changes AND a ✓/✕ glyph is prepended, so colour is never the only
 * signal. The glyph duplicates meaning only for sighted users — the
 * accessible name carries the verdict in words ("Correct: …" /
 * "Wrong pick: …"). Glyphs opt out of font scaling so the board keeps its
 * geometry. `muted` dims to read as locked. On-slots, never a literal:
 * dark-mode fills carry dark glyphs. No animation here, so there is nothing
 * for reduced motion to collapse.
 *
 * Accessibility: `selected` is true ONLY while the card is the player's own
 * pick (post-scoring reveal), never for the underlying correct answer, so
 * the solution cannot be read off the accessibility tree.
 */
import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { GAME_ID } from "../types";

export type OptionVisualState = "idle" | "correct" | "wrong" | "muted";

export interface OptionProps {
  index: number;
  label: string;
  visual: OptionVisualState;
  /** True only for the player's own picked card (never the bare answer). */
  selected?: boolean;
  disabled?: boolean;
  onPressOption?: (index: number) => void;
}

export const Option = memo(function Option({
  index,
  label,
  visual,
  selected = false,
  disabled = false,
  onPressOption,
}: OptionProps) {
  const theme = useTheme();

  const isVerdict = visual === "correct" || visual === "wrong";
  const backgroundColor =
    visual === "correct" ? theme.success : visual === "wrong" ? theme.danger : theme.surface;
  // On-slots, never a literal: dark-mode fills carry dark glyphs.
  const foregroundColor =
    visual === "correct" ? theme.successOn : visual === "wrong" ? theme.dangerOn : theme.text;
  // Borders stay constant across states — fill + glyph carry the verdict.
  const borderColor = theme.border;

  const accessibilityLabel =
    visual === "correct"
      ? `Correct: ${label}`
      : visual === "wrong"
        ? `Wrong pick: ${label}`
        : visual === "muted"
          ? `${label}, locked`
          : label;

  return (
    <Pressable
      testID={testId(GAME_ID, "option", String(index))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPressOption ? () => onPressOption(index) : undefined}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor,
          borderColor,
          // Verdicts stay vivid behind the result panel; only muted dims.
          opacity: pressed ? 0.6 : visual === "muted" ? 0.5 : 1,
        },
      ]}>
      {isVerdict ? (
        <ThemedText type="bodyLarge" style={{ color: foregroundColor }} allowFontScaling={false}>
          {visual === "correct" ? "✓" : "✕"}
        </ThemedText>
      ) : null}
      <ThemedText type="bodyLarge" style={{ color: foregroundColor, textAlign: "center" }}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  option: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    paddingVertical: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
    minHeight: 52,
  },
});
