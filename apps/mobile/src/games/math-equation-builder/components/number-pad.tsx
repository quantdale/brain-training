/**
 * NumberPad — displays the available numbers for the current puzzle.
 * Used numbers are dimmed/disabled.
 *
 * The pad and each key are `memo`ized; the screen keeps `onNumberPress`
 * stable across the per-second budget ticks, so the keypad does not
 * re-render on every timer tick (only when the puzzle or usage changes).
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { testId } from '@/sdk';

import { GAME_ID } from '../types';

import { GameButton } from './button';

export interface NumberPadProps {
  numbers: readonly number[];
  usedIndices: readonly number[];
  disabled: boolean;
  /** Stable handler; index-based so each key avoids a per-render closure. */
  onNumberPress: (index: number) => void;
}

export const NumberPad = memo(function NumberPad({
  numbers,
  usedIndices,
  disabled,
  onNumberPress,
}: NumberPadProps) {
  return (
    <View style={styles.container} testID={testId(GAME_ID, 'number-pad')}>
      <View style={styles.row}>
        {numbers.map((num, index) => (
          <NumberKey
            key={`${index}-${num}`}
            index={index}
            num={num}
            isUsed={usedIndices.includes(index)}
            disabled={disabled}
            onNumberPress={onNumberPress}
          />
        ))}
      </View>
    </View>
  );
});

export interface NumberKeyProps {
  index: number;
  num: number;
  isUsed: boolean;
  disabled: boolean;
  onNumberPress: (index: number) => void;
}

export const NumberKey = memo(function NumberKey({
  index,
  num,
  isUsed,
  disabled,
  onNumberPress,
}: NumberKeyProps) {
  return (
    <GameButton
      testID={testId(GAME_ID, 'number', String(index))}
      label={String(num)}
      variant={isUsed ? 'secondary' : 'primary'}
      disabled={disabled || isUsed}
      onPress={() => onNumberPress?.(index)}
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
