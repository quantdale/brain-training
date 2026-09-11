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
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
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
  /** Stable tap handler supplied by the grid (avoids per-render closures). */
  onPressTile?: (index: number) => void;
}

export const ItemTile = memo(function ItemTile({
  index,
  deviation,
  isOdd,
  visual,
  glyphSize,
  disabled = false,
  onPressTile,
}: ItemTileProps) {
  const theme = useTheme();
  const spec = renderSpecFor(deviation, isOdd);
  const fill = spec.color ?? theme.text;
  const revealed = visual === 'found';
  // Verdicts change fill AND icon/shape, never colour alone: a wrong tap gets
  // a danger-soft fill plus a ✕ badge; the revealed odd item keeps its
  // accent-soft fill plus a ✓ badge. Both badges are opaque verdict-family
  // fills with their `*On` glyph, so the icon reads on any board behind it.
  const backgroundColor =
    visual === 'found' ? theme.accentSoft : visual === 'error' ? theme.dangerSoft : theme.surface;
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
          : visual === 'error'
            ? `Item ${index + 1}, incorrect`
            : `Item ${index + 1}`
      }
      accessibilityState={{ disabled, selected: visual === 'found' }}
      disabled={disabled}
      onPress={onPressTile ? () => onPressTile(index) : undefined}
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
      {visual === 'error' ? (
        <View
          style={[styles.verdict, { backgroundColor: theme.danger }]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: theme.dangerOn }} allowFontScaling={false}>
            ✕
          </ThemedText>
        </View>
      ) : null}
      {revealed ? (
        <View
          style={[styles.verdict, { backgroundColor: theme.success }]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: theme.successOn }} allowFontScaling={false}>
            ✓
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
});

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
  // Verdict badge: content-sized disc pinned to the tile corner with token
  // offsets. The fill + glyph pair is the non-colour-alone verdict channel.
  verdict: {
    position: 'absolute',
    right: Spacing.one,
    bottom: Spacing.one,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.oneHalf,
    paddingVertical: Spacing.half,
  },
});
