/**
 * Cell — one grid cell of the Symbol Tracker board.
 *
 * Visual states: `idle`, `target` (highlighted during observe), `selected`
 * (the player's own respond-phase tap), `correct` (was tracked, after
 * scoring), `error` (wrong symbol, after scoring). The glyph is rendered in
 * the symbol's own color so identity never leans on a single visual channel.
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6): `correct`/`error` change the
 * fill AND the border weight AND add a ✓/✕ badge, so a wrong tap never reads
 * as correct. The badge is decorative for screen readers — the cell's
 * accessibility label carries the verdict ("Correct: …" / "Wrong pick: …").
 *
 * Accessibility: the label names the symbol's identity ("red circle") — never
 * "this is a target" — while the round is live. The verdict prefix only
 * appears after scoring, when the board already reveals the solution. A cell
 * is only marked `selected` via the a11y state when it is the player's own
 * respond-phase selection, so the tracked set can never be read off the
 * accessibility tree.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
import { Spacing } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { useTheme } from '@/hooks/use-theme';

import { EMPTY } from '../generator';
import { trackerSymbolById } from '../symbols';
import { GAME_ID } from '../types';

export type CellVisualState =
  | 'idle'
  | 'target'
  | 'selected'
  | 'correct'
  | 'error';

export interface CellProps {
  /** 0-based cell index; also the stable part of the semantic testID. */
  index: number;
  /** Symbol id occupying this cell, or `EMPTY` (-1). */
  symbolId: number;
  visual: CellVisualState;
  disabled?: boolean;
  /** Stable tap handler supplied by the board (avoids per-render closures). */
  onPressCell?: (index: number) => void;
}

export const Cell = memo(function Cell({
  index,
  symbolId,
  visual,
  disabled = false,
  onPressCell,
}: CellProps) {
  const theme = useTheme();
  const empty = symbolId === EMPTY;
  const symbol = trackerSymbolById(symbolId);
  const backgroundColor =
    visual === 'target'
      ? theme.attention
      : visual === 'error'
        ? theme.dangerSoft
        : visual === 'correct'
          ? theme.successSoft
          : visual === 'selected'
            ? theme.attentionSoft
            : theme.surface;
  const borderColor =
    visual === 'error'
      ? theme.danger
      : visual === 'correct'
        ? theme.success
        : theme.border;
  const borderWidth = visual === 'error' || visual === 'correct' ? 3 : 1.5;
  const accessibilityLabel = empty
    ? 'Empty slot'
    : visual === 'error'
      ? `Wrong pick: ${symbol.label}`
      : visual === 'correct'
        ? `Correct: ${symbol.label}`
        : symbol.label;

  return (
    <Pressable
      testID={testId(GAME_ID, 'cell', String(index))}
      accessibilityRole={empty ? 'text' : 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || empty, selected: visual === 'selected' }}
      disabled={disabled || empty}
      onPress={onPressCell ? () => onPressCell(index) : undefined}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor, borderColor, borderWidth },
        (pressed || visual === 'target') && styles.dim,
      ]}
    >
      {empty ? null : (
        <Text style={[styles.glyph, { color: symbol.color }]} allowFontScaling={false}>
          {symbol.glyph}
        </Text>
      )}
      {visual === 'error' ? (
        <View
          style={[styles.verdict, { backgroundColor: theme.danger }]}
          testID={testId(GAME_ID, 'cell-verdict', String(index))}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: theme.dangerOn }} allowFontScaling={false}>
            ✕
          </ThemedText>
        </View>
      ) : null}
      {visual === 'correct' ? (
        <View
          style={[styles.verdict, { backgroundColor: theme.success }]}
          testID={testId(GAME_ID, 'cell-verdict', String(index))}
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
  cell: {
    aspectRatio: 1,
    // Explicit touch-target floor; the grid layout sizes cells well above it
    // on every tier, so this only guards degenerate widths.
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    borderRadius: Radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.85,
  },
  glyph: {
    fontSize: 22,
    fontWeight: '700',
  },
  // Verdict badge: content-sized disc pinned to the cell corner. The fill +
  // glyph pair is the non-colour-alone verdict channel.
  verdict: {
    position: 'absolute',
    right: Spacing.one,
    bottom: Spacing.one,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.oneHalf,
    paddingVertical: Spacing.half,
  },
});
