/**
 * GuessHistory — displays the history of guesses for the current round.
 *
 * Each row shows the guess colors and the feedback pegs. The most recent
 * guess is at the bottom.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { COLOR_PALETTE } from './color-picker';
import { FeedbackPegs } from './feedback-pegs';
import type { GuessEntry } from '../types';

export interface GuessHistoryProps {
  /** Previous guesses in this round. */
  guesses: readonly GuessEntry[];
  /** Number of guesses used so far. */
  guessesUsed: number;
  /** Maximum guesses allowed. */
  guessBudget: number;
}

export function GuessHistory({ guesses, guessesUsed, guessBudget }: GuessHistoryProps) {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testId('logic-code-cracker', 'guess-history')}>
      <ThemedText type="caption" themeColor="textSecondary">
        Guess {guessesUsed}/{guessBudget}
      </ThemedText>
      {guesses.map((entry, index) => (
        <View
          key={index}
          style={[styles.row, { borderColor: theme.border }]}
          testID={testId('logic-code-cracker', 'history-row', String(index))}>
          <View style={styles.guessPegs}>
            {entry.guess.map((colorIndex, pegIndex) => (
              <View
                key={pegIndex}
                style={[
                  styles.guessPeg,
                  { backgroundColor: COLOR_PALETTE[colorIndex] },
                ]}
              />
            ))}
          </View>
          <FeedbackPegs
            feedback={entry.feedback}
            testID={testId('logic-code-cracker', 'history-feedback', String(index))}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.oneHalf,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.oneHalf,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.small,
    borderWidth: 1,
  },
  guessPegs: {
    flexDirection: 'row',
    gap: Spacing.oneHalf,
  },
  guessPeg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00000022',
  },
});
