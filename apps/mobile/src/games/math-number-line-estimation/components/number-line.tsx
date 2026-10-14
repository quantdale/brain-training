/**
 * NumberLine — the playfield for the Number Line Estimation game.
 *
 * Renders a horizontal number line with labeled endpoints, unlabeled decile
 * ticks and a numeric target. The target position is revealed only after
 * submission. The player taps anywhere on the line to choose an estimate:
 * the tap's x-position is converted to a
 * fraction of the line width, mapped into `[lineMin, lineMax]`, and snapped
 * to the nearest integer value.
 *
 * Geometry is pure and exported (`valueToFraction` / `fractionToValue` /
 * `snapToValue`) so tests can verify the mapping without rendering.
 *
 * Accessibility: the numeric target is equally available to everyone. The
 * adjustable line and buttons move the draft position; a separate action
 * commits it. No live marker reveals the correct position.
 *
 * Resolved frame (PATTERNS-PLAY 6): the flag (target) stays visible and the
 * player's estimate renders beside it as a verdict marker — a verdict-family
 * disc (shape + fill) with a ✓/✕ glyph, so the two positions never read
 * apart by colour alone. Timeouts show no marker (no estimate was made).
 */
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import { canonicalClamp01, testId } from '@/sdk';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { GameButton } from '@/components/game-ui';

import { GAME_ID } from '../types';
import type { RoundOutcome } from '../types';

/**
 * Clamp a fraction into [0, 1] — delegates to the canonical SDK helper so
 * non-finite input collapses to 0 instead of propagating NaN (066
 * single-source contract; R2 residual).
 */
export function clamp01(value: number): number {
  return canonicalClamp01(value);
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
  /** Numeric target value; its position stays hidden until feedback. */
  readonly target: number;
  /** Submit handler receiving the committed snapped integer estimate. */
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
   * verdict frame: the target flag is revealed and the estimate marker
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
  const [draftFraction, setDraftFraction] = useState<number | null>(null);
  const [committed, setCommitted] = useState(false);
  const committedRef = useRef(false);
  const lineWidth = width ?? measuredWidth;
  const resolved = outcome !== null;
  const locked = disabled || resolved || committed;
  const step = Math.min(0.01, 1 / Math.max(1, lineMax - lineMin));

  const adjustPosition = (direction: -1 | 1) => {
    if (locked || committedRef.current) return;
    setDraftFraction((previous) => clamp01(Number(((previous ?? 0.5) + direction * step).toFixed(6))));
  };

  const commitEstimate = () => {
    if (locked || committedRef.current || draftFraction === null) return;
    committedRef.current = true;
    setCommitted(true);
    onEstimate(snapToValue(fractionToValue(draftFraction, lineMin, lineMax), lineMin, lineMax));
  };

  const handlePress = (locationX: number | undefined) => {
    if (locked || committedRef.current || lineWidth <= 0 || locationX === undefined || !Number.isFinite(locationX)) {
      return;
    }
    setDraftFraction(clamp01(locationX / lineWidth));
  };

  const ticks = Array.from({ length: 9 }, (_, i) => (i + 1) / 10); // deciles, unlabeled
  const flagFraction = valueToFraction(target, lineMin, lineMax);
  const draftPercent = Number(((draftFraction ?? 0.5) * 100).toFixed(1));
  const estimateFraction = estimate !== null ? valueToFraction(estimate, lineMin, lineMax) : null;
  const markerFill = outcome === 'hit' ? theme.success : outcome === 'miss' ? theme.danger : null;
  const markerOn = outcome === 'hit' ? theme.successOn : outcome === 'miss' ? theme.dangerOn : null;
  const markerGlyph = outcome === 'hit' ? '✓' : outcome === 'miss' ? '✕' : null;
  const trackBorder =
    outcome === 'hit' ? theme.success : outcome === 'miss' ? theme.danger : outcome === 'timeout' ? theme.warning : null;
  const accessibilityLabel = resolved
    ? outcome === 'hit'
      ? `Correct: the target was at ${target}; you estimated ${estimate}.`
      : outcome === 'miss'
        ? `Too far off: the target was at ${target}; you estimated ${estimate}.`
        : `Timed out: the target was at ${target}; no estimate was made.`
    : `Target ${target}. Number line from ${lineMin} to ${lineMax}. Choose where the target belongs, then submit your estimate.`;

  return (
    <View style={styles.wrap} testID={testId(GAME_ID, 'number-line-wrap')}>
      <View style={styles.targetRow}>
        <ThemedText type="small" themeColor="textSecondary">Place this number</ThemedText>
        <ThemedText type="headline" themeColor="text" testID={testId(GAME_ID, 'target-value')}>{target}</ThemedText>
      </View>
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
        accessibilityRole={resolved ? 'text' : 'adjustable'}
        accessibilityHint={resolved ? undefined : 'Swipe up or down to adjust the position, or tap the line. Then use Submit estimate.'}
        accessibilityValue={resolved ? undefined : { min: 0, max: 100, now: draftPercent, text: draftFraction === null ? 'No position selected. Adjust from the midpoint.' : `${draftPercent}% across the line` }}
        accessibilityActions={resolved ? undefined : [
          { name: 'increment', label: 'Move right' },
          { name: 'decrement', label: 'Move left' },
          { name: 'activate', label: 'Submit estimate' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') adjustPosition(1);
          if (event.nativeEvent.actionName === 'decrement') adjustPosition(-1);
          if (event.nativeEvent.actionName === 'activate') commitEstimate();
        }}
        disabled={locked}
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
        {/* This is the answer position. It must never mount during play. */}
        {resolved ? (
          <View
            pointerEvents="none"
            testID={testId(GAME_ID, 'line-flag')}
            style={[styles.flag, { left: `${flagFraction * 100}%`, backgroundColor: theme.math }]}
          />
        ) : null}
        {!resolved && draftFraction !== null ? (
          <View
            pointerEvents="none"
            testID={testId(GAME_ID, 'line-selection')}
            style={[styles.selection, { left: `${draftFraction * 100}%`, borderColor: theme.text, backgroundColor: theme.surface }]}
          />
        ) : null}
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
      {!resolved ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'selection-status')}>
            {draftFraction === null ? 'Choose a position, then submit.' : `Your position: ${draftPercent}% across the line`}
          </ThemedText>
          <View style={styles.controls}>
            <GameButton small variant="secondary" label="Move left" testID={testId(GAME_ID, 'estimate-decrease')} onPress={() => adjustPosition(-1)} disabled={locked || draftFraction === 0} style={styles.control} />
            <GameButton small variant="secondary" label="Move right" testID={testId(GAME_ID, 'estimate-increase')} onPress={() => adjustPosition(1)} disabled={locked || draftFraction === 1} style={styles.control} />
            <GameButton label="Submit estimate" testID={testId(GAME_ID, 'submit-estimate')} onPress={commitEstimate} disabled={locked || draftFraction === null} style={styles.control} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
    // Must span its container: inside the centered feedback card this wrapper
    // would otherwise shrink-wrap to its content and collapse the line track
    // (absolute-positioned children add no intrinsic width) — device-captured
    // defect where the resolved number line rendered as a ~60px pill.
    alignSelf: 'stretch',
  },
  targetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  control: {
    flexGrow: 1,
    maxWidth: '100%',
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
  selection: {
    position: 'absolute',
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    transform: [{ translateX: -14 }],
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
