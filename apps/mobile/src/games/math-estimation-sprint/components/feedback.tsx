/**
 * FeedbackPanel — per-problem result card shown after each answer.
 *
 * Reports correct/incorrect/timeout with the problem and the expected answer
 * (learning value), then advances to the next problem or to the results.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { GAME_ID } from '../types';
import type { MathProblem, MathRoundOutcome } from '../types';
import { GameButton } from './button';

export interface FeedbackPanelProps {
  outcome: MathRoundOutcome;
  problem: MathProblem;
  /** The player's submitted digits (empty for a timeout with no input). */
  enteredAnswer: string;
  /** True when this was the last problem (button label + results route). */
  isLastProblem: boolean;
  onNext: () => void;
}

export function FeedbackPanel({
  outcome,
  problem,
  enteredAnswer,
  isLastProblem,
  onNext,
}: FeedbackPanelProps) {
  const themeColor =
    outcome === 'correct' ? 'success' : outcome === 'incorrect' ? 'danger' : 'warning';
  const title = outcome === 'correct' ? 'Correct!' : outcome === 'incorrect' ? 'Not quite' : "Time's up";
  const expected =
    outcome === 'correct' ? null : `The answer was ${problem.answer}`;
  return (
    <View style={styles.card} testID={testId(GAME_ID, 'feedback')}>
      <ThemedText
        type="headline"
        themeColor={themeColor}
        testID={testId(GAME_ID, outcome === 'correct' ? 'feedback-correct' : outcome === 'incorrect' ? 'feedback-incorrect' : 'feedback-timeout')}>
        {title}
      </ThemedText>
      <ThemedText type="bodyLarge" testID={testId(GAME_ID, 'feedback-problem')}>
        {problem.left} {problem.operator} {problem.right} ={' '}
        {outcome === 'correct' ? String(problem.answer) : enteredAnswer.length > 0 ? enteredAnswer : '—'}
      </ThemedText>
      {expected !== null ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          testID={testId(GAME_ID, 'feedback-expected-answer')}>
          {expected}
        </ThemedText>
      ) : null}
      <GameButton
        testID={testId(GAME_ID, 'next-problem')}
        label={isLastProblem ? 'See results' : 'Next problem'}
        onPress={onNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    alignItems: 'center',
  },
});
