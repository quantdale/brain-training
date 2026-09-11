/**
 * OptionGrid — a selectable option displaying a folded result grid.
 *
 * Used in the choice phase to present the player with candidate folded
 * versions of the source grid.
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6, spatial-transform-match
 * canary): the correct option gets a success-soft fill plus a ✓ badge, the
 * wrong pick a danger-soft fill plus a ✕ badge, and the verdict border
 * thickens — so a wrong tap never reads as correct through any single
 * channel. Badges are decorative for screen readers; the button's
 * accessibility label carries the verdict in words. Both states stay visible
 * together on the round result, and the choice prompt stays mounted above
 * them (see screen.tsx).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { ReadonlyGrid } from '../generator';
import { GridView } from './grid-view';

export interface OptionGridProps {
  /** 0-based option index; used for the testID. */
  index: number;
  /** The grid to display. */
  grid: ReadonlyGrid;
  /** Whether this option is currently selected. */
  selected: boolean;
  /** Whether this option is the correct answer (for reveal in roundResult). */
  correct: boolean;
  /** Whether the option is disabled (e.g. after selection). */
  disabled?: boolean;
  /** Stable tap handler supplied by the parent; receives this option's index. */
  onPressOption?: (index: number) => void;
}

export const OptionGrid = memo(function OptionGrid({
  index,
  grid,
  selected,
  correct,
  disabled = false,
  onPressOption,
}: OptionGridProps) {
  const theme = useTheme();

  // Verdicts change fill AND border AND glyph, never colour alone. Badges are
  // opaque verdict-family fills with their `*On` glyph, so the icon reads on
  // any board behind it.
  const isWrongPick = selected && !correct;
  const verdictGlyph = correct ? '✓' : isWrongPick ? '✕' : null;
  const backgroundColor = correct
    ? theme.successSoft
    : isWrongPick
      ? theme.dangerSoft
      : undefined;
  const borderColor = correct
    ? theme.success
    : isWrongPick
      ? theme.danger
      : theme.border;
  const accessibilityLabel = correct
    ? `Option ${index + 1}, correct`
    : isWrongPick
      ? `Option ${index + 1}, wrong pick`
      : `Option ${index + 1}`;

  return (
    <Pressable
      testID={testId(GAME_ID, 'option', String(index))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPressOption ? () => onPressOption(index) : undefined}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor,
          borderColor,
          borderWidth: verdictGlyph !== null ? 3 : 2,
          opacity: pressed || disabled ? 0.8 : 1,
        },
      ]}>
      {/* The result grid is purely decorative: the outer button already
       * announces "Option N". A labeled a11y container nested inside an
       * accessibility button collapses the Android a11y tree on Fabric
       * (campaign 011 device finding: the session PauseOverlay subtree
       * vanished from uiautomator/TalkBack entirely), so hide the whole
       * inner grid from accessibility. */}
      <View importantForAccessibility="no-hide-descendants">
        <GridView
          grid={grid}
          testID={testId(GAME_ID, 'option-grid', String(index))}
        />
      </View>
      {verdictGlyph !== null ? (
        <View
          testID={testId(GAME_ID, 'option-verdict', String(index))}
          style={[
            styles.verdict,
            { backgroundColor: correct ? theme.success : theme.danger },
          ]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText
            type="label"
            style={{ color: correct ? theme.successOn : theme.dangerOn }}
            allowFontScaling={false}>
            {verdictGlyph}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: Radii.medium,
    padding: Spacing.one,
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
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
});
