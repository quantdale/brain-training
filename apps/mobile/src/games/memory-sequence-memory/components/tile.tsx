/**
 * PadTile — one colored pad of the Simon-style Sequence Memory board.
 *
 * Visual states: `idle`, `revealed` (sequence flash), `correct` (a matched
 * step, or a revealed answer step), `error` (the wrong tap). Idle/revealed
 * keep the tile's own semantic-palette color (accent/success/warning/danger,
 * cycling by index) so the pad reads like a classic Simon game in both light
 * and dark themes; idle pads are dimmed and revealed pads fully lit.
 *
 * Verdicts (`correct`/`error`) are multi-channel per the shared feedback
 * language: the fill moves to the verdict family's soft token AND the
 * boundary switches to the verdict base at a heavier width AND a ✓/✕ badge
 * is pinned to the corner, so a wrong tap never differs from a correct step
 * by colour alone. The badge is decorative for assistive tech
 * (`no-hide-descendants`); the tile's accessible name carries the verdict in
 * words ("Correct: Pad N" / "Wrong pick: Pad N").
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

import { GAME_ID } from '../types';

export type PadTileVisualState = 'idle' | 'revealed' | 'correct' | 'error';

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
  /** Stable tap handler supplied by the pad (avoids per-render closures). */
  onPressTile?: (index: number) => void;
}

export const PadTile = memo(function PadTile({ index, visual, disabled = false, onPressTile }: PadTileProps) {
  const theme = useTheme();
  const isVerdict = visual === 'correct' || visual === 'error';
  const backgroundColor = isVerdict
    ? visual === 'correct'
      ? theme.successSoft
      : theme.dangerSoft
    : padColorFor(theme, index);
  const borderColor = isVerdict
    ? visual === 'correct'
      ? theme.success
      : theme.danger
    : theme.border;
  const borderWidth = isVerdict ? 3 : 1.5;
  const verdictGlyph = visual === 'correct' ? '✓' : visual === 'error' ? '✕' : null;
  const verdictFill = visual === 'correct' ? theme.success : visual === 'error' ? theme.danger : null;
  const verdictOn = visual === 'correct' ? theme.successOn : visual === 'error' ? theme.dangerOn : null;
  const accessibilityLabel =
    visual === 'correct'
      ? `Correct: Pad ${index + 1}`
      : visual === 'error'
        ? `Wrong pick: Pad ${index + 1}`
        : `Pad ${index + 1}`;

  return (
    <Pressable
      testID={testId(GAME_ID, 'tile', String(index))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPressTile ? () => onPressTile(index) : undefined}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor, borderColor, borderWidth },
        // Idle pads are dimmed so the flashing sequence stands out. Verdict
        // pads are never dimmed (the cue must stay legible); pressed feedback
        // only applies to non-verdict tiles.
        visual === 'idle' && styles.dim,
        pressed && !isVerdict && styles.dim,
      ]}>
      {verdictGlyph !== null && verdictFill !== null && verdictOn !== null ? (
        <View
          testID={testId(GAME_ID, 'tile-verdict', String(index))}
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
    // Explicit touch-target floor; the pad layout sizes tiles well above it
    // on every tier, so this only guards degenerate widths.
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
  },
  dim: {
    opacity: 0.4,
  },
  // Verdict badge: content-sized disc pinned to the tile corner. The fill +
  // glyph pair is the non-colour-alone verdict channel.
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
});
