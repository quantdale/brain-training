/**
 * Playfield — the Tap Rush tap surface.
 *
 * A square field hosting the current target. Positions are stored normalized
 * (0..1 on both axes); the field measures its own layout and reports taps as
 * normalized coordinates, so the reducer's hit test is resolution-independent
 * and fully deterministic.
 *
 * The target circle is positioned with percentage offsets and translated to
 * center on its point; its size is `2 * radius` of the field width.
 */
import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';
import type { TargetPosition } from '../types';

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
  onTap: (x: number, y: number) => void;
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
  // Measured field width in px; 0 until the first layout pass. Taps are only
  // meaningful once the size is known (tests fire the layout event first).
  const [width, setWidth] = useState(0);

  const handleLayout = (event: { nativeEvent: { layout: { width: number } } }) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const handlePress = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (width <= 0 || target === null || disabled) {
      return;
    }
    const x = Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
    const y = Math.min(1, Math.max(0, event.nativeEvent.locationY / width));
    onTap(x, y);
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
          style={[
            styles.target,
            {
              left: `${target.x * 100}%`,
              top: `${target.y * 100}%`,
              width: `${2 * radius * 100}%`,
              backgroundColor: theme.accent,
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
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
  },
});
