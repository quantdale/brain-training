/**
 * Tile — one grid cell of the Memory board.
 *
 * Visual states: `idle`, `revealed` (sequence flash), `selected` (correctly
 * tapped), `error` (wrong tap). Tiles are plain surfaces: the sequence is
 * positional memory, so no per-tile glyphs are rendered.
 */
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';

export type TileVisualState = 'idle' | 'revealed' | 'selected' | 'error';

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
    visual === 'revealed'
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
      accessibilityLabel={`Tile ${index + 1}`}
      accessibilityState={{ disabled, selected: visual === 'selected' }}
      disabled={disabled}
      onPress={onPressTile ? () => onPressTile(index) : undefined}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor, borderColor: theme.border },
        (pressed || visual === 'revealed') && styles.dim,
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
