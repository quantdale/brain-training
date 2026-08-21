/**
 * Board — responsive square grid hosting symbol `Cell`s.
 *
 * The grid is always square (`gridSize` cells, side = sqrt(gridSize)); cell
 * padding keeps the aspect-ratio cells flush without overflowing the row.
 * `board` maps each cell index to the symbol id it displays (or `EMPTY`).
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { EMPTY } from '../generator';
import { Cell } from './cell';
import type { CellVisualState } from './cell';

export interface BoardProps {
  gridSize: number;
  /** Symbol id per cell (-1 empty); drives each cell's glyph + label. */
  board: readonly number[];
  /** Semantic testID of the board container. */
  testID: string;
  visualFor: (index: number) => CellVisualState;
  disabled?: boolean;
  onPressCell: (index: number) => void;
}

export const Board = memo(function Board({
  gridSize,
  board,
  testID,
  visualFor,
  disabled = false,
  onPressCell,
}: BoardProps) {
  const side = Math.round(Math.sqrt(gridSize));
  return (
    <View
      style={styles.grid}
      testID={testID}
      accessibilityLabel="Symbol Tracker board"
    >
      {Array.from({ length: gridSize }, (_, index) => (
        <View key={index} style={[styles.cell, { width: `${100 / side}%` }]}>
          <Cell
            index={index}
            symbolId={board[index] ?? EMPTY}
            visual={visualFor(index)}
            disabled={disabled}
            onPressCell={onPressCell}
          />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },
  cell: {
    padding: Spacing.one,
  },
});
