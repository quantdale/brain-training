/**
 * NumberPad — displays the available numbers for the current puzzle.
 * Used numbers are dimmed/disabled.
 */
import { StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { testId } from '@/sdk';

import { GAME_ID } from '../types';

import { GameButton } from './button';

export interface NumberPadProps {
  numbers: readonly number[];
  usedIndices: readonly number[];
  disabled: boolean;
  onNumberPress: (index: number) => void;
}

export function NumberPad({ numbers, usedIndices, disabled, onNumberPress }: NumberPadProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testId(GAME_ID, 'number-pad')}>
      <View style={styles.row}>
        {numbers.map((num, index) => {
          const isUsed = usedIndices.includes(index);
          return (
            <GameButton
              key={`${index}-${num}`}
              testID={testId(GAME_ID, 'number', String(index))}
              label={String(num)}
              variant={isUsed ? 'secondary' : 'primary'}
              disabled={disabled || isUsed}
              onPress={() => onNumberPress(index)}
            />
          );
        })}
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
