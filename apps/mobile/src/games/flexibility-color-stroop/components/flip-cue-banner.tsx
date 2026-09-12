/**
 * Flip cue banner — displayed when the answer rule changes.
 */
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import type { AnswerRule } from "../types";

interface FlipCueBannerProps {
  newRule: AnswerRule;
  testID?: string;
}

export function FlipCueBanner({ newRule, testID }: FlipCueBannerProps) {
  const theme = useTheme();

  const ruleLabel = newRule === "ink" ? "INK COLOR" : "WORD";
  const description =
    newRule === "ink"
      ? "Tap the color the word is written in"
      : "Tap the color the word says";

  return (
    <View
      style={[styles.container, { backgroundColor: theme.warning }]}
      testID={testID}
      accessibilityLabel={`Rule changed. Now answer the ${ruleLabel}.`}
    >
      <ThemedText type="headline" style={[styles.title, { color: theme.warningOn }]}>
        RULE CHANGE!
      </ThemedText>
      <ThemedText type="bodyLarge" style={[styles.rule, { color: theme.warningOn }]}>
        Answer the {ruleLabel}
      </ThemedText>
      <ThemedText type="caption" style={[styles.description, { color: theme.warningOn }]}>
        {description}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: Radii.large,
    alignItems: "center",
    marginVertical: Spacing.two,
  },
  // Copy sits ON the warning fill: the `on` slot (not raw black literals)
  // keeps the banner legible in both themes (Campaign 026 colour sweep).
  title: {
    fontWeight: "700",
    marginBottom: Spacing.one,
  },
  rule: {
    fontWeight: "600",
  },
  description: {
    marginTop: Spacing.one,
    opacity: 0.85,
  },
});
