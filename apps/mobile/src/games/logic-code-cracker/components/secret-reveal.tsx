/**
 * SecretReveal — displays the secret code after a round ends.
 *
 * Shown during the roundResult phase to reveal what the player was
 * trying to guess. The code is displayed as colored pegs.
 */
import { StyleSheet, View } from 'react-native';
import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { COLOR_PALETTE } from './color-picker';
import { useCodePegSize } from './use-code-peg-size';

export interface SecretRevealProps {
  /** The secret code to reveal. */
  secretCode: readonly number[];
}

export function SecretReveal({ secretCode }: SecretRevealProps) {
  const theme = useTheme();
  const { pegSize, onLayout } = useCodePegSize(secretCode.length);
  return (
    <View style={styles.container} testID={testId('logic-code-cracker', 'secret-reveal')}>
      <ThemedText type="caption" themeColor="textSecondary">
        The code was:
      </ThemedText>
      <View style={styles.pegs} onLayout={onLayout} testID={testId('logic-code-cracker', 'secret-pegs')}>
        {secretCode.map((colorIndex, i) => (
          <View
            key={i}
            testID={testId('logic-code-cracker', 'secret-peg', String(i))}
            style={[
              styles.peg,
              { width: pegSize, height: pegSize, backgroundColor: COLOR_PALETTE[colorIndex], borderColor: theme.border },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
    width: '100%',
  },
  pegs: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
    justifyContent: 'center',
  },
  peg: {
    flexShrink: 0,
    borderRadius: 22,
    borderWidth: 2,
  },
});
