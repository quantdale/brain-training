/**
 * ColorPicker — grid of color buttons for building guesses in Code Cracker.
 *
 * Each color is a circle that can be tapped to add it to the current guess.
 * Colors are mapped to visual representations (colored circles) with
 * accessibility labels.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

export function ColorPicker({ colorCount, onSelectColor, disabled = false }: ColorPickerProps) {
  return (
    <View style={styles.grid} testID={testId(GAME_ID, 'color-picker')}>
      {Array.from({ length: colorCount }, (_, i) => (
        <Pressable
          key={i}
          testID={testId(GAME_ID, 'color', String(i))}
          accessibilityRole="button"
          accessibilityLabel={`${COLOR_NAMES[i]} color`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => onSelectColor(i)}
          style={[
            styles.colorCircle,
            { backgroundColor: COLOR_PALETTE[i] },
            disabled && styles.disabled,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
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
});
