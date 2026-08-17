/**
 * OperatorPad — displays the allowed operators for the current puzzle.
 * Disabled when a number is expected or during pause/results.
 */
import { StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { testId } from '@/sdk';

import { GAME_ID } from '../types';
import type { Operator } from '../types';

import { GameButton } from './button';

export interface OperatorPadProps {
  operators: readonly Operator[];
  disabled: boolean;
  onOperatorPress: (operator: Operator) => void;
}

const OPERATOR_LABELS: Record<Operator, string> = {
  '+': '+',
  '-': '−',
  '×': '×',
  '÷': '÷',
};

export function OperatorPad({ operators, disabled, onOperatorPress }: OperatorPadProps) {
  return (
    <View style={styles.container} testID={testId(GAME_ID, 'operator-pad')}>
      <View style={styles.row}>
        {operators.map((op) => (
          <GameButton
            key={op}
            testID={testId(GAME_ID, 'operator', op)}
            label={OPERATOR_LABELS[op]}
            variant="secondary"
            disabled={disabled}
            onPress={() => onOperatorPress(op)}
          />
        ))}
      </View>
    </View>
  );
}

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
