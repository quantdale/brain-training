/**
 * `ProgressRing` — hero metric ring without SVG.
 *
 * The ring is a fixed set of absolutely-positioned ticks rotated around the
 * centre; the first `round(value * segments)` read as filled. The fill index
 * rides `useAnimatedProgress` so a value change sweeps rather than jumps,
 * while reduced motion renders one static tick set at the final value.
 */

import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePrefersReducedMotion } from '@/components/a11y/reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { Spacing, type ThemeColor } from '@/theme/tokens';
import { useAnimatedProgress } from './motion';

/** Tick count that reads as a near-continuous ring on a hero surface. */
const DEFAULT_SEGMENTS = 56;

/** Props accepted by {@link ProgressRing}. */
export interface ProgressRingProps {
  /** Fill fraction, clamped to 0..1. */
  value: number;
  /** Outer diameter; defaults to twice the largest spacing step. */
  size?: number;
  /** Tangential width of one tick. */
  stroke?: number;
  /** Number of ticks around the circle. */
  segments?: number;
  /** Fill family; defaults to the primary accent. */
  tone?: ThemeColor;
  /** Centred content, usually the hero numeral. */
  children?: ReactNode;
  /** Textual summary exposed to assistive technology. */
  label?: string;
  testID?: string;
}

export function ProgressRing({
  value,
  size = Spacing.six * 2,
  stroke = Spacing.one,
  segments = DEFAULT_SEGMENTS,
  tone = 'accent',
  children,
  label,
  testID,
}: ProgressRingProps) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  // NaN reads as empty, never as full.
  const clamped = Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
  const count = Math.max(1, Math.floor(segments));
  // The numeric mirror re-renders this small subtree per frame so the sweep
  // animates; under reduced motion the hook settles instantly and the ring
  // falls back to the clamped value directly.
  const { numericValue } = useAnimatedProgress(clamped, { withNumericValue: true });
  const effective = reducedMotion ? clamped : (numericValue ?? clamped);
  const filled = Math.round(effective * count);
  const percent = Math.round(clamped * 100);

  const tickLength = Spacing.twoHalf;
  const radius = Math.max(0, (size - tickLength) / 2 - stroke);
  const centre = size / 2;
  // 061: the numeric mirror re-renders per animation frame; memoize the
  // tick elements on the filled count so reconciliation skips the 56 views
  // on frames where nothing visibly changed. Pixels are identical.
  const ticks: ReactNode[] = useMemo(() => {
    const nodes: ReactNode[] = [];
    for (let index = 0; index < count; index += 1) {
      const degrees = (index / count) * 360;
      nodes.push(
        <View
          key={index}
          testID={testID ? `${testID}-tick-${index}` : undefined}
          style={{
            position: 'absolute',
            left: centre - stroke / 2,
            top: centre - tickLength / 2,
            width: stroke,
            height: tickLength,
            borderRadius: stroke / 2,
            backgroundColor: index < filled ? theme[tone] : theme.border,
            transform: [{ rotate: `${degrees}deg` }, { translateY: -radius }],
          }}
        />,
      );
    }
    return nodes;
  }, [filled, count, centre, radius, stroke, tickLength, testID, tone, theme]);

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      accessibilityLabel={label ?? `${percent} percent`}
      style={{ width: size, height: size }}>
      {ticks}
      <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
