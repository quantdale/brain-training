/**
 * Answer buttons — 4 color buttons for responding to Stroop trials.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';

import { STROOP_COLOR_HEX, STROOP_COLORS } from '../types';
import type { StroopColor } from '../types';

interface AnswerButtonsProps {
  onPress: (color: StroopColor) => void;
  disabled?: boolean;
  testID?: string;
}

export function AnswerButtons({ onPress, disabled = false, testID }: AnswerButtonsProps) {
  return (
    <View style={styles.container} testID={testID}>
      {STROOP_COLORS.map((color) => (
        <Pressable
          key={color}
          testID={`${testID}-${color}`}
          onPress={() => onPress(color)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: STROOP_COLOR_HEX[color],
              opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
            },
          ]}
          accessibilityLabel={`Answer ${color}`}
          accessibilityRole="button">
          <View style={styles.inner} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.three,
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
});