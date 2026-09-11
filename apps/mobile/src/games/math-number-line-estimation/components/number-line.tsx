/**
 * NumberLine — the playfield for the Number Line Estimation game.
 *
 * Renders a horizontal number line with labeled endpoints, unlabeled decile
 * ticks, and a flag at the target value. The player taps anywhere on the
 * line to lock in an estimate: the tap's x-position is converted to a
 * fraction of the line width, mapped into `[lineMin, lineMax]`, and snapped
 * to the nearest integer value.
 *
 * Geometry is pure and exported (`valueToFraction` / `fractionToValue` /
 * `snapToValue`) so tests can verify the mapping without rendering.
 *
 * Accessibility: the pressable line exposes a descriptive label that never
 * contains the target value — the challenge must not leak through the
 * accessibility tree. Once the round resolves, the label carries the verdict
 * in words and the markers are decorative.
 *
 * Resolved frame (PATTERNS-PLAY 6): the flag (target) stays visible and the
 * player's estimate renders beside it as a verdict marker — a verdict-family
 * disc (shape + fill) with a ✓/✕ glyph, so the two positions never read
 * apart by colour alone. Timeouts show no marker (no estimate was made).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import { testId } from '@/sdk';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { RoundOutcome } from '../types';

/** Clamp a fraction into [0, 1]. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Map a value onto the [0, 1] fraction of the line it sits at. */
export function valueToFraction(value: number, lineMin: number, lineMax: number): number {
  const span = lineMax - lineMin;
  if (span <= 0) return 0;
  return clamp01((value - lineMin) / span);
}

/**
 * Map a tap fraction back to a value. The result is NOT rounded here — use
 * `snapToValue` so the rounding policy has exactly one definition.
 */
export function fractionToValue(fraction: number, lineMin: number, lineMax: number): number {
  const span = lineMax - lineMin;
  return lineMin + clamp01(fraction) * span;
}

/** Snap a raw (possibly fractional) value to the nearest integer in range. */
export function snapToValue(value: number, lineMin: number, lineMax: number): number {
  const snapped = Math.round(value);
  return Math.min(lineMax, Math.max(lineMin, snapped));
}

export interface NumberLineProps {
  readonly lineMin: number;
  readonly lineMax: number;
  /** Flagged target value (strictly interior; see generator.ts). */
  readonly target: number;
  /** Tap handler receiving the snapped integer estimate. */
  readonly onEstimate: (value: number) => void;
  /** Disabled while paused / outside the estimating phase. */
  readonly disabled?: boolean;
  /**
   * Player's snapped estimate; rendered as a verdict marker next to the flag
   * in the resolved frame. Null (or omitted) means no estimate was made
   * (timeout) — only the flag shows.
   */
  readonly estimate?: number | null;
  /**
   * Resolved outcome from the reducer. When set, the line is a read-only
   * verdict frame: the flag (target) stays visible and the estimate marker
   * carries the verdict. Null while the round is open.
   */
  readonly outcome?: RoundOutcome | null;
  /**
   * Injectable line width for deterministic tests; when omitted the width is
   * measured via onLayout (production path).
   */
  readonly width?: number;
}

