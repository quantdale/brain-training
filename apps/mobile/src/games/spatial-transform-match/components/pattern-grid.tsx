/**
 * PatternGrid — responsive square grid rendering a filled/unfilled pattern.
 *
 * The grid is always square (`gridSize` cells, side = sqrt(gridSize)); filled
 * cells are highlighted with the theme accent color.
 *
 * Layout width is preserved across remounts by using percentage-based cell
 * sizing instead of onLayout-measured pixel widths (see packet warning about
 * the memory game's width-reset bug).
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';

export interface PatternGridProps {
  gridSize: number;
  /** Cell indices that are filled. */
  pattern: readonly number[];
  /** Semantic testID of the grid container. */
  testID: string;
  /** Optional accessibility label. */
  accessibilityLabel?: string;
}

export const PatternGrid = memo(function PatternGrid({
  gridSize,
  pattern,
  testID,
  accessibilityLabel = 'Pattern grid',
}: PatternGridProps) {
  const theme = useTheme();
  const side = Math.round(Math.sqrt(gridSize));
  const filledSet = new Set(pattern);

  return (
    <View
      style={styles.grid}
      testID={testID}
      accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: gridSize }, (_, index) => (
        <View key={index} style={[styles.cell, { width: `${100 / side}%` }]}>
          <View
            testID={testId(GAME_ID, 'cell', String(index))}
            style={[
              styles.tile,
              {
                backgroundColor: filledSet.has(index) ? theme.accent : theme.surface,
                borderColor: theme.border,
              },
            ]}
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
  tile: {
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1.5,
  },
});
