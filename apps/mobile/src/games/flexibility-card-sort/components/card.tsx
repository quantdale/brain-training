/**
 * Card — one shape/color card of the Card Sort game.
 *
 * Renders the shape glyph in its card color plus a small color-name caption
 * (color-blind accessible and unambiguous for QA). Content colors are a fixed
 * deterministic palette (game content, not theme tokens) so the color rule is
 * identical across light/dark themes and devices.
 */
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Card, ColorId, ShapeId } from '../types';

/** Fixed content palette for the card colors (distinct, theme-independent). */
export const CARD_COLOR_HEX: Readonly<Record<ColorId, string>> = {
  red: '#D5485B',
  blue: '#4F6BFF',
  green: '#1E9E62',
  yellow: '#D98E04',
};

/** Filled glyphs for the shape alphabet. */
export const SHAPE_GLYPHS: Readonly<Record<ShapeId, string>> = {
  circle: '●',
  triangle: '▲',
  square: '■',
  star: '★',
};

export type CardVisualState = 'idle' | 'selected' | 'error';

export interface CardViewProps {
  card: Card;
  /** Semantic testID of the card surface. */
  testID: string;
  onPress?: () => void;
  disabled?: boolean;
  visual?: CardVisualState;
}

export function CardView({
  card,
  testID,
  onPress,
  disabled = false,
  visual = 'idle',
}: CardViewProps) {
  const theme = useTheme();
  const color = CARD_COLOR_HEX[card.color];
  const borderColor =
    visual === 'error' ? theme.danger : visual === 'selected' ? theme.accent : theme.border;
  const background = visual === 'selected' ? theme.accentSoft : theme.surface;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${card.color} ${card.shape}`}
      accessibilityState={{ disabled, selected: visual === 'selected' }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: background, borderColor },
        pressed && styles.dim,
      ]}>
      <ThemedText type="display" style={{ color, lineHeight: 48 }}>
        {SHAPE_GLYPHS[card.shape]}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {card.color}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1,
    borderRadius: Radii.medium,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
    gap: Spacing.half,
  },
  dim: {
    opacity: 0.85,
  },
});
