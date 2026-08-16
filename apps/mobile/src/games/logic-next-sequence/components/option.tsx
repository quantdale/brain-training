/**
 * Option — one answer button of the Next in Sequence puzzle.
 *
 * Visual states: `idle` (answerable), `correct` (the true continuation on the
 * round result), `wrong` (the option the player picked when it was not
 * correct), `dim` (remaining options after the round is scored).
 */
import { Pressable, StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';

export type OptionVisualState = 'idle' | 'correct' | 'wrong' | 'dim';

export interface OptionProps {
  /** 0-based option index; also the stable part of the semantic testID. */
  index: number;
  label: string;
  visual: OptionVisualState;
  disabled?: boolean;
  onPress?: () => void;
}

export function Option({ index, label, visual, disabled = false, onPress }: OptionProps) {
  const theme = useTheme();
  const backgroundColor =
    visual === 'correct'
      ? theme.success
      : visual === 'wrong'
        ? theme.danger
        : theme.surface;
  const foregroundColor = visual === 'correct' || visual === 'wrong' ? '#FFFFFF' : theme.text;
  const borderColor =
    visual === 'correct'
      ? theme.success
      : visual === 'wrong'
        ? theme.danger
        : theme.border;

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={`Option ${index + 1}: ${label}`}
      accessibilityState={{ disabled, selected: visual === 'correct' || visual === 'wrong' }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor, borderColor, opacity: pressed ? 0.7 : visual === 'dim' ? 0.5 : 1 },
      ]}>
      <ThemedText type="bodyLarge" style={[styles.number, { color: foregroundColor }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flex: 1,
    minWidth: 120,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
});
