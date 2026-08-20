/**
 * Answer buttons — 4 color buttons for responding to Stroop trials.
 *
 * Memoized so the row skips re-renders when the parent screen re-renders on
 * unrelated state changes. Each button invokes the stable `onPress(color)`
 * handler internally, avoiding a fresh closure per render. Each circle also
 * carries a visible color-name label so the control is not color-only (a
 * minimal non-color cue for color-blind players; the color signal is kept).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';

import { STROOP_COLOR_HEX, STROOP_COLORS } from '../types';
import type { StroopColor } from '../types';

interface AnswerButtonsProps {
  onPress: (color: StroopColor) => void;
  disabled?: boolean;
  testID?: string;
}

export const AnswerButtons = memo(function AnswerButtons({
  onPress,
  disabled = false,
  testID,
}: AnswerButtonsProps) {
  return (
    <View style={styles.container} testID={testID}>
      {STROOP_COLORS.map((color) => (
        <View key={color} style={styles.cell}>
          <Pressable
            testID={`${testID}-${color}`}
            onPress={onPress ? () => onPress(color) : undefined}
            disabled={disabled}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: STROOP_COLOR_HEX[color],
                opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
            accessibilityLabel={`Answer ${color}`}
            accessibilityRole="button"
            accessibilityState={{ disabled }}>
            <View style={styles.inner} />
          </Pressable>
          <ThemedText type="caption" style={styles.label}>
            {color}
          </ThemedText>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.three,
  },
  cell: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: Radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    height: '100%',
  },
  label: {
    textAlign: 'center',
  },
});
