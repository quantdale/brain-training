/**
 * OperatorButton — one of the four `+ − × ÷` answer buttons.
 *
 * Neutral (outline) while the round is open; after a round resolves the
 * parent passes a highlight derived from the reducer's resolved outcome:
 * `correct` takes the success-soft fill with a success border plus a ✓ badge,
 * `wrong` the danger pair plus a ✕ badge — fill AND boundary AND glyph, never
 * colour alone (PATTERNS-PLAY 6). Badges are decorative for screen readers;
 * the button's accessibility label carries the verdict ("Correct: …" /
 * "Wrong pick: …"). The correct operator stays vivid behind the result so a
 * wrong pick is always reviewable next to it; untouched options dim to read
 * as locked.
 *
 * The button is `memo`ized and takes a stable `onPressOperator` (value-based)
 * so the round-resolution highlight flips without re-creating closures. The
 * row container is also `memo`ized so it skips re-renders when unrelated
 * state changes.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { testId } from '@/sdk';

import { OPERATOR_GLYPHS, GAME_ID } from '../types';
import type { Operator } from '../types';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

export interface OperatorButtonProps {
  operator: Operator;
  testID: string;
  /** Stable tap handler supplied by the row (avoids per-render closures). */
  onPressOperator?: (operator: Operator) => void;
  disabled?: boolean;
  /** Round-resolution highlight; null while the round is open. */
  highlight?: 'correct' | 'wrong' | null;
}

export const OperatorButton = memo(function OperatorButton({
  operator,
  testID,
  onPressOperator,
  disabled = false,
  highlight = null,
}: OperatorButtonProps) {
  const theme = useTheme();
  const backgroundColor =
    highlight === 'correct'
      ? theme.successSoft
      : highlight === 'wrong'
        ? theme.dangerSoft
        : 'transparent';
  const borderColor =
    highlight === 'correct' ? theme.success : highlight === 'wrong' ? theme.danger : theme.border;
  const foregroundColor =
    highlight === 'correct' ? theme.success : highlight === 'wrong' ? theme.danger : theme.math;
  const verdictGlyph = highlight === 'correct' ? '✓' : highlight === 'wrong' ? '✕' : null;
  const verdictFill =
    highlight === 'correct' ? theme.success : highlight === 'wrong' ? theme.danger : null;
  const verdictOn =
    highlight === 'correct' ? theme.successOn : highlight === 'wrong' ? theme.dangerOn : null;
  const accessibilityLabel =
    highlight === 'correct'
      ? `Correct: operator ${OPERATOR_GLYPHS[operator]}`
      : highlight === 'wrong'
        ? `Wrong pick: operator ${OPERATOR_GLYPHS[operator]}`
        : `Operator ${OPERATOR_GLYPHS[operator]}`;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: highlight === 'correct' }}
      disabled={disabled}
      onPress={onPressOperator ? () => onPressOperator(operator) : undefined}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          borderWidth: highlight !== null ? 3 : 2,
          // The correct answer stays vivid for review; a wrong pick and the
          // untouched options dim to read as locked.
          opacity: pressed || (disabled && highlight !== 'correct') ? 0.6 : 1,
        },
      ]}>
      <ThemedText type="title" style={{ color: foregroundColor }} allowFontScaling={false}>
        {OPERATOR_GLYPHS[operator]}
      </ThemedText>
      {verdictGlyph !== null && verdictFill !== null && verdictOn !== null ? (
        <View
          testID={`${testID}.verdict`}
          style={[styles.verdict, { backgroundColor: verdictFill }]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: verdictOn }} allowFontScaling={false}>
            {verdictGlyph}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
});

export interface OperatorRowProps {
  operators: readonly Operator[];
  disabled?: boolean;
  /** Stable visual resolver (depends only on round-resolution state). */
  highlightFor: (operator: Operator) => 'correct' | 'wrong' | null;
  /** Stable tap handler; passed through so memoized buttons skip re-renders. */
  onPressOperator: (operator: Operator) => void;
}

export const OperatorRow = memo(function OperatorRow({
  operators,
  disabled = false,
  highlightFor,
  onPressOperator,
}: OperatorRowProps) {
  return (
    <View style={styles.row} testID={testId(GAME_ID, 'operators')}>
      {operators.map((operator) => (
        <OperatorButton
          key={operator}
          operator={operator}
          testID={testId(GAME_ID, 'op', operator)}
          disabled={disabled}
          highlight={highlightFor(operator)}
          onPressOperator={onPressOperator}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minWidth: 64,
    // Explicit touch-target floor; the row layout sizes buttons above it on
    // every tier, and real size (not hitSlop) is used so adjacent buttons
    // never overlap.
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: Radii.medium,
    borderWidth: 2,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Verdict badge: opaque verdict-family fill with its `*On` glyph, so the
  // icon reads on the soft button fill. The fill + glyph pair is the
  // non-colour-alone verdict channel.
  verdict: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
