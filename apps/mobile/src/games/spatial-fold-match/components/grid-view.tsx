/**
 * GridView — responsive boolean grid renderer.
 *
 * Renders a `boolean[][]` (rows × cols) as fixed-size square cells. Filled
 * cells use the theme accent; empty cells use the surface color. No Skia — it
 * is plain `View`s so it renders reliably across RN targets.
 *
 * Accessibility: each cell is labeled only by its position and whether it is
 * "filled"/"empty". The label NEVER discloses correctness (it never says
 * "correct"), so a11y users cannot cheat the puzzle.
 *
 * Reduced motion: there is no animated fold; decorative cell transitions are
 * guarded behind `usePrefersReducedMotion` so reduced-motion users get a
 * static board.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePrefersReducedMotion } from '@/components/game-ui';

import { GAME_ID } from '../types';
import type { ReadonlyGrid } from '../generator';

export interface GridViewProps {
  /** The grid to render (rows × cols boolean matrix). */
  grid: ReadonlyGrid;
  /** Semantic testID of the grid container. */
  testID: string;
  /** Optional accessibility label for the whole grid. */
  accessibilityLabel?: string;
  /** Square cell edge length in px (min ~40). */
  cellSize?: number;
}

export const GridView = memo(function GridView({
  grid,
  testID,
  accessibilityLabel = 'Grid',
  cellSize = 44,
}: GridViewProps) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const radius = Math.min(8, Math.round(cellSize * 0.18));

  return (
    <View
      style={styles.grid}
      testID={testID}
      accessibilityLabel={accessibilityLabel}>
      {grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((filled, c) => (
            <View
              key={c}
              testID={testId(GAME_ID, 'cell', `${r}-${c}`)}
              accessibilityLabel={`Row ${r + 1} column ${c + 1} ${filled ? 'filled' : 'empty'}`}
              style={[
                styles.cell,
                {
                  width: cellSize,
                  height: cellSize,
                  borderRadius: radius,
                  backgroundColor: filled ? theme.accent : theme.surface,
                  borderColor: theme.border,
                },
                reducedMotion ? null : styles.cellTransition,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    alignSelf: 'center',
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  cell: {
    borderWidth: 1.5,
  },
  cellTransition: {
    // Decorative only; reduced-motion users get no transition.
  },
});
