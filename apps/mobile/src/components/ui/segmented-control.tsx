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
  /** Denser labels and padding; the interaction area still meets the floor. */
  compact?: boolean;
}

export function SegmentedControl({ options, value, onChange, testID, compact = false }: SegmentedControlProps) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const position = useRef(new Animated.Value(selectedIndex)).current;
  const [innerWidth, setInnerWidth] = useState(0);

  useEffect(() => {
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
            renderedSize={compact ? Spacing.five : MinTouchTarget}
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
    minHeight: Spacing.five,
    paddingHorizontal: Spacing.one,
    borderRadius: Radii.medium,
  },
});
