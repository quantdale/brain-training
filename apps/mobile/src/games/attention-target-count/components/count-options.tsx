/**
 * CountOptions — the number answer buttons for the Target Count game.
 *
 * Each option keeps its value testID (`count-option.<value>`), so existing
 * tests and automation keep working. Visual states: `idle` (answerable),
 * `correct` (the true count once the round is scored), `wrong` (the picked
 * value when it was not correct), `dim` (remaining options after scoring).
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6): the picked-wrong AND the
 * correct option are highlighted together — `correct` takes the success-soft
 * fill plus a success border plus a ✓ badge, `wrong` the danger-soft fill
 * plus a danger border plus a ✕ badge — so colour is never the only signal.
 * Badges are decorative for screen readers; each option's accessible name
 * carries the verdict in words. Non-verdict options dim to read as locked.
 * Glyphs opt out of font scaling so the row keeps its geometry.
 *
 * Sizing is real (min 44 dp both axes, no `hitSlop`): the buttons sit in a
 * wrapping row where outset hit areas would overlap neighbours.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

export type CountOptionVisualState = 'idle' | 'correct' | 'wrong' | 'dim';

export interface CountOptionsProps {
  /** Answer options (numbers); always includes the correct count. */
  readonly options: readonly number[];
  /** Called with the chosen value. */
  readonly onSelect: (value: number) => void;
  /** Disables all options (e.g. while paused, or once the round is scored). */
  readonly disabled?: boolean;
  /** Verdict resolver; defaults to all-`idle` (the answering phase). */
  readonly visualFor?: (value: number) => CountOptionVisualState;
}

export function CountOptions({ options, onSelect, disabled = false, visualFor }: CountOptionsProps) {
  const theme = useTheme();
  return (
    <View style={styles.row} testID={testId(GAME_ID, 'count-options')}>
      {options.map((value) => {
        const visual = visualFor?.(value) ?? 'idle';
        const isVerdict = visual === 'correct' || visual === 'wrong';
        const backgroundColor =
          visual === 'correct'
            ? theme.successSoft
            : visual === 'wrong'
              ? theme.dangerSoft
              : theme.surface;
        const borderColor =
          visual === 'correct' ? theme.success : visual === 'wrong' ? theme.danger : theme.border;
        const glyph = visual === 'correct' ? '✓' : visual === 'wrong' ? '✕' : null;
        const badgeFill = visual === 'correct' ? theme.success : visual === 'wrong' ? theme.danger : null;
        const badgeOn =
          visual === 'correct' ? theme.successOn : visual === 'wrong' ? theme.dangerOn : null;
        const foreground =
          visual === 'correct'
            ? theme.successSoftText
            : visual === 'wrong'
              ? theme.dangerSoftText
              : theme.text;
        const accessibilityLabel =
          visual === 'correct'
            ? `Correct: ${value}`
            : visual === 'wrong'
              ? `Wrong pick: ${value}`
              : visual === 'dim'
                ? `${value}, locked`
                : `${value}`;
        return (
          <Pressable
            key={value}
            testID={testId(GAME_ID, 'count-option', String(value))}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ disabled, selected: isVerdict }}
            disabled={disabled}
            onPress={() => onSelect(value)}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor, borderColor, borderWidth: isVerdict ? 3 : 1.5 },
              pressed && !disabled ? styles.pressed : null,
              visual === 'dim' ? styles.dim : null,
            ]}>
            {glyph !== null && badgeFill !== null && badgeOn !== null ? (
              <View
                style={[styles.badge, { backgroundColor: badgeFill }]}
                testID={testId(GAME_ID, 'count-option', String(value), 'verdict')}
                importantForAccessibility="no-hide-descendants">
                <ThemedText type="label" style={{ color: badgeOn }} allowFontScaling={false}>
                  {glyph}
                </ThemedText>
              </View>
            ) : null}
            <ThemedText type="bodyLarge" style={[styles.number, { color: foreground }]}>
              {String(value)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.medium,
  },
  pressed: {
    opacity: 0.7,
  },
  dim: {
    opacity: 0.55,
  },
  badge: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.oneHalf,
    paddingVertical: Spacing.half,
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
});
