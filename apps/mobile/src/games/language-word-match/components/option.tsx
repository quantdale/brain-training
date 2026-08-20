/**
 * Option — one answer card of the Word Match prompt.
 *
 * Visual states: `idle` (answerable), `correct` (the right synonym), `wrong`
 * (the tapped wrong word), `muted` (non-relevant options after the round).
 * The word is the whole control — no other hint (family, tier) is ever shown.
 *
 * Memoized so unchanged options skip re-renders when the parent re-renders on
 * unrelated state. The stable `onPressOption(index)` handler is invoked
 * internally, avoiding a fresh closure per option per render.
 */
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';

export type OptionVisualState = 'idle' | 'correct' | 'wrong' | 'muted';

export interface OptionProps {
  /** 0-based option index; also the stable part of the semantic testID. */
  index: number;
  /** The word rendered on the card. */
  label: string;
  visual: OptionVisualState;
  disabled?: boolean;
  /** Stable tap handler supplied by the parent (avoids per-render closures). */
  onPressOption?: (index: number) => void;
}

export const Option = memo(function Option({
  index,
  label,
  visual,
  disabled = false,
  onPressOption,
}: OptionProps) {
  const theme = useTheme();

  const backgroundColor =
    visual === 'correct'
      ? theme.success
      : visual === 'wrong'
        ? theme.danger
        : theme.surface;
  const foregroundColor =
    visual === 'correct' || visual === 'wrong' ? '#FFFFFF' : theme.text;
  const borderColor = visual === 'idle' ? theme.border : backgroundColor;
  const dim = visual === 'muted' || disabled;

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: visual === 'correct' || visual === 'wrong' }}
      disabled={disabled}
      onPress={onPressOption ? () => onPressOption(index) : undefined}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor, borderColor, opacity: pressed || dim ? 0.6 : 1 },
      ]}>
      <ThemedText type="bodyLarge" style={{ color: foregroundColor, textAlign: 'center' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  option: {
    alignSelf: 'stretch',
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 56,
    justifyContent: 'center',
  },
});
