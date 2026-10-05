/**
 * Tile — one grid cell of the Visual Search board.
 *
 * Visual states: `idle` (distractor), `target` (the odd tile — accent fill),
 * `selected` (target tapped correctly), `error` (wrong tile tapped). The
 * target tile is the only distinct cell: every other tile is an identical
 * distractor surface.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
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
      ? theme.attention
      : visual === 'error'
        ? theme.danger
        : visual === 'selected'
          ? theme.attentionSoft
          : theme.surface;
  // Verdicts change fill AND icon/shape, never colour alone: a correctly
  // tapped target keeps its fill plus a ✓ badge; a wrong tap keeps its
  // danger fill plus a ✕ badge. Badge fills are opaque verdict-family slots
  // with their paired glyph colour, so the icon reads on any tile behind it.
  const verdict =
    visual === 'selected'
      ? { glyph: '✓', backgroundColor: theme.success, color: theme.successOn }
      : visual === 'error'
        ? { glyph: '✕', backgroundColor: theme.dangerOn, color: theme.danger }
        : null;

  return (
    <Pressable
      testID={testId(GAME_ID, 'tile', String(index))}
      accessibilityRole="button"
      // Neutral label only — never disclose whether this tile is the target,
      // which would leak the answer to screen-reader users. Correctness is
      // conveyed via `accessibilityState` after a tap (selected) and via the
      // label once a tap is known wrong.
      accessibilityLabel={visual === 'error' ? `Tile ${index + 1}, incorrect` : `Tile ${index + 1}`}
      accessibilityState={{ disabled, selected: visual === 'selected' }}
      disabled={disabled}
      onPress={onPressTile ? () => onPressTile(index) : undefined}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor, borderColor: theme.border },
        (pressed || visual === 'target') && styles.dim,
      ]}>
      {verdict ? (
        <View
          style={[styles.verdict, { backgroundColor: verdict.backgroundColor }]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: verdict.color }} allowFontScaling={false}>
            {verdict.glyph}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tile: {
    aspectRatio: 1,
    // Explicit touch-target floor (mirrors memory-grid-recall cells); the
    // grid layout sizes tiles well above it on every tier, so this only
    // guards degenerate widths and future grid growth (058).
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.85,
  },
  // Verdict badge: content-sized disc centered on the tile with token
  // geometry. The fill + glyph pair is the non-colour-alone verdict channel.
  verdict: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.oneHalf,
    paddingVertical: Spacing.half,
  },
});
