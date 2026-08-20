/**
 * ColorButton — a large pressable button in a specific color for the player to tap.
 *
 * Each button represents one of the 6 palette colors. The player must tap
 * the button matching the swatch color (not the text color).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { testId } from '@/sdk';

import { COLOR_HEX, GAME_ID, type ColorName } from '../types';

export interface ColorButtonProps {
  color: ColorName;
  /** Stable tap handler; receives the tapped color so memoized buttons skip re-renders. */
  onPress: (color: ColorName) => void;
  disabled?: boolean;
  testID?: string;
}

export const ColorButton = memo(function ColorButton({
  color,
  onPress,
  disabled = false,
  testID,
}: ColorButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID ?? testId(GAME_ID, 'color-btn', color)}
      accessibilityRole="button"
      accessibilityLabel={color}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onPress(color)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: COLOR_HEX[color],
          opacity: pressed || disabled ? 0.6 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={styles.label}>
        {color.toUpperCase()}
      </ThemedText>
    </Pressable>
  );
});

export interface ColorButtonGridProps {
  colors: readonly ColorName[];
  /** Stable tap handler passed straight through to each memoized button. */
  onPress: (color: ColorName) => void;
  disabled?: boolean;
}

export const ColorButtonGrid = memo(function ColorButtonGrid({
  colors,
  onPress,
  disabled,
}: ColorButtonGridProps) {
  return (
    <View style={styles.grid} testID={testId(GAME_ID, 'color-grid')}>
      {colors.map((color) => (
        <ColorButton key={color} color={color} onPress={onPress} disabled={disabled} />
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
  button: {
    width: 100,
    height: 60,
    borderRadius: Radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
  },
});
