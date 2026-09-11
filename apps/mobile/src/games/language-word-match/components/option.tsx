/**
 * Option — one answer card of the Word Match prompt.
 *
 * Visual states: `idle` (answerable), `correct` (the right synonym), `wrong`
 * (the tapped wrong word), `muted` (non-relevant options after the round).
 * The word is the whole control — no other hint (family, tier) is ever shown.
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6): borders stay constant, the
 * fill changes AND a ✓/✕ glyph is prepended, so colour is never the only
 * signal. Glyphs opt out of font scaling so the board keeps its geometry.
 * `muted` dims to read as locked. No animation here, so there is nothing for
 * reduced motion to collapse.
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
      ? `Correct: ${label}`
      : visual === 'wrong'
        ? `Wrong pick: ${label}`
        : visual === 'muted'
          ? `${label}, locked`
          : label;

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={
        visual === 'idle' && !disabled ? `Pick ${label} as the synonym` : undefined
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
          // Verdicts stay vivid behind the result sheet; only muted dims.
          opacity: pressed ? 0.6 : visual === 'muted' ? 0.5 : 1,
        },
      ]}>
      {isVerdict ? (
        <ThemedText type="bodyLarge" style={{ color: foregroundColor }} allowFontScaling={false}>
          {visual === 'correct' ? '✓' : '✕'}
        </ThemedText>
      ) : null}
      <ThemedText type="bodyLarge" style={{ color: foregroundColor, textAlign: 'center' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  option: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 56,
  },
});
