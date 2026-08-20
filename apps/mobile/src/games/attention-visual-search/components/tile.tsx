/**
 * Tile — one grid cell of the Visual Search board.
 *
 * Visual states: `idle` (distractor), `target` (the odd tile — accent fill),
 * `selected` (target tapped correctly), `error` (wrong tile tapped). The
 * target tile is the only distinct cell: every other tile is an identical
 * distractor surface.
 */
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';

export type TileVisualState = 'idle' | 'target' | 'selected' | 'error';

export interface TileProps {
  /** 0-based tile index; also the stable part of the semantic testID. */
  index: number;
  visual: TileVisualState;
  disabled?: boolean;
  /** Stable tap handler supplied by the grid (avoids per-render closures). */
  onPressTile?: (index: number) => void;
}

export const Tile = memo(function Tile({ index, visual, disabled = false, onPressTile }: TileProps) {
  const theme = useTheme();
  const backgroundColor =
    visual === 'target'
      ? theme.accent
      : visual === 'error'
        ? theme.danger
        : visual === 'selected'
          ? theme.accentSoft
          : theme.surface;

  return (
    <Pressable
      testID={testId(GAME_ID, 'tile', String(index))}
      accessibilityRole="button"
      // Neutral label only — never disclose whether this tile is the target,
      // which would leak the answer to screen-reader users. Correctness is
      // conveyed via `accessibilityState` after a tap (selected / error).
      accessibilityLabel={`Tile ${index + 1}`}
      accessibilityState={{ disabled, selected: visual === 'selected' }}
      disabled={disabled}
      onPress={onPressTile ? () => onPressTile(index) : undefined}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor, borderColor: theme.border },
        (pressed || visual === 'target') && styles.dim,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  tile: {
    aspectRatio: 1,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
  },
  dim: {
    opacity: 0.85,
  },
});
