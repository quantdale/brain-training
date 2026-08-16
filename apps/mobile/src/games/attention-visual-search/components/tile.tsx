/**
 * Tile — one grid cell of the Visual Search board.
 *
 * Visual states: `idle` (distractor), `target` (the odd tile — accent fill),
 * `selected` (target tapped correctly), `error` (wrong tile tapped). The
 * target tile is the only distinct cell: every other tile is an identical
 * distractor surface.
 */
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
  onPress?: () => void;
}

export function Tile({ index, visual, disabled = false, onPress }: TileProps) {
  const theme = useTheme();
  const backgroundColor =
    visual === 'target'
      ? theme.accent
      : visual === 'error'
        ? theme.danger
        : visual === 'selected'
          ? theme.accentSoft
          : theme.surface;
  const isTarget = visual === 'target';

  return (
    <Pressable
      testID={testId(GAME_ID, 'tile', String(index))}
      accessibilityRole="button"
      accessibilityLabel={isTarget ? `Tile ${index + 1}, the odd one` : `Tile ${index + 1}`}
      accessibilityState={{ disabled, selected: visual === 'selected' }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor, borderColor: theme.border },
        (pressed || visual === 'target') && styles.dim,
      ]}
    />
  );
}

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
