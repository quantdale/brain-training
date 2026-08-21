/**
 * Stimulus — renders a Rule Flip card: a colored shape (circle / triangle /
 * square / star) with a number badge. Drawn with plain `react-native`
 * `View`/`Text` primitives (no Skia). Used both for the target and the
 * candidate cards; it becomes pressable when `onPress` is supplied.
 *
 * Visual states mirror the card-sort semantics: `idle`, `selected` (the
 * correct pick during feedback), and `error` (the wrong pick during feedback).
 *
 * The card always conveys THREE redundant signals — color, shape, AND number
 * — so color is never the sole channel (accessibility + the game's explicit
 * "color is not the only signal" constraint).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Card, ColorId, ShapeId } from '../types';

/** Stable color palette for the stimulus (hex strings, theme-independent). */
export const STIMULUS_COLORS: Readonly<Record<ColorId, string>> = {
  red: '#e5484d',
  blue: '#3b82f6',
  green: '#30a46c',
  yellow: '#f5d90a',
};

export type StimulusVisualState = 'idle' | 'selected' | 'error';

export interface StimulusProps {
  card: Card;
  /** Composed semantic testID for the pressable (screen composes via `testId`). */
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
  state?: StimulusVisualState;
  /** Edge length in px (default 96). */
  size?: number;
}

const STAR_GLYPH = '★';

function ShapeGlyph({
  shape,
  color,
  size,
}: {
  shape: ShapeId;
  color: string;
  size: number;
}) {
  if (shape === 'circle') {
    return (
      <View
        style={[
          styles.shape,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    );
  }
  if (shape === 'square') {
    return (
      <View
        style={[
          styles.shape,
          {
            width: size,
            height: size,
            borderRadius: Radii.medium,
            backgroundColor: color,
          },
        ]}
      />
    );
  }
  if (shape === 'triangle') {
    // Up-pointing triangle via the CSS border trick.
    return (
      <View
        style={[
          styles.shape,
          {
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'flex-end',
          },
        ]}
      >
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: size / 2,
            borderRightWidth: size / 2,
            borderBottomWidth: size,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: color,
          }}
        />
      </View>
    );
  }
  // star: a bold glyph in the shape's color.
  return (
    <View
      style={[
        styles.shape,
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <ThemedText style={[{ color, fontSize: size * 0.72, lineHeight: size * 0.72 }]}>
        {STAR_GLYPH}
      </ThemedText>
    </View>
  );
}

export const Stimulus = memo(function Stimulus({
  card,
  testID,
  onPress,
  disabled = false,
  state = 'idle',
  size = 96,
}: StimulusProps) {
  const theme = useTheme();
  const color = STIMULUS_COLORS[card.color];

  const borderColor =
    state === 'selected'
      ? theme.success
      : state === 'error'
        ? theme.danger
        : theme.border;

  const content = (
    <View
      style={[styles.container, { width: size, height: size, borderColor }]}
    >
      <ShapeGlyph shape={card.shape} color={color} size={size * 0.66} />
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ThemedText type="caption" style={{ color: theme.text }}>
          {card.number}
        </ThemedText>
      </View>
    </View>
  );

  if (onPress === undefined) {
    return <View testID={testID}>{content}</View>;
  }

  const a11yLabel = `${card.color} ${card.shape} ${card.number}`;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
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
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.medium,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  shape: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -Spacing.one,
    right: -Spacing.one,
    minWidth: 24,
    height: 24,
    paddingHorizontal: Spacing.one,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
