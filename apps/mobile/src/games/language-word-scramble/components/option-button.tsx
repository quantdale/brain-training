/**
 * OptionButton — a single option in the word scramble choices.
 * Shows the option text and visual feedback for selected/correct/wrong state.
 *
 * Memoized so unchanged options skip re-renders. The stable
 * `onPressOption(index)` handler is invoked internally, avoiding a fresh
 * closure per option per render.
 */
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';

export type OptionVisualState = 'idle' | 'selected' | 'correct' | 'wrong';

export interface OptionButtonProps {
  /** 0-based option index; also the stable part of the semantic testID. */
  index: number;
  label: string;
  visual: OptionVisualState;
  disabled?: boolean;
  /** Stable tap handler supplied by the parent (avoids per-render closures). */
  onPressOption?: (index: number) => void;
}

export const OptionButton = memo(function OptionButton({
  index,
  label,
  visual,
  disabled = false,
  onPressOption,
}: OptionButtonProps) {
  const theme = useTheme();
  const backgroundColor =
    visual === 'correct'
      ? theme.accent
      : visual === 'wrong'
        ? theme.danger
        : visual === 'selected'
          ? theme.accentSoft
          : theme.surface;

  const textColor =
    visual === 'correct' || visual === 'wrong' ? '#FFFFFF' : theme.text;

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: visual === 'selected' }}
      disabled={disabled}
      onPress={onPressOption ? () => onPressOption(index) : undefined}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor,
          borderColor: theme.border,
          opacity: pressed || disabled ? 0.8 : 1,
        },
      ]}>
      <ThemedText type="bodyLarge" style={{ color: textColor, textAlign: 'center' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  option: {
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    minWidth: 120,
    alignItems: 'center',
  },
});
