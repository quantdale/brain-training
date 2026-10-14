/**
 * Playfield — the Tap Rush tap surface.
 *
 * A square field hosting the current target. Positions are stored normalized
 * (0..1 on both axes); the field measures its own layout and reports taps as
 * normalized coordinates, so the reducer's hit test is resolution-independent
 * and fully deterministic.
 *
 * The target circle is positioned with percentage offsets and translated to
 * center on its point. Its diameter is the larger of `2 * radius * width`
 * and the platform touch-target floor; the reducer uses the same geometry.
 */
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Radii } from '@/constants/theme';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { FieldGeometry, TargetPosition } from '../types';
import { targetDiameter, validFieldGeometry } from '../geometry';

export interface PlayfieldProps {
  /** The live target, or null (round transition / idle). */
  target: TargetPosition | null;
  /** Target radius as a fraction of the field width. */
  radius: number;
  disabled?: boolean;
  /** Semantic testID of the field. */
  testID: string;
  /** Semantic testID of the target circle (defaults to `GAME_ID.target`). */
  targetTestID?: string;
  /** Stable tap handler (memoized field skips re-renders). */
  onTap: (x: number, y: number, geometry: FieldGeometry) => void;
}

export const Playfield = memo(function Playfield({
  target,
  radius,
  disabled = false,
  testID,
  targetTestID = testId(GAME_ID, 'target'),
  onTap,
}: PlayfieldProps) {
  const theme = useTheme();
  // Layout and touch coordinates share dp units. Both axes remain unavailable
  // until the first layout pass (tests fire that event before tapping).
  const [geometry, setGeometry] = useState<FieldGeometry>({ width: 0, height: 0 });
  const diameter = targetDiameter(radius, geometry.width);

  const handleLayout = (event: { nativeEvent: { layout: FieldGeometry } }) => {
    const { width, height } = event.nativeEvent.layout;
    setGeometry({ width, height });
  };

  const handlePress = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!validFieldGeometry(geometry) || target === null || disabled) {
      return;
    }
    const x = Math.min(1, Math.max(0, event.nativeEvent.locationX / geometry.width));
    const y = Math.min(1, Math.max(0, event.nativeEvent.locationY / geometry.height));
    onTap(x, y, geometry);
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Tap the glowing target before it disappears"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onLayout={handleLayout}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.field,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      {target !== null ? (
        <View
          testID={targetTestID}
          accessibilityLabel="Target"
          accessible
          // The target is a visual marker, not a control: without this, Android
          // hit-tests the tap onto this child and reports locationX/Y relative
          // to it, so the field's normalized hit test computed from those
          // coordinates misses every on-target tap (device-proven defect).
          pointerEvents="none"
          style={[
            styles.target,
            {
              left: `${target.x * 100}%`,
              top: `${target.y * 100}%`,
              width: diameter,
              height: diameter,
              backgroundColor: theme.speed,
            },
          ]}
        />
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  field: {
    alignSelf: 'stretch',
    aspectRatio: 1,
    // Campaign 065 touch-target guard: the square field sizes itself from the
    // layout width, so declare the shared vertical floor explicitly.
    minHeight: MIN_TOUCH_TARGET,
    maxWidth: '100%',
    borderRadius: Radii.large,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.92,
  },
  target: {
    position: 'absolute',
    aspectRatio: 1,
    borderRadius: Radii.pill,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
  },
});
