/**
 * Grid — renders the Rule Grid board as a static N×N grid.
 *
 * Rows are explicit: available width must never change Latin-square geometry.
 * Cells are static; answering happens through `SymbolOptions`. The asked
 * blank has its own glyph, stroke and accessible name among the hidden cells.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { testId } from '@/sdk';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { effectiveFontScale } from '@/components/a11y/font-scale';
import { MIN_TOUCH_TARGET } from '@/components/a11y/touch-target';

import { GAME_ID } from '../types';

export interface GridProps {
  readonly size: number;
  readonly square: readonly (readonly number[])[];
  readonly blankIndex: number;
  /** All hidden cells; only the primary asked cell shows '?'. */
  readonly blanks?: readonly number[];
  /** Map a symbol value (0-based) to the player-facing label. */
  readonly renderSymbol: (value: number) => string;
  /** Stable testID for cell `i` (flat index). */
  readonly testIdCell: (i: number) => string;
  readonly disabled?: boolean;
  /** Tutorial-only answer reveal; omitted during live play. */
  readonly targetValue?: number;
}

export function Grid({ size, square, blankIndex, blanks, renderSymbol, testIdCell, targetValue }: GridProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const scale = effectiveFontScale(fontScale);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const gap = Spacing.one;
  const preferredCellSize = 56 * scale;
  const minimumCellSize = Math.max(MIN_TOUCH_TARGET, Typography.bodyLarge.lineHeight * scale + Spacing.three);
  const fittedSize = availableWidth === null ? preferredCellSize : (availableWidth - gap * (size - 1)) / size;
  const cellSize = Math.max(minimumCellSize, Math.min(preferredCellSize, fittedSize));
  const boardWidth = size * cellSize + (size - 1) * gap;
  const scrollable = availableWidth !== null && boardWidth > availableWidth;
  const blankSet = new Set([blankIndex, ...(blanks ?? [])]);

  return (
    <View
      style={styles.viewport}
      testID={testId(GAME_ID, 'grid-viewport')}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (Number.isFinite(width) && width > 0) setAvailableWidth(width);
      }}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        scrollEnabled={scrollable}
        showsHorizontalScrollIndicator={scrollable}
        contentContainerStyle={styles.scrollContent}
        testID={testId(GAME_ID, 'grid-scroll')}>
        <View style={[styles.grid, { width: boardWidth, gap }]} testID={testId(GAME_ID, 'grid')}>
          {Array.from({ length: size }, (_, row) => (
            <View key={row} style={[styles.row, { gap }]} testID={testId(GAME_ID, 'grid-row', String(row))}>
              {Array.from({ length: size }, (_, column) => {
                const index = row * size + column;
                const asked = index === blankIndex;
                const hidden = blankSet.has(index);
                const symbol = asked && targetValue !== undefined
                  ? renderSymbol(targetValue)
                  : hidden ? (asked ? '?' : '·') : renderSymbol(square[row][column]);
                const label = asked
                  ? targetValue === undefined ? 'Asked cell, missing symbol' : `Asked cell, answer ${symbol}`
                  : hidden ? 'Hidden cell' : `Symbol ${symbol}`;
                return (
                  <View
                    key={index}
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={`Row ${row + 1}, column ${column + 1}. ${label}.`}
                    style={[
                      styles.cell,
                      {
                        width: cellSize,
                        height: cellSize,
                        borderWidth: asked ? 3 : 1,
                        borderStyle: hidden && !asked ? 'dashed' : 'solid',
                        borderColor: asked ? theme.text : theme.borderStrong,
                        backgroundColor: theme.surface,
                      },
                    ]}
                    testID={testIdCell(index)}>
                    <ThemedText type="bodyLarge" themeColor="text">{symbol}</ThemedText>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      {scrollable ? (
        <ThemedText type="caption" themeColor="textSecondary">Swipe sideways to view every column.</ThemedText>
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  viewport: {
    width: '100%',
    gap: Spacing.one,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cell: {
    borderRadius: Radii.medium,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
