/**
 * Tile — one grid cell of the Memory board.
 *
 * Visual states: `idle`, `revealed` (sequence flash), `selected` (correctly
 * tapped), `error` (wrong tap). Verdicts are multi-channel per the shared
 * feedback language: fill plus a `✓`/`✕` badge (opaque verdict-family fill
 * with its `*On` glyph) and a matching accessible label, so correctly tapped
 * tiles never differ from the wrong pick by colour alone.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

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
  const tileTestID = testId(GAME_ID, 'tile', String(index));
  const backgroundColor =
    visual === 'revealed'
      ? theme.accent
      : visual === 'error'
        ? theme.danger
        : visual === 'selected'
          ? theme.accentSoft
          : theme.surface;
  const verdictGlyph = visual === 'selected' ? '✓' : visual === 'error' ? '✕' : null;
  const verdictFill = visual === 'selected' ? theme.success : visual === 'error' ? theme.danger : null;
  const verdictOn =
    visual === 'selected' ? theme.successOn : visual === 'error' ? theme.dangerOn : null;
  const accessibilityLabel =
    visual === 'selected'
      ? `Correct: Tile ${index + 1}`
      : visual === 'error'
        ? `Wrong pick: Tile ${index + 1}`
        : `Tile ${index + 1}`;

  return (
    <Pressable
      testID={tileTestID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: visual === 'selected' }}
      disabled={disabled}
      onPress={onPressTile ? () => onPressTile(index) : undefined}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor, borderColor: theme.border },
        (pressed || visual === 'revealed') && styles.dim,
      ]}>
      {verdictGlyph !== null && verdictFill !== null && verdictOn !== null ? (
        <View
          testID={`${tileTestID}.verdict`}
          style={[styles.verdict, { backgroundColor: verdictFill }]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: verdictOn }} allowFontScaling={false}>
            {verdictGlyph}
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
    borderWidth: 1.5,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
  },
  verdict: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.85,
  },
});
