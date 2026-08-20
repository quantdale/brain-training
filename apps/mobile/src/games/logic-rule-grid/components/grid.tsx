/**
 * Grid — renders the Rule Grid board as a static N×N grid.
 *
 * The blank cell (at `blankIndex`) is shown as a placeholder and is not
 * pressable; answering happens through `SymbolOptions`. Each cell carries a
 * stable `testIdCell(i)` for autonomous QA.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

import { GAME_ID } from '../types';

export interface GridProps {
  readonly size: number;
  readonly square: readonly (readonly number[])[];
  readonly blankIndex: number;
  /** Map a symbol value (0-based) to the player-facing label. */
  readonly renderSymbol: (value: number) => string;
  /** Stable testID for cell `i` (flat index). */
  readonly testIdCell: (i: number) => string;
  readonly disabled?: boolean;
}

export function Grid({ size, square, blankIndex, renderSymbol, testIdCell }: GridProps) {
  const theme = useTheme();
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const i = r * size + c;
      const isBlank = i === blankIndex;
      cells.push(
        <View
          key={i}
          style={[styles.cell, { borderColor: theme.border, backgroundColor: theme.surface }]}
          testID={testIdCell(i)}>
          <ThemedText type="bodyLarge" themeColor="text">
            {isBlank ? '?' : renderSymbol(square[r][c])}
          </ThemedText>
        </View>,
      );
    }
  }

  return <View style={styles.grid} testID={testId(GAME_ID, 'grid')}>{cells}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  cell: {
    width: 56,
    height: 56,
    borderRadius: Radii.medium,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
