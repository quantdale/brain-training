/**
 * OperatorButton — one of the four `+ − × ÷` answer buttons.
 *
 * Neutral (outline) while the round is open; after a round resolves the
 * parent passes a highlight: `correct` fills the button with the accent color
 * and `wrong` with the danger color. Buttons are disabled once the round is
 * resolved.
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
  const filled = highlight !== null;
  const backgroundColor = filled
    ? highlight === 'wrong'
      ? theme.danger
      : theme.accent
    : 'transparent';
  const foregroundColor = filled ? '#FFFFFF' : theme.accent;
  const borderColor = filled ? backgroundColor : theme.border;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      // Neutral label — the operator symbol is a choice, not the secret answer.
      accessibilityLabel={`Operator ${OPERATOR_GLYPHS[operator]}`}
      accessibilityState={{ disabled, selected: highlight === 'correct' }}
      disabled={disabled}
      onPress={onPressOperator ? () => onPressOperator(operator) : undefined}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: pressed || disabled ? 0.6 : 1,
        },
      ]}>
      <ThemedText type="title" style={{ color: foregroundColor }}>
        {OPERATOR_GLYPHS[operator]}
      </ThemedText>
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
    borderRadius: Radii.medium,
    borderWidth: 2,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
