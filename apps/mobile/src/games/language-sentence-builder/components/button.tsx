/**
 * GameButton — shared pressable used across the Sentence Builder screens.
 * Variants: `primary` (accent fill), `secondary` (outline), `danger` (error fill).
 */
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface GameButtonProps {
  label: string;
  testID: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
  disabled?: boolean;
}

export const GameButton = memo(function GameButton({
  label,
  testID,
  onPress,
  variant = 'primary',
  small = false,
  disabled = false,
}: GameButtonProps) {
  const theme = useTheme();
  const filled = variant !== 'secondary';
  const backgroundColor = filled
    ? variant === 'danger'
      ? theme.danger
      : theme.accent
    : 'transparent';
  const foregroundColor = filled ? '#FFFFFF' : theme.accent;
  const borderColor = filled ? backgroundColor : theme.accent;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: false }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: pressed || disabled ? 0.6 : 1,
        },
        small && styles.small,
      ]}>
      <ThemedText type={small ? 'caption' : 'smallBold'} style={{ color: foregroundColor }}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    paddingVertical: Spacing.twoHalf,
    paddingHorizontal: Spacing.four,
    minWidth: 120,
    alignItems: 'center',
  },
  small: {
    minWidth: 96,
    paddingVertical: Spacing.oneHalf,
    paddingHorizontal: Spacing.three,
  },
});
