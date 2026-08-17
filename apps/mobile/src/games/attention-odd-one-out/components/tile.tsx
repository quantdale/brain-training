/**
 * ItemTile — one grid cell of the Odd One Out board.
 *
 * Visual states: `idle`, `error` (the most recent wrong tap), `found` (the
 * odd item revealed after the round ended). The tile renders the board's
 * deviation spec: every non-odd item shows the majority glyph/color/rotation,
 * the odd item differs along exactly one dimension. The odd item is never
 * disclosed through the accessibility label while the round is live — the
 * reveal (`found`) only happens after the round ended.
 */
import { Pressable, StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { renderSpecFor } from '../generator';
import { GAME_ID } from '../types';
import type { DeviationSpec } from '../types';

export type TileVisualState = 'idle' | 'error' | 'found';

export interface ItemTileProps {
  /** 0-based tile index; also the stable part of the semantic testID. */
  index: number;
  deviation: DeviationSpec;
  /** True for the board's single odd item. */
  isOdd: boolean;
  visual: TileVisualState;
  /** Glyph font size (the grid scales it down on larger boards). */
  glyphSize: number;
  disabled?: boolean;
  onPress?: () => void;
}

export function ItemTile({
  index,
  deviation,
  isOdd,
  visual,
  glyphSize,
  disabled = false,
  onPress,
}: ItemTileProps) {
  const theme = useTheme();
  const spec = renderSpecFor(deviation, isOdd);
  const fill = spec.color ?? theme.text;
  const revealed = visual === 'found';
  const backgroundColor =
    visual === 'found' ? theme.accentSoft : theme.surface;
  const borderColor =
    visual === 'found' ? theme.success : visual === 'error' ? theme.danger : theme.border;
  const borderWidth = visual === 'found' || visual === 'error' ? 3 : 1.5;

  return (
    <Pressable
      testID={testId(GAME_ID, 'tile', String(index))}
      accessibilityRole="button"
      accessibilityLabel={
        revealed && isOdd
          ? `Item ${index + 1}, the odd one out`
          : `Item ${index + 1}`
      }
      accessibilityState={{ disabled, selected: visual === 'found' }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor, borderColor, borderWidth },
        (pressed || visual === 'found') && styles.dim,
      ]}>
      <ThemedText
        style={[
          styles.glyph,
          { color: fill, fontSize: glyphSize, lineHeight: glyphSize * 1.2 },
          spec.rotation !== 0 && { transform: [{ rotate: `${spec.rotation}deg` }] },
        ]}>
        {spec.glyph}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    aspectRatio: 1,
    borderRadius: Radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    textAlign: 'center',
  },
  dim: {
    opacity: 0.85,
  },
});
