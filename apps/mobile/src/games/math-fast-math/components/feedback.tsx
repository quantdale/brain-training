/**
 * FeedbackPanel — per-problem result card shown after each answer.
 *
 * Reports correct/incorrect/timeout with the problem and the expected answer
 * (learning value), then advances to the next problem or to the results.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
  // Verdicts change fill AND icon/shape, never colour alone: the panel takes
  // the verdict family's soft fill and pairs the headline with a glyph
  // badge (✓ correct / ✕ incorrect / ⏱ timeout). The badge is an opaque
  // verdict-family fill with its `*On` glyph, so the icon reads on the tint.
  const verdict =
    outcome === 'correct'
      ? {
          title: 'Correct!',
          glyph: '✓',
          soft: theme.successSoft,
          badge: theme.success,
          glyphColor: theme.successOn,
          text: 'success' as const,
          testID: 'feedback-correct',
        }
      : outcome === 'incorrect'
        ? {
            title: 'Not quite',
            glyph: '✕',
            soft: theme.dangerSoft,
            badge: theme.danger,
            glyphColor: theme.dangerOn,
            text: 'danger' as const,
            testID: 'feedback-incorrect',
          }
        : {
            title: "Time's up",
            glyph: '⏱',
            soft: theme.warningSoft,
            badge: theme.warning,
            glyphColor: theme.warningOn,
            text: 'warning' as const,
            testID: 'feedback-timeout',
          };
  const expected =
    outcome === 'correct' ? null : `The answer was ${problem.answer}`;
  return (
    <View
      style={[styles.card, { backgroundColor: verdict.soft }]}
      testID={testId(GAME_ID, 'feedback')}>
      <View
        style={[styles.badge, { backgroundColor: verdict.badge }]}
        importantForAccessibility="no-hide-descendants">
        <ThemedText type="headline" style={{ color: verdict.glyphColor }} allowFontScaling={false}>
          {verdict.glyph}
        </ThemedText>
      </View>
      <ThemedText
        type="headline"
        themeColor={verdict.text}
        testID={testId(GAME_ID, verdict.testID)}>
        {verdict.title}
      </ThemedText>
      <ThemedText type="bodyLarge" testID={testId(GAME_ID, 'feedback-problem')}>
        {problem.left} {problem.operator} {problem.right}
        {problem.secondOperator !== undefined
          ? ` ${problem.secondOperator} ${problem.secondOperand}`
          : ''}{' '}
        ={' '}
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
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  // Opaque verdict badge: the icon/shape half of the verdict channel.
  badge: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
