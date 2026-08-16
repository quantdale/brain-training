/**
 * NumberPad — the Fast Math answer entry surface.
 *
 * A 3×4 keypad (digits 1–9, then backspace/0/submit). Every key is a semantic
 * testID target: `math-fast-math.digit.<d>`, `math-fast-math.backspace`,
 * `math-fast-math.submit`. The parent renders it only while a problem is
 * active and enabled, so no disabled state is needed here.
 */
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

export function NumberPad({ onDigit, onBackspace, onSubmit }: NumberPadProps) {
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
                onPress={() => onDigit(key)}
                theme={theme}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Key({
  label,
  accessibilityLabel,
  testID,
  onPress,
  theme,
  accent = false,
}: {
  label: string;
  accessibilityLabel: string;
  testID: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  accent?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
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
}

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
