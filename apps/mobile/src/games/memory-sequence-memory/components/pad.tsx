/**
 * SequencePad — responsive square pad hosting `PadTile`s.
 *
 * The pad is always square (`tileCount` tiles, side = sqrt(tileCount): 2×2
 * or 3×3); cell padding keeps the aspect-ratio tiles flush without
 * overflowing the row.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { PadTile } from './tile';
import type { PadTileVisualState } from './tile';

export interface SequencePadProps {
  tileCount: number;
  /** Semantic testID of the pad container. */
  testID: string;
  visualFor: (index: number) => PadTileVisualState;
  disabled?: boolean;
  onPressTile: (index: number) => void;
}

export const SequencePad = memo(function SequencePad({
  tileCount,
  testID,
  visualFor,
  disabled = false,
  onPressTile,
}: SequencePadProps) {
  const side = Math.round(Math.sqrt(tileCount));
  return (
    <View style={styles.pad} testID={testID} accessibilityLabel="Sequence Memory pad">
      {Array.from({ length: tileCount }, (_, index) => (
        <View key={index} style={[styles.cell, { width: `${100 / side}%` }]}>
          <PadTile
            index={index}
            visual={visualFor(index)}
            disabled={disabled}
            onPressTile={onPressTile}
          />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },
  cell: {
    padding: Spacing.one,
  },
});
