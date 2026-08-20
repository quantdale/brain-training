/**
 * ColorPicker — grid of color buttons for building guesses in Code Cracker.
 *
 * Each color is a circle that can be tapped to add it to the current guess.
 * Colors are mapped to visual representations (colored circles) with
 * accessibility labels.
 *
 * The grid is memoized, and each swatch is its own memoized leaf that invokes
 * the stable `onSelectColor(index)` handler internally, so unchanged swatches
 * skip re-renders. Each swatch also carries a visible color-name label so the
 * control is not color-only (a minimal non-color cue; the color signal is kept).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { testId } from '@/sdk';
import { Radii, Spacing } from '@/constants/theme';

import { GAME_ID } from '../types';

/** Color palette — 8 distinct colors for the game. */
export const COLOR_PALETTE = [
  '#E74C3C', // Red
  '#3498DB', // Blue
  '#2ECC71', // Green
  '#F39C12', // Yellow
  '#9B59B6', // Purple
  '#E67E22', // Orange
  '#1ABC9C', // Teal
  '#E91E63', // Pink
] as const;

/** Human-readable names for each color (used in accessibility labels). */
export const COLOR_NAMES = [
  'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Teal', 'Pink',
] as const;

export interface ColorPickerProps {
  /** Number of available colors (2-8). */
  colorCount: number;
  /** Called when the player taps a color. */
  onSelectColor: (colorIndex: number) => void;
  /** Whether the picker is disabled (e.g. during reveal, after round end). */
  disabled?: boolean;
}

/** One tappable color swatch. Memoized so only it re-renders when its props change. */
const ColorSwatch = memo(function ColorSwatch({
  index,
  disabled,
  testID,
  onSelectColor,
}: {
  index: number;
  disabled: boolean;
  testID: string;
  onSelectColor?: (colorIndex: number) => void;
}) {
  return (
    <View style={styles.cell}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${COLOR_NAMES[index]} color`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onSelectColor ? () => onSelectColor(index) : undefined}
        style={[styles.colorCircle, { backgroundColor: COLOR_PALETTE[index] }, disabled && styles.disabled]}
      />
      <ThemedText type="caption" style={styles.label}>
        {COLOR_NAMES[index]}
      </ThemedText>
    </View>
  );
});

export const ColorPicker = memo(function ColorPicker({
  colorCount,
  onSelectColor,
  disabled = false,
}: ColorPickerProps) {
  return (
    <View style={styles.grid} testID={testId(GAME_ID, 'color-picker')}>
      {Array.from({ length: colorCount }, (_, i) => (
        <ColorSwatch
          key={i}
          index={i}
          disabled={disabled}
          testID={testId(GAME_ID, 'color', String(i))}
          onSelectColor={onSelectColor}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  cell: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  colorCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#00000022',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    textAlign: 'center',
  },
});
