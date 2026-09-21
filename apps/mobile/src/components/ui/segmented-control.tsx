/**
 * `SegmentedControl` — animated single-select for time windows and scopes.
 *
 * Options share the row equally; a pill indicator behind the selected option
 * glides to its measured slot in `Motion.quick`. Under reduced motion the
 * indicator snaps with no transition while selection itself stays immediate.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { usePrefersReducedMotion } from '@/components/a11y/reduced-motion';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { MinTouchTarget, Motion, Radii, Spacing } from '@/theme/tokens';
import { RADIUS_CAP } from './radius';
import { Tappable } from './tappable';

/** One selectable segment. */
export interface SegmentOption {
  value: string;
  label: string;
  testID?: string;
}

/** Props accepted by {@link SegmentedControl}. */
export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  testID?: string;
  /**
   * Denser labels and padding. The row still lays out at the 44 dp floor:
   * uiautomator exposes the option's visual bounds to assistive tech, so a
   * 32 dp row would read as an undersized target even with hit-slop expansion.
   */
  compact?: boolean;
}

export function SegmentedControl({ options, value, onChange, testID, compact = false }: SegmentedControlProps) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  // Lazy state (not a ref) so the animated value is created once without
  // being read through a ref during render.
  const [position] = useState(() => new Animated.Value(selectedIndex));
  const [innerWidth, setInnerWidth] = useState(0);
  // The initial Animated.Value already equals `selectedIndex`, so a mount-time
  // timing run would only burn frames without any visual change.
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      position.setValue(selectedIndex);
      return;
    }
    if (reducedMotion) {
      position.setValue(selectedIndex);
      return;
    }
    const animation = Animated.timing(position, {
      toValue: selectedIndex,
      duration: Motion.quick,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [position, reducedMotion, selectedIndex]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setInnerWidth(event.nativeEvent.layout.width);
  };

  const count = Math.max(1, options.length);
  const slotWidth = innerWidth / count;
  const indicatorLeft =
    count > 1
      ? position.interpolate({
          inputRange: [0, count - 1],
          outputRange: [0, (count - 1) * slotWidth],
        })
      : 0;

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      onLayout={handleLayout}
      style={[
        styles.track,
        compact && styles.trackCompact,
        { backgroundColor: theme.surfaceSunken },
      ]}>
      <Animated.View
        testID={testID ? `${testID}-indicator` : undefined}
        style={[
          styles.indicator,
          {
            left: Animated.add(indicatorLeft, Spacing.half),
            width: Math.max(0, slotWidth - Spacing.one),
            backgroundColor: theme.surface,
          },
        ]}
      />
      {options.map((option, index) => {
        const selected = index === selectedIndex;
        return (
          <Tappable
            key={option.value}
            testID={option.testID ?? (testID ? `${testID}-option-${option.value}` : undefined)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[styles.option, compact && styles.optionCompact]}>
            <ThemedText
              type={compact ? 'caption' : 'bodySmall'}
              themeColor={selected ? 'text' : 'textSecondary'}
              numberOfLines={1}>
              {option.label}
            </ThemedText>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: RADIUS_CAP,
    padding: Spacing.half,
  },
  trackCompact: {
    borderRadius: Radii.medium,
  },
  // The pill sits behind the labels; the labels paint above it in DOM order.
  indicator: {
    position: 'absolute',
    top: Spacing.half,
    bottom: Spacing.half,
    borderRadius: RADIUS_CAP,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.two,
    borderRadius: RADIUS_CAP,
  },
  optionCompact: {
    // The compact variant shrinks type and padding, never the target.
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.one,
    borderRadius: Radii.medium,
  },
});
