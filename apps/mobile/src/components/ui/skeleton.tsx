/**
 * `Skeleton` — pulsing placeholder plus `SkeletonText` for paragraphs.
 *
 * The shimmer loops opacity between full strength and a kit-local floor
 * (tokens carry no opacity ramp); under reduced motion it stays static.
 * Placeholders are hidden from assistive tech on both platforms, so a screen
 * reader never lands on them — only the `SkeletonText` wrapper exposes the
 * "Loading" label.
 */

import { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { usePrefersReducedMotion } from '@/components/a11y/reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { Motion, Radii, Spacing, Typography } from '@/theme/tokens';

/** Props accepted by {@link Skeleton}. */
export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SKELETON_DIM = 0.45;
const SKELETON_FULL = 1;

export function Skeleton({
  width = '100%',
  height = Typography.body.lineHeight,
  radius = Radii.small,
  style,
  testID,
}: SkeletonProps) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const opacity = useRef(new Animated.Value(SKELETON_FULL)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(SKELETON_FULL);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: SKELETON_DIM,
          duration: Motion.base,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: SKELETON_FULL,
          duration: Motion.base,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.surfaceSunken,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** Paragraph placeholder: `lines` bars, the last one shortened. */
export function SkeletonText({ lines = 3, testID }: { lines?: number; testID?: string }) {
  const count = Math.max(1, Math.floor(lines));

  return (
    <View testID={testID} accessibilityLabel="Loading" style={styles.text}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          testID={testID ? `${testID}-line-${index}` : undefined}
          // Shortened final line is standard skeleton anatomy, not spacing.
          width={index === count - 1 ? '60%' : '100%'}
          height={Typography.body.lineHeight}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    rowGap: Spacing.two,
  },
});
