/**
 * TokenView — renders a Task Switch token: a number shown in a color and shape.
 * Drawn with plain `react-native` `View`/`Text` primitives (no Skia). Used for
 * both the live token and the tutorial demo. Color is NEVER the sole signal:
 * the shape glyph and the numeric value are always present, and the option
 * buttons for the color task carry spelled-out color names so color is not the
 * only cue and screen readers get the label (never "correct").
 */
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import type { ColorId, ShapeId, Token } from "../types";

/** Stable color palette for the token (hex strings, theme-independent). */
export const TOKEN_COLORS: Readonly<Record<ColorId, string>> = {
  red: "#e5484d",
  blue: "#3b82f6",
  green: "#30a46c",
  yellow: "#f5d90a",
};

export type TokenVisualState = "idle" | "selected" | "error";

export interface TokenViewProps {
  token: Token;
  /** Composed semantic testID for the pressable (screen composes via `testId`). */
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
  state?: TokenVisualState;
  /** Edge length in px (default 120). */
  size?: number;
}

const SHAPE_GLYPH: Record<ShapeId, string> = {
  circle: "●",
  triangle: "▲",
  square: "■",
  star: "★",
};

function ShapeGlyph({
  shape,
  color,
  size,
}: {
  shape: ShapeId;
  color: string;
  size: number;
}) {
  return (
    <View
      style={[
        styles.shape,
        {
          width: size,
          height: size,
          borderRadius: shape === "circle" ? size / 2 : Radii.medium,
          backgroundColor: color,
        },
      ]}
    >
      <ThemedText
        style={[
          { color: "#ffffff", fontSize: size * 0.5, lineHeight: size * 0.5 },
        ]}
      >
        {SHAPE_GLYPH[shape]}
      </ThemedText>
    </View>
  );
}

export const TokenView = memo(function TokenView({
  token,
  testID,
  onPress,
  disabled = false,
  state = "idle",
  size = 120,
}: TokenViewProps) {
  const theme = useTheme();
  const color = TOKEN_COLORS[token.color];

  const borderColor =
    state === "selected"
      ? theme.success
      : state === "error"
        ? theme.danger
        : theme.border;

  const content = (
    <View
      style={[styles.container, { width: size, height: size, borderColor }]}
    >
      <ShapeGlyph shape={token.shape} color={color} size={size * 0.5} />
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ThemedText type="caption" style={{ color: theme.text }}>
          {token.number}
        </ThemedText>
      </View>
    </View>
  );

  if (onPress === undefined) {
    return <View testID={testID}>{content}</View>;
  }

  const a11yLabel = `${token.color} ${token.shape} ${token.number}`;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled, busy: false }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed || disabled ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.medium,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  shape: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    bottom: -Spacing.one,
    right: -Spacing.one,
    minWidth: 28,
    height: 28,
    paddingHorizontal: Spacing.one,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
