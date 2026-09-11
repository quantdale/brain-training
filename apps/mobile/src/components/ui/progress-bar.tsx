/**
 * `ProgressBar` — determinate meter for progress, mastery and game chrome.
 *
 * The fill moves as a `scaleX` transform over a full-width inner bar (the only
 * transform-friendly way to grow a fill on the native driver) anchored to the
 * leading edge through `transformOrigin`. Game-chrome rollback meters reuse
 * the same component: `rollbackValue` paints a second, muted segment behind
 * the live fill so the pending loss reads as part of the same meter.
 */

import { Animated, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radii, Spacing, type ThemeColor } from '@/theme/tokens';
import { useAnimatedProgress } from './motion';

/** Props accepted by {@link ProgressBar}. */
export interface ProgressBarProps {
  /** Fill fraction, clamped to 0..1. */
  value: number;
  /** Fill family; defaults to the primary accent. */
  tone?: ThemeColor;
  /** Optional muted segment behind the fill (game-chrome rollback preview). */
  rollbackValue?: number;
  /** Track height; defaults to the standard meter thickness. */
  height?: number;
  /** Visible caption above the track. */
  label?: string;
  /** Visible trailing value (defaults to the integer percentage). */
  valueLabel?: string;
  /** Explicit accessible name; wins over the synthesised label. */
  accessibilityLabel?: string;
  testID?: string;
}

export function ProgressBar({
  value,
  tone = 'accent',
  rollbackValue,
  height = Spacing.two,
  label,
  valueLabel,
  accessibilityLabel,
  testID,
}: ProgressBarProps) {
  const theme = useTheme();
  // NaN reads as empty, never as full; both fractions share the same domain.
  const clamped = Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  const rollback =
    rollbackValue === undefined || Number.isNaN(rollbackValue)
      ? null
      : Math.min(1, Math.max(0, rollbackValue));
  const { value: fill } = useAnimatedProgress(clamped);
  const fillColor = theme[tone];
  const summary = valueLabel ?? `${percent}%`;

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      accessibilityLabel={accessibilityLabel ?? (label ? `${label}, ${summary}` : summary)}
      style={styles.root}>
      {label || valueLabel ? (
        <View style={styles.captionRow}>
          {label ? (
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.caption}>
              {label}
            </ThemedText>
          ) : null}
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {summary}
          </ThemedText>
        </View>
      ) : null}
      <View style={[styles.track, { height, backgroundColor: theme.surfaceSunken }]}>
        {rollback !== null ? (
          <View
            testID={testID ? `${testID}-rollback` : undefined}
            style={[
              styles.segment,
              {
                width: `${Math.round(rollback * 100)}%`,
                backgroundColor: fillColor,
                opacity: 0.35,
              },
            ]}
          />
        ) : null}
        <Animated.View
          testID={testID ? `${testID}-fill` : undefined}
          style={[
            styles.segment,
            styles.fill,
            {
              backgroundColor: fillColor,
              transform: [{ scaleX: fill }],
              // Without the leading-edge origin the fill would grow from the
              // centre of the track instead of the start.
              transformOrigin: 'left center',
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.one,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  caption: {
    flexShrink: 1,
  },
  track: {
    borderRadius: Radii.pill,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  // Both segments pin to the leading edge; the fill additionally spans the
  // full track so `scaleX` maps 0..1 onto 0..100% of the width.
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: Radii.pill,
  },
  fill: {
    width: '100%',
  },
});
