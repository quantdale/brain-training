/**
 * BlockShape — renders a Mental Rotation shape as a set of colored blocks.
 *
 * Rendering is plain RN Views (no extra dependency): the block set is laid
 * out into a square canvas by computing its bounding box, scaling the cell
 * size to fit, and centering the result. Blocks are absolutely positioned so
 * shapes can be sparse without grid rows.
 *
 * Colors resolve from the theme palette at render time; generation only
 * records `colorIndex` (see `BLOCK_COLOR_COUNT`), so light/dark mode changes
 * never affect puzzle determinism.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Radii, Spacing, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { BLOCK_COLOR_COUNT, GAME_ID } from '../types';
import type { Block } from '../types';

/** Palette slots for block colors; length must equal `BLOCK_COLOR_COUNT`. */
export const BLOCK_PALETTE: readonly ThemeColor[] = ['accent', 'success', 'warning', 'danger'];

/** Default canvas size in px (shapes scale to fit). */
export const SHAPE_CANVAS = 200;

/** Max block cell size in px (shapes with few blocks don't become huge tiles). */
const MAX_CELL = 44;

/** Canvas padding in px. */
const PAD = 8;

export interface BlockShapeProps {
  blocks: readonly Block[];
  /** 'target' | 'candidate' — stable part of the semantic testIDs. */
  kind: 'target' | 'candidate';
  /** Optional canvas size override (tests / tutorial). */
  size?: number;
}

export function BlockShape({ blocks, kind, size = SHAPE_CANVAS }: BlockShapeProps) {
  const theme = useTheme();

  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const b of blocks) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x);
    maxY = Math.max(maxY, b.y);
  }
  const spanX = maxX - minX + 1;
  const spanY = maxY - minY + 1;
  const cell = Math.min(MAX_CELL, Math.floor((size - 2 * PAD) / Math.max(spanX, spanY)));
  const offsetX = (size - spanX * cell) / 2;
  const offsetY = (size - spanY * cell) / 2;

  return (
    <View
      style={[styles.canvas, { width: size, height: size, borderColor: theme.border }]}
      testID={testId(GAME_ID, kind, 'shape')}
      accessibilityLabel={`${kind === 'target' ? 'Target' : 'Candidate'} shape`}>
      {blocks.map((block, index) => (
        <View
          key={index}
          testID={testId(GAME_ID, kind, 'block', String(index))}
          style={[
            styles.block,
            {
              left: offsetX + (block.x - minX) * cell,
              top: offsetY + (block.y - minY) * cell,
              width: cell - Spacing.one,
              height: cell - Spacing.one,
              backgroundColor: theme[BLOCK_PALETTE[block.colorIndex]],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    borderWidth: 1.5,
    borderRadius: Radii.medium,
    backgroundColor: 'transparent',
  },
  block: {
    position: 'absolute',
    borderRadius: Radii.small,
  },
});
