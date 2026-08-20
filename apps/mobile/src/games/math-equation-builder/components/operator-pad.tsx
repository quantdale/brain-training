/**
 * OperatorPad — displays the allowed operators for the current puzzle.
 * Disabled when a number is expected or during pause/results.
 *
 * The pad and each key are `memo`ized; the screen keeps `onOperatorPress`
 * stable across the per-second budget ticks, so the pad does not re-render
 * on every timer tick.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { testId } from '@/sdk';

import { GAME_ID } from '../types';
import type { Operator } from '../types';

import { GameButton } from './button';

export interface OperatorPadProps {
  operators: readonly Operator[];
  disabled: boolean;
  /** Stable handler; value-based so each key avoids a per-render closure. */
  onOperatorPress: (operator: Operator) => void;
}

const OPERATOR_LABELS: Record<Operator, string> = {
  '+': '+',
  '-': '−',
  '×': '×',
  '÷': '÷',
};

export const OperatorPad = memo(function OperatorPad({
  operators,
  disabled,
  onOperatorPress,
}: OperatorPadProps) {
  return (
    <View style={styles.container} testID={testId(GAME_ID, 'operator-pad')}>
      <View style={styles.row}>
        {operators.map((op) => (
          <OperatorKey
            key={op}
            operator={op}
            disabled={disabled}
            onOperatorPress={onOperatorPress}
          />
        ))}
      </View>
    </View>
  );
});

export interface OperatorKeyProps {
  operator: Operator;
  disabled: boolean;
  onOperatorPress: (operator: Operator) => void;
}

export const OperatorKey = memo(function OperatorKey({
  operator,
  disabled,
  onOperatorPress,
}: OperatorKeyProps) {
  return (
    <GameButton
      testID={testId(GAME_ID, 'operator', operator)}
      label={OPERATOR_LABELS[operator]}
      variant="secondary"
      disabled={disabled}
      onPress={() => onOperatorPress?.(operator)}
    />
  );
});

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
});
