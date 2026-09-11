/**
 * Comparison — renders one Quick Compare round: the question, the two
 * stimulus cards, and the answer options.
 *
 * The component is pure presentation: it receives the round, the player's
 * current selection, and the resolved verdict (during feedback), and reports
 * option taps via `onSelect`. It never owns timing or scoring.
 *
 * Feedback language (Campaign 025): the question and both stimulus cards stay
 * mounted while a verdict shows, so the prompt is never covered (R3); the
 * option highlights come from the resolved `lastVerdict` (never the tap
 * handler): the correct option takes the success cue and, on a wrong pick, the
 * tapped option takes the danger cue at the same time (R2). On a timeout only
 * the correct option is revealed.
 *
 * Accessibility: each stimulus card exposes an `accessibilityLabel` so the
 * values are announced, and every option carries its verdict in the accessible
 * name through `OptionButton` (never colour alone).
 */
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { OptionButton } from './option-button';
import { testId } from '@/sdk';
import { GAME_ID } from '../types';
import type { CompareVerdict, QuickCompareRound } from '../types';

export interface ComparisonProps {
  readonly round: QuickCompareRound;
  readonly selectedIndex: number | null;
  readonly lastVerdict: CompareVerdict | null;
  readonly disabled: boolean;
  readonly onSelect: (index: number) => void;
  readonly testID: string;
}

export function Comparison({
  round,
  selectedIndex,
  lastVerdict,
  disabled,
  onSelect,
  testID,
}: ComparisonProps) {
  /** Resolved-round highlight for `index`; null while the round is open. */
  const highlightFor = (index: number): 'correct' | 'wrong' | null => {
    if (lastVerdict === null) {
      return null;
    }
    if (index === round.correctIndex) {
      return 'correct';
    }
    return lastVerdict === 'incorrect' && index === selectedIndex ? 'wrong' : null;
  };

  return (
    <View style={styles.container} testID={testID}>
      <ThemedText
        type="headline"
        style={styles.question}
        testID={`${testID}-question`}>
        {round.question}
      </ThemedText>

      <View style={styles.cards} testID={`${testID}-cards`} accessible={false}>
        <View
          style={styles.card}
          accessibilityLabel={`Left: ${round.left.display}`}
          testID={`${testID}-left`}>
          <ThemedText type="small" themeColor="textSecondary">
            Left
          </ThemedText>
          <ThemedText type="title" testID={`${testID}-left-value`}>
            {round.left.display}
          </ThemedText>
        </View>
        <View
          style={styles.card}
          accessibilityLabel={`Right: ${round.right.display}`}
          testID={`${testID}-right`}>
          <ThemedText type="small" themeColor="textSecondary">
            Right
          </ThemedText>
          <ThemedText type="title" testID={`${testID}-right-value`}>
            {round.right.display}
          </ThemedText>
        </View>
      </View>

      <View style={styles.options}>
        {round.optionLabels.map((label, index) => (
          <OptionButton
            key={index}
            testID={testId(GAME_ID, 'option', String(index))}
            label={label}
            highlight={highlightFor(index)}
            disabled={disabled}
            onPress={() => onSelect(index)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  question: {
    textAlign: 'center',
  },
  cards: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    gap: Spacing.one,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.3)',
  },
  options: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
  },
});
