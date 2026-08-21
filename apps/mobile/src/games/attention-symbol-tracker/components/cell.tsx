/**
 * Cell — one grid cell of the Symbol Tracker board.
 *
 * Visual states: `idle`, `target` (highlighted during observe), `selected`
 * (the player's own respond-phase tap), `correct` (was tracked, after
 * scoring), `error` (wrong symbol, after scoring). The glyph is rendered in
 * the symbol's own color so identity never leans on a single visual channel.
 *
 * Accessibility: the label names the symbol's identity ("red circle") — never
 * "this is a target". A cell is only marked `selected` via the a11y state when
 * it is the player's own respond-phase selection, so the tracked set can never
 * be read off the accessibility tree.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { testId } from '@/sdk';
import { Radii } from '@/constants/theme';
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
      ? theme.accent
      : visual === 'error'
        ? theme.danger
        : visual === 'correct'
          ? theme.success
          : visual === 'selected'
            ? theme.accentSoft
            : theme.surface;

  return (
    <Pressable
      testID={testId(GAME_ID, 'cell', String(index))}
      accessibilityRole={empty ? 'text' : 'button'}
      accessibilityLabel={empty ? 'Empty slot' : symbol.label}
      accessibilityState={{ disabled: disabled || empty, selected: visual === 'selected' }}
      disabled={disabled || empty}
      onPress={onPressCell ? () => onPressCell(index) : undefined}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor, borderColor: theme.border },
        (pressed || visual === 'target') && styles.dim,
      ]}
    >
      {empty ? null : (
        <Text style={[styles.glyph, { color: symbol.color }]} allowFontScaling={false}>
          {symbol.glyph}
        </Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  cell: {
    aspectRatio: 1,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
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
});
