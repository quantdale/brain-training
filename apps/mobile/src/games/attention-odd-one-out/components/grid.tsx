/**
 * ItemGrid — responsive square grid hosting the Odd One Out `ItemTile`s.
 *
 * The grid is always square (`gridSize` tiles, side = sqrt(gridSize)); cell
 * padding keeps the aspect-ratio tiles flush without overflowing the row.
 * Glyph size scales down on larger boards so all items stay visible.
 */
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { ItemTile } from './tile';
import type { TileVisualState } from './tile';
import type { OddOneOutBoard } from '../types';

export interface ItemGridProps {
  gridSize: number;
  /** Semantic testID of the grid container. */
  testID: string;
  /** Current round's board (defines which item is odd). */
  board: OddOneOutBoard;
  visualFor: (index: number) => TileVisualState;
  disabled?: boolean;
  onPressTile: (index: number) => void;
}

export function ItemGrid({
  gridSize,
  testID,
  board,
  visualFor,
  disabled = false,
  onPressTile,
}: ItemGridProps) {
  const side = Math.round(Math.sqrt(gridSize));
  const glyphSize = gridSize >= 16 ? 30 : 44;
  return (
    <View style={styles.grid} testID={testID} accessibilityLabel="Odd One Out board">
      {Array.from({ length: gridSize }, (_, index) => (
        <View key={index} style={[styles.cell, { width: `${100 / side}%` }]}>
          <ItemTile
            index={index}
            deviation={board.deviation}
            isOdd={index === board.oddIndex}
            visual={visualFor(index)}
            glyphSize={glyphSize}
            disabled={disabled}
            onPress={() => onPressTile(index)}
          />
        </View>
      ))}
    </View>
  );
}

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
