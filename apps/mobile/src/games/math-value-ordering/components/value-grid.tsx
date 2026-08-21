/**
 * ValueGrid — the playfield for the Value Order game.
 *
 * Renders the round's tiles in their seeded display order (never sorted).
 * The player taps tiles from smallest to largest comparison value: a correct
 * tap locks the tile with its rank badge, a wrong tap is reported upward and
 * the reducer resolves the round as a mistake.
 *
 * Accessibility: every tile exposes only what is already visible on screen
 * (its own display text) — the relative order of values is never announced,
 * so the accessibility tree cannot leak the solution. Locked tiles are
 * disabled and announce their rank.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { testId } from '@/sdk';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { ValueOrderingRound } from '../types';

/** 1-based rank of a tapped tile (order it was tapped in), or null if untapped. */
export function rankOf(tileId: string, tappedIds: readonly string[]): number | null {
  const index = tappedIds.indexOf(tileId);
  return index === -1 ? null : index + 1;
}

export interface ValueGridProps {
  readonly round: ValueOrderingRound;
  /** Ids of correctly tapped tiles, in ascending-value tap order. */
  readonly tappedIds: readonly string[];
  /** Disabled while paused / outside the ordering phase. */
  readonly disabled?: boolean;
  /** Tap handler receiving the tile id (reducer validates correctness). */
  readonly onTapTile: (tileId: string) => void;
  /** Grid columns (tiles per row); defaults to 3. */
  readonly columns?: number;
}

export function ValueGrid({
  round,
  tappedIds,
  disabled = false,
  onTapTile,
  columns = 3,
}: ValueGridProps) {
  const theme = useTheme();
  // Leave slack for the inter-tile gaps so wrapped rows never overflow. The
  // percentage template stays inline so TS contextually types it as
  // `${number}%` (DimensionValue).
  const tileColumns = Math.floor(100 / columns) - 2;

  return (
    <View style={styles.grid} testID={testId(GAME_ID, 'value-grid')}>
      {round.tiles.map((tile) => {
        const rank = rankOf(tile.id, tappedIds);
        const locked = rank !== null;
        return (
          <Pressable
            key={tile.id}
            testID={testId(GAME_ID, 'tile', String(tile.value))}
            accessibilityRole="button"
            accessibilityLabel={`Tile showing ${tile.display}`}
            accessibilityHint="Tap tiles from smallest to largest value."
            accessibilityState={{ disabled: disabled || locked }}
            disabled={disabled || locked}
            onPress={() => onTapTile(tile.id)}
            style={({ pressed }) => [
              styles.tile,
              { width: `${tileColumns}%`, borderColor: theme.border },
              {
                backgroundColor: locked
                  ? theme.accentSoft
                  : pressed
                    ? theme.backgroundSelected
                    : theme.surface,
                opacity: disabled && !locked ? 0.5 : 1,
              },
            ]}>
            <Text
              style={[styles.tileText, { color: theme.text }]}
              adjustsFontSizeToFit
              numberOfLines={1}>
              {tile.display}
            </Text>
            {locked ? (
              <View
                pointerEvents="none"
                style={[styles.rankBadge, { backgroundColor: theme.accent }]}
                testID={testId(GAME_ID, 'tile-rank', String(rank))}>
                <Text style={styles.rankText}>{rank}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  tile: {
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.one,
  },
  tileText: {
    fontSize: 22,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rankBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  rankText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
