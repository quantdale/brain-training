/**
 * Feedback display — shows correct/incorrect after a response.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface FeedbackDisplayProps {
  correct: boolean;
  correctAnswer: string;
  responseTimeMs: number;
  /** True when the round ended by stimulus timeout (no answer was given). */
  timedOut?: boolean;
  testID?: string;
}

export function FeedbackDisplay({
  correct,
  correctAnswer,
  responseTimeMs,
  timedOut = false,
  testID,
}: FeedbackDisplayProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: correct ? theme.success : theme.danger }]}
      testID={testID}>
      <ThemedText type="headline" style={styles.text}>
        {correct ? 'Correct!' : timedOut ? "Time's up!" : 'Wrong!'}
      </ThemedText>
      {!correct && (
        <ThemedText type="bodyLarge" style={styles.answer}>
          It was {correctAnswer}
        </ThemedText>
      )}
      <ThemedText type="caption" style={styles.time}>
        {Math.round(responseTimeMs)}ms
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: Radii.large,
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  answer: {
    color: '#FFFFFF',
    marginTop: Spacing.one,
  },
  time: {
    color: '#FFFFFFCC',
    marginTop: Spacing.one,
  },
});