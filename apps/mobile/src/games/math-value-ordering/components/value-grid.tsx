/**
 * ValueGrid — the playfield for the Value Order game.
 *
 * Renders the round's tiles in their seeded display order (never sorted).
 * The player taps tiles from smallest to largest comparison value: a correct
 * tap locks the tile with its rank badge, a wrong tap is reported upward and
 * the reducer resolves the round as a mistake.
 *
 * Resolved frame (PATTERNS-PLAY 6): the grid stays mounted read-only with
 * verdict states derived from the reducer's outcome — correct taps take the
 * success-soft fill with a success border plus a ✓ badge (the rank badge
 * stays, so the submitted order remains readable), the wrong pick takes the
 * danger pair plus a ✕ badge, and untouched tiles dim to read as locked.
 * Badges are decorative for screen readers; each tile's accessible name
 * carries the verdict ("Correct pick …" / "Wrong pick …").
 *
 * Accessibility: every live tile exposes only what is already visible on
 * screen (its own display text) — the relative order of values is never
 * announced, so the accessibility tree cannot leak the solution. Locked
 * tiles are disabled and announce their rank.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import { testId } from '@/sdk';
import { Spacing } from '@/constants/theme';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { RoundOutcome, ValueOrderingRound } from '../types';

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
  /**
   * Resolved outcome from the reducer. When set, tiles render read-only
   * verdict states (correct taps / wrong pick / dimmed rest). Null/omitted
   * while the round is open.
   */
  readonly outcome?: RoundOutcome | null;
  /** The wrong tile on a mistake round (feedback reveal); else null. */
  readonly mistakeTileId?: string | null;
}

export function ValueGrid({
  round,
  tappedIds,
  disabled = false,
  onTapTile,
  columns = 3,
  outcome = null,
  mistakeTileId = null,
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
        const tileTestID = testId(GAME_ID, 'tile', String(tile.value));
        // Resolved verdicts come from the reducer's outcome: correct taps
        // read correct, the mistake tile reads wrong, and untouched tiles dim
        // to read as locked. Live tiles keep the existing lock styling.
        const isMistake = outcome !== null && tile.id === mistakeTileId;
        const isCorrectPick = outcome !== null && locked && !isMistake;
        const verdictGlyph = isCorrectPick ? '✓' : isMistake ? '✕' : null;
        const verdictFill =
          isCorrectPick ? theme.success : isMistake ? theme.danger : null;
        const verdictOn =
          isCorrectPick ? theme.successOn : isMistake ? theme.dangerOn : null;
        const borderColor =
          isCorrectPick ? theme.success : isMistake ? theme.danger : theme.border;
        const backgroundColor =
          outcome !== null
            ? isCorrectPick
              ? theme.successSoft
              : isMistake
                ? theme.dangerSoft
                : theme.surface
            : locked
              ? theme.accentSoft
              : theme.surface;
        const accessibilityLabel =
          isCorrectPick
            ? `Correct pick: ${tile.display}, position ${rank} of ${round.tiles.length}`
            : isMistake
              ? `Wrong pick: ${tile.display}`
              : outcome !== null
                ? `Tile showing ${tile.display}, not placed`
                : `Tile showing ${tile.display}`;
        return (
          <Pressable
            key={tile.id}
            testID={tileTestID}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={outcome !== null ? undefined : 'Tap tiles from smallest to largest value.'}
            accessibilityState={{ disabled: disabled || locked || outcome !== null }}
            disabled={disabled || locked || outcome !== null}
            onPress={() => onTapTile(tile.id)}
            style={({ pressed }) => [
              styles.tile,
              {
                width: `${tileColumns}%`,
                borderColor,
                borderWidth: verdictGlyph !== null ? 2 : 1,
              },
              {
                backgroundColor:
                  outcome === null && !locked && pressed ? theme.backgroundSelected : backgroundColor,
                opacity: (disabled && !locked && outcome === null) || (outcome !== null && !locked && !isMistake) ? 0.5 : 1,
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
                style={[
                  styles.rankBadge,
                  { backgroundColor: isCorrectPick ? theme.success : theme.accent },
                ]}
                testID={testId(GAME_ID, 'tile-rank', String(rank))}>
                <Text style={styles.rankText}>{rank}</Text>
              </View>
            ) : null}
            {verdictGlyph !== null && verdictFill !== null && verdictOn !== null ? (
              <View
                pointerEvents="none"
                testID={`${tileTestID}.verdict`}
                style={[styles.verdictBadge, { backgroundColor: verdictFill }]}
                importantForAccessibility="no-hide-descendants">
                <ThemedText type="label" style={{ color: verdictOn }} allowFontScaling={false}>
                  {verdictGlyph}
                </ThemedText>
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
    // Campaign 065 touch-target guard: width is a percentage of the grid, so
    // declare the shared vertical floor for narrow viewports.
    minHeight: MIN_TOUCH_TARGET,
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
  // Verdict badge: opaque verdict-family fill with its `*On` glyph, pinned
  // to the opposite corner from the rank badge so the submitted order (rank)
  // and the verdict (✓/✕) stay readable together.
  verdictBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
