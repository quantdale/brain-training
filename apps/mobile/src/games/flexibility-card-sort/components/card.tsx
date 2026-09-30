/**
 * Card — one shape/color card of the Card Sort game.
 *
 * Renders the shape glyph in its card color plus a small color-name caption
 * (color-blind accessible and unambiguous for QA). Content colors are a fixed
 * deterministic palette (game content, not theme tokens) so the color rule is
 * identical across light/dark themes and devices.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
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

export type CardVisualState = 'idle' | 'selected' | 'correct' | 'error';

export interface CardViewProps {
  /** 0-based card index; also supplied to the stable tap handler. */
  index: number;
  card: Card;
  /** Semantic testID of the card surface. */
  testID: string;
  /** Stable tap handler supplied by the grid (avoids per-render closures). */
  onPressCard?: (index: number) => void;
  disabled?: boolean;
  visual?: CardVisualState;
}

export const CardView = memo(function CardView({
  index,
  card,
  testID,
  onPressCard,
  disabled = false,
  visual = 'idle',
}: CardViewProps) {
  const theme = useTheme();
  const color = CARD_COLOR_HEX[card.color];
  // Verdicts change fill AND icon, never colour alone: a correct sort gets a
  // success-soft fill plus a ✓ badge; a wrong pick gets a danger-soft fill
  // plus a ✕ badge. Badges are opaque verdict-family fills with their `*On`
  // glyph, so the icon reads on any board behind it.
  const borderColor =
    visual === 'correct'
      ? theme.success
      : visual === 'error'
        ? theme.danger
        : visual === 'selected'
          ? theme.accent
          : theme.border;
  const background =
    visual === 'correct'
      ? theme.successSoft
      : visual === 'error'
        ? theme.dangerSoft
        : visual === 'selected'
          ? theme.accentSoft
          : theme.surface;
  const verdictGlyph = visual === 'correct' ? '✓' : visual === 'error' ? '✕' : null;
  const verdictFill = visual === 'correct' ? theme.success : visual === 'error' ? theme.danger : null;
  const verdictOn = visual === 'correct' ? theme.successOn : visual === 'error' ? theme.dangerOn : null;
  const accessibilityLabel =
    visual === 'correct'
      ? `Correct: ${card.color} ${card.shape}`
      : visual === 'error'
        ? `Wrong pick: ${card.color} ${card.shape}`
        : `${card.color} ${card.shape}`;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: visual === 'selected' || visual === 'correct' }}
      disabled={disabled}
      onPress={onPressCard ? () => onPressCard(index) : undefined}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: background, borderColor, borderWidth: verdictGlyph !== null ? 3 : 2 },
        pressed && styles.dim,
      ]}>
      <ThemedText type="display" style={{ color, lineHeight: 48 }}>
        {SHAPE_GLYPHS[card.shape]}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {card.color}
      </ThemedText>
      {verdictGlyph !== null && verdictFill !== null && verdictOn !== null ? (
        <View
          testID={`${testID}.verdict`}
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
  card: {
    aspectRatio: 1,
    borderRadius: Radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
    gap: Spacing.half,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
  },
  verdict: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.85,
  },
});
