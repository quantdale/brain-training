/**
 * Grid — renders the Target Count symbol grid (campaign 006R task 10.3).
 *
 * A flex-wrap layout of glyph cells. Selection is not required for this game
 * (the answer is a number), but `onCellPress` is kept optional so the grid can
 * be reused by future interactive variants or tests.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { GAME_ID } from '../types';

export interface GridProps {
  /** Glyph at each cell index; length determines the number of cells. */
  readonly cells: readonly string[];
  /** Compose a cell testID from its index (the screen passes `cell.<i>`). */
  readonly testIdCell: (index: number) => string;
  /** Optional press handler (index-based). */
  readonly onCellPress?: (index: number) => void;
  /** Disables interaction + dims the cells. */
  readonly disabled?: boolean;
}

export function Grid({ cells, testIdCell, onCellPress, disabled }: GridProps) {
  return (
    <View style={styles.grid}>
      {cells.map((glyph, i) => (
        <Pressable
          key={i}
          testID={testIdCell(i)}
          disabled={disabled}
          onPress={onCellPress ? () => onCellPress(i) : undefined}
          accessibilityRole="image"
          style={({ pressed }) => [styles.cell, pressed && !disabled ? styles.cellPressed : null]}>
          <ThemedText type="title" testID={testId(GAME_ID, 'glyph', String(i))}>
            {glyph}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  cell: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0000001a',
  },
  cellPressed: {
    opacity: 0.7,
  },
});
