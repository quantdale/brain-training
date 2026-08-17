/**
 * PadTile — one colored pad of the Simon-style Sequence Memory board.
 *
 * Visual states: `idle`, `revealed` (sequence flash), `selected` (correctly
 * tapped), `error` (wrong tap). Each tile has a stable color from the shared
 * semantic palette (accent/success/warning/danger, cycling by index), so the
 * pad reads like a classic Simon game in both light and dark themes. Idle
 * tiles render their color dimmed; revealed/selected tiles are fully lit.
 */
import { Pressable, StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import type { ThemeColor } from '@/constants/theme';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';

export type PadTileVisualState = 'idle' | 'revealed' | 'selected' | 'error';

/** Per-tile color rotation over the shared semantic palette (no magic colors). */
const PAD_COLOR_KEYS: readonly ThemeColor[] = ['accent', 'success', 'warning', 'danger'];

/** The palette color assigned to a tile index (stable, theme-aware). */
export function padColorFor(theme: ReturnType<typeof useTheme>, index: number): string {
  return theme[PAD_COLOR_KEYS[index % PAD_COLOR_KEYS.length]];
}

export interface PadTileProps {
  /** 0-based tile index; also the stable part of the semantic testID. */
  index: number;
  visual: PadTileVisualState;
  disabled?: boolean;
  onPress?: () => void;
}

export function PadTile({ index, visual, disabled = false, onPress }: PadTileProps) {
  const theme = useTheme();
  const color = padColorFor(theme, index);
  const lit = visual === 'revealed' || visual === 'selected';
  const backgroundColor = visual === 'error' ? theme.danger : color;

  return (
    <Pressable
      testID={testId(GAME_ID, 'tile', String(index))}
      accessibilityRole="button"
      accessibilityLabel={`Pad ${index + 1}`}
      accessibilityState={{ disabled, selected: visual === 'selected' }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor, borderColor: theme.border },
        // Idle pads are dimmed so the flashing sequence stands out; pressed
        // pads dim too (immediate visual feedback on tap).
        (!lit || pressed) && styles.dim,
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
    opacity: 0.4,
  },
});
