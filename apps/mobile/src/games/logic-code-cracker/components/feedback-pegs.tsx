/**
 * FeedbackPegs — displays the feedback for a guess in Code Cracker.
 *
 * Shows exact matches (black pegs) and color-only matches (white pegs).
 * The feedback is displayed in a compact row next to or below the guess.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Spacing } from '@/constants/theme';

import type { GuessFeedback } from '../types';

export interface FeedbackPegsProps {
  feedback: GuessFeedback;
  testID?: string;
}

/**
 * Small peg indicators:
 * - Black (filled) = exact match (correct color, correct position)
 * - White (outline) = color-only match (correct color, wrong position)
 * - Empty = no match
 */
export function FeedbackPegs({ feedback, testID }: FeedbackPegsProps) {
  const total = feedback.exact + feedback.colorOnly;

  return (
    <View style={styles.row} testID={testID}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={`match-${i}`}
          testID={i < feedback.exact ? testId(testID ?? '', 'exact') : testId(testID ?? '', 'color-only')}
          style={[
            styles.peg,
            i < feedback.exact ? styles.exact : styles.colorOnly,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.oneHalf,
    alignItems: 'center',
  },
  peg: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  exact: {
    backgroundColor: '#2C3E50', // Dark/black for exact
  },
  colorOnly: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BDC3C7',
  },
});
