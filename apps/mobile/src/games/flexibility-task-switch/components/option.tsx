/**
 * Option — one answer row of the Task Switch game, shown once the trial is
 * scored. (Live trials answer through `GameButton`s; this is the
 * feedback-only verdict list, so a wrong pick and the correct response render
 * side by side and a stray second pick is impossible.)
 *
 * Visual states mirror the word-match semantics: `correct` (the true answer),
 * `wrong` (the option the player picked when it was not correct), `dim`
 * (remaining options after the trial is scored).
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6): the fill changes AND the
 * border weight changes AND a ✓/✕ glyph badge is prepended, so colour is
 * never the only signal. Glyphs opt out of font scaling so rows keep their
 * geometry. `dim` dims to read as locked. Rows reach the ≥44 dp target
 * through their real height — never `hitSlop`, which would overlap the
 * adjacent rows. No animation here, so there is nothing for reduced motion
 * to collapse.
 */
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { MinTouchTarget, Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type OptionVisualState = "idle" | "correct" | "wrong" | "dim";

export interface OptionProps {
  /** 0-based option index; also the stable part of the semantic testID. */
  index: number;
  label: string;
  visual: OptionVisualState;
  /** Composed semantic testID for the row (screen composes via `testId`). */
  testID: string;
}

export const Option = memo(function Option({
  index,
  label,
  visual,
  testID,
}: OptionProps) {
  const theme = useTheme();
  const isVerdict = visual === "correct" || visual === "wrong";
  const backgroundColor =
    visual === "correct"
      ? theme.successSoft
      : visual === "wrong"
        ? theme.dangerSoft
        : theme.surface;
  const borderColor =
    visual === "correct"
      ? theme.success
      : visual === "wrong"
        ? theme.danger
        : theme.border;
  const glyph = visual === "correct" ? "✓" : visual === "wrong" ? "✕" : null;
  const badgeFill =
    visual === "correct" ? theme.success : visual === "wrong" ? theme.danger : null;
  const badgeOn =
    visual === "correct"
      ? theme.successOn
      : visual === "wrong"
        ? theme.dangerOn
        : null;

  // The verdict lives in the accessible name in words; the badge duplicates
  // it for sighted users only.
  const accessibilityLabel =
    visual === "correct"
      ? `Correct: option ${index + 1}, ${label}`
      : visual === "wrong"
        ? `Wrong pick: option ${index + 1}, ${label}`
        : visual === "dim"
          ? `Option ${index + 1}: ${label}, locked`
          : `Option ${index + 1}: ${label}`;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: true, selected: visual === "correct" }}
      disabled
      style={[
        styles.option,
        {
          backgroundColor,
          borderColor,
          borderWidth: isVerdict ? 3 : 1.5,
          opacity: visual === "dim" ? 0.5 : 1,
        },
      ]}>
      {glyph !== null && badgeFill !== null && badgeOn !== null ? (
        <View
          style={[styles.badge, { backgroundColor: badgeFill }]}
          testID={`${testID}.verdict`}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: badgeOn }} allowFontScaling={false}>
            {glyph}
          </ThemedText>
        </View>
      ) : null}
      <ThemedText type="bodyLarge" style={styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.medium,
  },
  badge: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.oneHalf,
    paddingVertical: Spacing.half,
  },
  label: {
    fontVariant: ["tabular-nums"],
  },
});
