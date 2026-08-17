/**
 * TileGrid — responsive square grid hosting `Tile`s.
 *
 * The grid is always square (`gridSize` tiles, side = sqrt(gridSize)); cell
 * padding keeps the aspect-ratio tiles flush without overflowing the row.
 */
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Tile } from './tile';
import type { TileVisualState } from './tile';

export interface TileGridProps {
  gridSize: number;
  /** Semantic testID of the grid container. */
  testID: string;
  visualFor: (index: number) => TileVisualState;
  disabled?: boolean;
  onPressTile: (index: number) => void;
}

export function TileGrid({ gridSize, testID, visualFor, disabled = false, onPressTile }: TileGridProps) {
  const side = Math.round(Math.sqrt(gridSize));
  return (
    <View style={styles.grid} testID={testID} accessibilityLabel="Pattern board">
      {Array.from({ length: gridSize }, (_, index) => (
        <View key={index} style={[styles.cell, { width: `${100 / side}%` }]}>
          <Tile index={index} visual={visualFor(index)} disabled={disabled} onPress={() => onPressTile(index)} />
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
