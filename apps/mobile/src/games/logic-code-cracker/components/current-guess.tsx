/**
 * CurrentGuess — displays the guess currently being built.
 *
 * Shows empty slots for the code length, with filled slots for colors
 * already selected. Provides a clear button to reset the current guess.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { COLOR_PALETTE } from './color-picker';
import { GameButton } from './button';

export interface CurrentGuessProps {
  /** The colors currently selected (0-based indices). */
  currentGuess: readonly number[];
  /** Total code length (number of pegs). */
  codeLength: number;
  /** Whether to show the clear button. */
  showClear?: boolean;
  /** Callback when clear is pressed. */
  onClear?: () => void;
}

export function CurrentGuess({
  currentGuess,
  codeLength,
  showClear = false,
  onClear,
}: CurrentGuessProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testId('logic-code-cracker', 'current-guess')}>
      <View style={styles.pegs}>
        {Array.from({ length: codeLength }, (_, i) => {
          const colorIndex = i < currentGuess.length ? currentGuess[i] : null;
          return (
            <View
              key={i}
              testID={testId('logic-code-cracker', 'guess-peg', String(i))}
              style={[
                styles.peg,
                {
                  backgroundColor: colorIndex !== null ? COLOR_PALETTE[colorIndex] : theme.border,
                  borderColor: theme.border,
                },
              ]}
            />
          );
        })}
      </View>
      {showClear && currentGuess.length > 0 && onClear ? (
        <GameButton
          small
          variant="secondary"
          testID={testId('logic-code-cracker', 'clear-guess')}
          label="Clear"
          onPress={onClear}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  pegs: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  peg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
});
