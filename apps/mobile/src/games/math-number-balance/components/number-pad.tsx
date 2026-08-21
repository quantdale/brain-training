/**
 * NumberPad — the Fast Math answer entry surface.
 *
 * A 3×4 keypad (digits 1–9, then backspace/0/submit). Every key is a semantic
 * testID target: `math-fast-math.digit.<d>`, `math-fast-math.backspace`,
 * `math-fast-math.submit`. The parent renders it only while a problem is
 * active and enabled, so no disabled state is needed here.
 *
 * The pad and each `Key` are `memo`ized; the screen keeps `onDigit`,
 * `onBackspace`, `onSubmit` stable across the 100 ms budget ticks, so the
 * keypad does not re-render on every tick (only when the problem changes).
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';

export interface NumberPadProps {
  onDigit: (digit: number) => void;
  onBackspace: () => void;
  onSubmit: () => void;
}

const ROWS: readonly (readonly (number | 'backspace' | 'submit')[])[] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['backspace', 0, 'submit'],
];

export const NumberPad = memo(function NumberPad({ onDigit, onBackspace, onSubmit }: NumberPadProps) {
  const theme = useTheme();
  return (
    <View style={styles.pad} testID={testId(GAME_ID, 'number-pad')} accessible={false}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => {
            if (key === 'backspace') {
              return (
                <Key
                  key="backspace"
                  label="⌫"
                  accessibilityLabel="Delete last digit"
                  testID={testId(GAME_ID, 'backspace')}
                  onPress={onBackspace}
                  theme={theme}
                />
              );
            }
            if (key === 'submit') {
              return (
                <Key
                  key="submit"
                  label="✓"
                  accessibilityLabel="Submit answer"
                  testID={testId(GAME_ID, 'submit')}
                  onPress={onSubmit}
                  theme={theme}
                  accent
                />
              );
            }
            return (
              <Key
                key={key}
                label={String(key)}
                accessibilityLabel={`Digit ${key}`}
                testID={testId(GAME_ID, 'digit', String(key))}
                onPressDigit={onDigit}
                digit={key}
                theme={theme}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
});

export interface KeyProps {
  label: string;
  accessibilityLabel: string;
  testID: string;
  /** Provided for backspace/submit (no extra payload). */
  onPress?: () => void;
  /** Provided for digit keys (carries the digit value). */
  onPressDigit?: (digit: number) => void;
  digit?: number;
  theme: ReturnType<typeof useTheme>;
  accent?: boolean;
}

export const Key = memo(function Key({
  label,
  accessibilityLabel,
  testID,
  onPress,
  onPressDigit,
  digit,
  theme,
  accent = false,
}: KeyProps) {
  const handlePress = onPressDigit !== undefined && digit !== undefined
    ? () => onPressDigit(digit)
    : onPress;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: false }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.key,
        { backgroundColor: accent ? theme.accent : theme.surface, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="headline" style={{ color: accent ? '#FFFFFF' : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pad: {
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  key: {
    flex: 1,
    aspectRatio: 1.6,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
