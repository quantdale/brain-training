/**
 * OptionButton — a single option in the word scramble choices.
 *
 * Visual states: `idle` (answerable), `selected` (the player's staged pick
 * before submit), `correct` (the unscrambled word, after submit), `wrong`
 * (the staged pick when it was not the answer, after submit).
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6): borders stay constant, the
 * fill changes AND a ✓/✕ glyph is prepended, so colour is never the only
 * signal. The glyph duplicates meaning only for sighted users — the
 * accessible name carries the verdict in words ("Correct: …" /
 * "Wrong pick: …"). Glyphs opt out of font scaling so the board keeps its
 * geometry. No animation here, so there is nothing for reduced motion to
 * collapse.
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
  /** The word rendered on the button. */
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
  const isVerdict = visual === 'correct' || visual === 'wrong';
  const backgroundColor =
    visual === 'correct'
      ? theme.success
      : visual === 'wrong'
        ? theme.danger
        : visual === 'selected'
          ? theme.accentSoft
          : theme.surface;

  // On-slots, never a literal: dark-mode fills carry dark glyphs.
  const textColor =
    visual === 'correct' ? theme.successOn : visual === 'wrong' ? theme.dangerOn : theme.text;
  // Borders stay constant across states — fill + glyph carry the verdict.
  const borderColor = theme.border;

  const accessibilityLabel =
    visual === 'correct'
      ? `Correct: ${label}`
      : visual === 'wrong'
        ? `Wrong pick: ${label}`
        : visual === 'selected'
          ? `Selected: ${label}`
          : label;

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: visual === 'selected' || isVerdict }}
      disabled={disabled}
      onPress={onPressOption ? () => onPressOption(index) : undefined}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor,
          borderColor,
          opacity: pressed || disabled ? 0.8 : 1,
        },
      ]}>
      {isVerdict ? (
        <ThemedText type="bodyLarge" style={{ color: textColor }} allowFontScaling={false}>
          {visual === 'correct' ? '✓' : '✕'}
        </ThemedText>
      ) : null}
      <ThemedText type="bodyLarge" style={{ color: textColor, textAlign: 'center' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    minWidth: 120,
    minHeight: 56,
  },
});
