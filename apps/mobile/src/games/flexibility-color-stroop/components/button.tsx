/**
 * Game button component — shared across game modules.
 * Duplicated here to avoid cross-module imports.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface GameButtonProps {
  label: string;
  testID?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
  disabled?: boolean;
}

export function GameButton({
  label,
  testID,
  onPress,
  variant = 'primary',
  small = false,
  disabled = false,
}: GameButtonProps) {
  const theme = useTheme();

  const bgColor =
    variant === 'primary'
      ? theme.accent
      : variant === 'danger'
        ? theme.danger
        : 'transparent';

  const borderColor =
    variant === 'secondary' ? theme.border : variant === 'danger' ? theme.danger : theme.accent;

  const textColor =
    variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? '#FFFFFF' : theme.text;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.small,
        {
          backgroundColor: bgColor,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}>
      <ThemedText
        type={small ? 'caption' : 'bodyLarge'}
        style={{ color: textColor, textAlign: 'center' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});