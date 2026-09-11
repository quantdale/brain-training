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

export interface SecretRevealProps {
  /** The secret code to reveal. */
  secretCode: readonly number[];
}

export function SecretReveal({ secretCode }: SecretRevealProps) {
  const theme = useTheme();
  return (
    <View style={styles.container} testID={testId('logic-code-cracker', 'secret-reveal')}>
      <ThemedText type="caption" themeColor="textSecondary">
        The code was:
      </ThemedText>
      <View style={styles.pegs}>
        {secretCode.map((colorIndex, i) => (
          <View
            key={i}
            testID={testId('logic-code-cracker', 'secret-peg', String(i))}
            style={[
              styles.peg,
              { backgroundColor: COLOR_PALETTE[colorIndex], borderColor: theme.border },
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
  },
  pegs: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  peg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
});
