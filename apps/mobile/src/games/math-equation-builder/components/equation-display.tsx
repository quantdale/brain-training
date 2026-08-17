/**
 * EquationDisplay — renders the equation being built by the player.
 * Shows tokens, the target, and the current result.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { testId } from '@/sdk';

import { GAME_ID } from '../types';
import type { EquationToken } from '../types';

export interface EquationDisplayProps {
  target: number;
  tokens: readonly EquationToken[];
  result: number | null;
  isCorrect: boolean | null;
}

function formatToken(token: EquationToken): string {
  if (typeof token === 'number') return String(token);
  if (token === '-') return '−';
  return token;
}

export function EquationDisplay({ target, tokens, result, isCorrect }: EquationDisplayProps) {
  const theme = useTheme();

  const equationStr = tokens.length > 0
    ? tokens.map(formatToken).join(' ')
    : '?';

  return (
    <View style={styles.container} testID={testId(GAME_ID, 'equation-display')}>
      <View style={styles.targetRow}>
        <ThemedText type="caption" themeColor="textSecondary">
          Target
        </ThemedText>
        <ThemedText
          type="headline"
          themeColor="accent"
          testID={testId(GAME_ID, 'target')}>
          {target}
        </ThemedText>
      </View>

      <View style={styles.equationRow}>
        <ThemedText
          type="bodyLarge"
          testID={testId(GAME_ID, 'equation')}>
          {equationStr} = ?
        </ThemedText>
      </View>

      {result !== null ? (
        <View style={styles.resultRow}>
          <ThemedText
            type="small"
            themeColor={isCorrect ? 'success' : 'danger'}
            testID={testId(GAME_ID, 'result')}>
            {isCorrect ? '✓ Correct!' : `Your answer: ${result}`}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: '#00000015',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  equationRow: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  resultRow: {
    alignItems: 'center',
  },
});
