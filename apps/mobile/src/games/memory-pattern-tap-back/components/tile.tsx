/**
 * Tile — one grid cell of the Pattern Tap Back board.
 *
 * Visual states: `idle`, `observed` (sequence flash), `selected` (correctly
 * tapped while the tap-confirm is shown), `correct` (a reached sequence
 * position in the resolved round), `error` (the wrong tap, after the round
 * resolved).
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6, copying the memory-grid-recall
 * cell): `correct`/`error` change the fill AND the border weight AND add a
 * ✓/✕ badge, so a wrong tap never reads as correct. The badge is decorative
 * for screen readers — the tile's accessibility label carries the verdict
 * ("Correct: Tile N" / "Wrong pick: Tile N").
 *
 * Accessibility: labels are neutral ("Tile N") while the round is live. The
 * `correct`/`error` states are only ever produced for the post-resolution
 * round-result board, so the verdict wording (and the solution itself) can
 * never be read off the accessibility tree during recall/observe.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
import { MinTouchTarget, Spacing } from '@/theme/tokens';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';

export type TileVisualState = 'idle' | 'observed' | 'selected' | 'correct' | 'error';

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
    visual === 'observed'
      ? theme.accent
      : visual === 'error'
        ? theme.dangerSoft
        : visual === 'correct'
          ? theme.successSoft
          : visual === 'selected'
            ? theme.accentSoft
            : theme.surface;
  const borderColor =
    visual === 'error'
      ? theme.danger
      : visual === 'correct'
        ? theme.success
        : theme.border;
  const borderWidth = visual === 'error' || visual === 'correct' ? 3 : 1.5;
  const verdictGlyph = visual === 'correct' ? '✓' : visual === 'error' ? '✕' : null;
  const verdictFill = visual === 'correct' ? theme.success : visual === 'error' ? theme.danger : null;
  const verdictOn =
    visual === 'correct' ? theme.successOn : visual === 'error' ? theme.dangerOn : null;
  const accessibilityLabel =
    visual === 'correct'
      ? `Correct: Tile ${index + 1}`
      : visual === 'error'
        ? `Wrong pick: Tile ${index + 1}`
        : `Tile ${index + 1}`;

  return (
    <Pressable
      testID={testId(GAME_ID, 'tile', String(index))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: visual === 'selected' }}
      disabled={disabled}
      onPress={onPressTile ? () => onPressTile(index) : undefined}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor, borderColor, borderWidth },
        (pressed || visual === 'observed') && styles.dim,
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
    // Explicit touch-target floor; the grid layout sizes tiles well above it
    // on every tier, so this only guards degenerate widths.
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
  },
  dim: {
    opacity: 0.85,
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
