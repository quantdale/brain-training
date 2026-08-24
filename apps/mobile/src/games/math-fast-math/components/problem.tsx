/**
 * ProblemDisplay — the current arithmetic problem and the player's answer.
 *
 * Renders `left op right =` in large type with the entered digits (or a
 * dimmed placeholder) as the answer cell. The problem text and the answer
 * cell carry semantic testIDs for autonomous QA.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { GAME_ID } from '../types';
import type { MathProblem } from '../types';

export interface ProblemDisplayProps {
  problem: MathProblem;
  /** Digits currently entered by the player. */
  input: string;
}

export function ProblemDisplay({ problem, input }: ProblemDisplayProps) {
  const hasInput = input.length > 0;
  return (
    <View style={styles.row} testID={testId(GAME_ID, 'problem-text')} accessible>
      <ThemedText type="display" testID={testId(GAME_ID, 'problem-left')}>
        {problem.left}
      </ThemedText>
      <ThemedText type="display" themeColor="textSecondary">
        {problem.operator}
      </ThemedText>
      <ThemedText type="display" testID={testId(GAME_ID, 'problem-right')}>
        {problem.right}
      </ThemedText>
      {problem.secondOperator !== undefined ? (
        <>
          <ThemedText
            type="display"
            themeColor="textSecondary"
            testID={testId(GAME_ID, 'problem-second-op')}>
            {problem.secondOperator}
          </ThemedText>
          <ThemedText type="display" testID={testId(GAME_ID, 'problem-second-operand')}>
            {problem.secondOperand}
          </ThemedText>
        </>
      ) : null}
      <ThemedText type="display" themeColor="textSecondary">
        =
      </ThemedText>
      <ThemedText
        type="display"
        themeColor={hasInput ? 'text' : 'textSecondary'}
        testID={testId(GAME_ID, 'answer-input')}
        accessibilityLabel={`Your answer: ${hasInput ? input : 'empty'}`}>
        {hasInput ? input : '?'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    flexWrap: 'wrap',
  },
});
