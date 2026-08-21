/**
 * Option — one answer card of the Deduction Table question.
 *
 * Visual states: `idle` (question phase), `correct` (the true answer, after
 * scoring), `wrong` (the player's own wrong pick, after scoring), `muted`
 * (everything else, after scoring).
 *
 * Accessibility: the label is the option value itself and nothing else —
 * it never hints at correctness. `selected` is true ONLY while the card is
 * the player's own pick (post-scoring reveal), never for the underlying
 * correct answer, so the solution cannot be read off the accessibility tree.
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

  const backgroundColor =
    visual === "correct"
      ? theme.success
      : visual === "wrong"
        ? theme.danger
        : theme.surface;
  const foregroundColor =
    visual === "correct" || visual === "wrong" ? "#FFFFFF" : theme.text;
  const borderColor =
    visual === "idle" || visual === "muted" ? theme.border : backgroundColor;
  const dim = visual === "muted" || disabled;

  return (
    <Pressable
      testID={testId(GAME_ID, "option", String(index))}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPressOption ? () => onPressOption(index) : undefined}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor, borderColor, opacity: pressed || dim ? 0.6 : 1 },
      ]}
    >
      <ThemedText type="bodyLarge" style={{ color: foregroundColor }}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  option: {
    alignSelf: "stretch",
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    paddingVertical: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
    minHeight: 52,
    justifyContent: "center",
  },
});
