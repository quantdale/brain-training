/**
 * StreamView — the stream-phase display: the current glyph plus a shrinking
 * response-window bar.
 *
 * Accessibility: the label names ONLY the glyph identity ("orange star").
 * Whether it is an active signal is exactly what the player must remember,
 * so it is never rendered visually or exposed to the accessibility tree —
 * correctness is conveyed only after the player answers.
 */
import { StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { glyphById } from "../glyphs";
import { GAME_ID } from "../types";
import type { StreamItem } from "../types";

export interface StreamViewProps {
  /** The current stream item. */
  item: StreamItem;
  /** Remaining response-window fraction (0..1); drives the urgency bar. */
  fractionRemaining: number;
  /** True while paused (bar frozen; content hidden by the parent overlay). */
  disabled?: boolean;
}

export function StreamView({
  item,
  fractionRemaining,
  disabled = false,
}: StreamViewProps) {
  const theme = useTheme();
  const glyph = glyphById(item.glyphId);
  const clamped = Math.min(1, Math.max(0, fractionRemaining));

  return (
    <View style={styles.panel}>
      <View
        style={styles.card}
        testID={testId(GAME_ID, "stream-item")}
        accessibilityLabel={glyph.label}
        accessibilityHint="Respond with Go for normal symbols, Signal if this one is one of your memorized signals."
      >
        <ThemedText
          type="title"
          style={{ color: glyph.color, fontSize: 72 }}
          allowFontScaling={false}
        >
          {glyph.glyph}
        </ThemedText>
      </View>
      <View
        style={[styles.windowTrack, { backgroundColor: theme.border }]}
        testID={testId(GAME_ID, "window-track")}
      >
        <View
          style={[
            styles.windowFill,
            {
              backgroundColor: disabled ? theme.border : theme.accent,
              width: `${Math.round(clamped * 100)}%`,
            },
          ]}
          testID={testId(GAME_ID, "window-fill")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.three,
    alignItems: "center",
  },
  card: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
    borderRadius: Radii.large,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  windowTrack: {
    alignSelf: "stretch",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  windowFill: {
    height: "100%",
    borderRadius: 4,
  },
});
