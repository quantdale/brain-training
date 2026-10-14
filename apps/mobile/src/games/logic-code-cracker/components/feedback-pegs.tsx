/**
 * FeedbackPegs — displays the feedback for a guess in Code Cracker.
 *
 * Shows exact matches (filled pegs) and color-only matches (outline pegs).
 * The feedback is displayed in a compact row next to or below the guess.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

import type { GuessFeedback } from '../types';

export interface FeedbackPegsProps {
  feedback: GuessFeedback;
  testID?: string;
}

/**
 * Small peg indicators:
 * Filled = exact match; outline = correct color in the wrong position.
 * Both use semantic ink on the surface, so dark-mode exact pegs stay visible.
 * Visible counts and the accessible summary also describe zero matches.
 */
export function FeedbackPegs({ feedback, testID }: FeedbackPegsProps) {
  const theme = useTheme();
  const total = feedback.exact + feedback.colorOnly;

  return (
    <View
      style={[styles.panel, { backgroundColor: theme.surface }]}
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${feedback.exact} exact, ${feedback.colorOnly} color only`}>
      {total > 0 ? (
        <View style={styles.row}>
          {Array.from({ length: total }, (_, i) => (
            <View
              key={`match-${i}`}
              testID={i < feedback.exact ? testId(testID ?? '', 'exact') : testId(testID ?? '', 'color-only')}
              style={[
                styles.peg,
                {
                  backgroundColor: i < feedback.exact ? theme.text : theme.surface,
                  borderColor: theme.text,
                  borderWidth: i < feedback.exact ? 0 : 2,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
      <ThemedText type="caption" themeColor="text">
        {feedback.exact} exact · {feedback.colorOnly} color only
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.one,
    padding: Spacing.one,
  },
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
});