export function NumberLine({
  lineMin,
  lineMax,
  target,
  onEstimate,
  disabled = false,
  estimate = null,
  outcome = null,
  width,
}: NumberLineProps) {
  const theme = useTheme();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const lineWidth = width ?? measuredWidth;

  const handlePress = (locationX: number | undefined) => {
    if (disabled || lineWidth <= 0 || locationX === undefined || !Number.isFinite(locationX)) {
      return;
    }
    const raw = fractionToValue(locationX / lineWidth, lineMin, lineMax);
    onEstimate(snapToValue(raw, lineMin, lineMax));
  };

  const ticks = Array.from({ length: 9 }, (_, i) => (i + 1) / 10); // deciles, unlabeled
  const flagFraction = valueToFraction(target, lineMin, lineMax);
  const resolved = outcome !== null;
  const estimateFraction = estimate !== null ? valueToFraction(estimate, lineMin, lineMax) : null;
  const markerFill = outcome === 'hit' ? theme.success : outcome === 'miss' ? theme.danger : null;
  const markerOn = outcome === 'hit' ? theme.successOn : outcome === 'miss' ? theme.dangerOn : null;
  const markerGlyph = outcome === 'hit' ? '✓' : outcome === 'miss' ? '✕' : null;
  const trackBorder =
    outcome === 'hit' ? theme.success : outcome === 'miss' ? theme.danger : outcome === 'timeout' ? theme.warning : null;
  const accessibilityLabel = resolved
    ? outcome === 'hit'
      ? `Correct: the flag was at ${target}; you tapped ${estimate}.`
      : outcome === 'miss'
        ? `Too far off: the flag was at ${target}; you tapped ${estimate}.`
        : `Timed out: the flag was at ${target}; no estimate was made.`
    : `Number line from ${lineMin} to ${lineMax}. A flag marks the target. Tap where you think its value is.`;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelsRow}>
        <Text style={[styles.label, { color: theme.textSecondary }]} testID={testId(GAME_ID, 'line-label-min')}>
          {lineMin}
        </Text>
        <Text style={[styles.label, { color: theme.textSecondary }]} testID={testId(GAME_ID, 'line-label-max')}>
          {lineMax}
        </Text>
      </View>

      <Pressable
        testID={testId(GAME_ID, 'number-line')}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="adjustable"
        accessibilityHint={resolved ? undefined : "Tap to lock in your estimate of the flag's value."}
        disabled={disabled || resolved}
        onPress={(event) => handlePress(event.nativeEvent.locationX)}
        onLayout={(event) => {
          if (width === undefined) {
            setMeasuredWidth(event.nativeEvent.layout.width);
          }
        }}
        hitSlop={8}
        style={({ pressed }) => [
          styles.lineTrack,
          {
            backgroundColor: theme.border,
            opacity: disabled && !resolved ? 0.5 : pressed && !resolved ? 0.85 : 1,
            borderColor: trackBorder ?? 'transparent',
            borderWidth: trackBorder !== null ? 2 : 0,
          },
        ]}>
        <View style={styles.ticksLayer} pointerEvents="none">
          {ticks.map((fraction) => (
            <View
              key={fraction}
              style={[
                styles.tick,
                { left: `${fraction * 100}%`, backgroundColor: theme.textSecondary },
              ]}
            />
          ))}
        </View>
        {/* The flag marking the target — purely visual, never announces its value. */}
        <View
          pointerEvents="none"
          testID={testId(GAME_ID, 'line-flag')}
          style={[styles.flag, { left: `${flagFraction * 100}%`, backgroundColor: theme.accent }]}
        />
        {resolved && estimateFraction !== null && markerFill !== null && markerOn !== null && markerGlyph !== null ? (
          <View
            pointerEvents="none"
            testID={testId(GAME_ID, 'line-guess')}
            style={[
              styles.guess,
              {
                left: `${estimateFraction * 100}%`,
                backgroundColor: markerFill,
              },
            ]}
            importantForAccessibility="no-hide-descendants">
            <ThemedText type="label" style={{ color: markerOn }} allowFontScaling={false}>
              {markerGlyph}
            </ThemedText>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  lineTrack: {
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
  },
  ticksLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tick: {
    position: 'absolute',
    bottom: 0,
    width: 1,
    height: 10,
    opacity: 0.6,
  },
  flag: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  // Estimate marker: a verdict-family disc (shape + fill + glyph) centred on
  // the tapped position. The bar flag and the disc read apart by shape, so
  // the two positions never differ by colour alone. `translateX` centres the
  // 28 dp disc on the fraction (half its width).
  guess: {
    position: 'absolute',
    top: 10,
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    transform: [{ translateX: -14 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
