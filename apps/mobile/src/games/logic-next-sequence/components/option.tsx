/**
 * Option — one answer button of the Next in Sequence puzzle.
 *
 * Visual states: `idle` (answerable), `correct` (the true continuation on the
 * round result), `wrong` (the option the player picked when it was not
 * correct), `dim` (remaining options after the round is scored).
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6): borders stay constant, the
 * fill changes AND a ✓/✕ glyph is prepended, so colour is never the only
 * signal. Glyphs opt out of font scaling so the board keeps its geometry.
 * `dim` dims to read as locked. Numerals stay tabular so a verdict swap
 * cannot reflow the row. No animation here, so there is nothing for reduced
 * motion to collapse.
 */
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

export type OptionVisualState = 'idle' | 'correct' | 'wrong' | 'dim';

export interface OptionProps {
  /** 0-based option index; also the stable part of the semantic testID. */
  index: number;
  label: string;
  visual: OptionVisualState;
  disabled?: boolean;
  /** Stable tap handler supplied by the list (avoids per-render closures). */
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
  const isVerdict = visual === 'correct' || visual === 'wrong';
  const backgroundColor =
    visual === 'correct' ? theme.success : visual === 'wrong' ? theme.danger : theme.surface;
  // On-slots, never a literal: dark-mode fills carry dark glyphs.
  const foregroundColor =
    visual === 'correct' ? theme.successOn : visual === 'wrong' ? theme.dangerOn : theme.text;
  // Borders stay constant across states — fill + glyph carry the verdict.
  const borderColor = theme.border;

  const accessibilityLabel =
    visual === 'correct'
      ? `Correct: option ${index + 1}, ${label}`
      : visual === 'wrong'
        ? `Wrong pick: option ${index + 1}, ${label}`
        : visual === 'dim'
          ? `Option ${index + 1}: ${label}, locked`
          : `Option ${index + 1}: ${label}`;

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={
        visual === 'idle' && !disabled ? `Pick ${label} as the next term` : undefined
      }
      accessibilityState={{ disabled, selected: isVerdict }}
      disabled={disabled}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      onPress={onPressOption ? () => onPressOption(index) : undefined}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor,
          borderColor,
          // Verdicts stay vivid behind the result card; only dim dims.
          opacity: pressed ? 0.7 : visual === 'dim' ? 0.5 : 1,
        },
      ]}>
      {isVerdict ? (
        <ThemedText type="bodyLarge" style={{ color: foregroundColor }} allowFontScaling={false}>
          {visual === 'correct' ? '✓' : '✕'}
        </ThemedText>
      ) : null}
      <ThemedText type="bodyLarge" style={[styles.number, { color: foregroundColor }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

export interface OptionListProps {
  options: readonly number[];
  /** Stable visual resolver (depends only on round-resolution state). */
  visualFor: (index: number) => OptionVisualState;
  disabled?: boolean;
  /** Stable tap handler; passed through so memoized options skip re-renders. */
  onPressOption: (index: number) => void;
}

export const OptionList = memo(function OptionList({
  options,
  visualFor,
  disabled = false,
  onPressOption,
}: OptionListProps) {
  return (
    <>
      {options.map((value, index) => (
        <Option
          key={index}
          index={index}
          label={String(value)}
          visual={visualFor(index)}
          disabled={disabled}
          onPressOption={onPressOption}
        />
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minWidth: 120,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
});
