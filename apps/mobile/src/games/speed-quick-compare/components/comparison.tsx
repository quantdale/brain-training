/**
 * Comparison — renders one Quick Compare round: the question, the two
 * stimulus cards, and the answer options.
 *
 * The component is pure presentation: it receives the round, the player's
 * current selection, and the resolved verdict (during feedback), and reports
 * option taps via `onSelect`. It never owns timing or scoring.
 *
 * Accessibility: each stimulus card exposes an `accessibilityLabel` so the
 * values are announced (color is never the only signal), and every option is
 * a labelled `GameButton`. The correct answer is highlighted during feedback
 * without leaking the answer before the player commits (the highlight only
 * appears after `selectedIndex` is set).
 */
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { GameButton } from './button';
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
        {round.optionLabels.map((label, index) => {
          const isSelected = selectedIndex === index;
          const isCorrect = lastVerdict !== null && index === round.correctIndex;
          const isWrongPick = lastVerdict === 'incorrect' && isSelected;
          return (
            <GameButton
              key={index}
              testID={testId(GAME_ID, 'option', String(index))}
              label={label}
              variant={isWrongPick ? 'danger' : 'primary'}
              selected={isCorrect}
              disabled={disabled}
              hint={`Answer: ${label}`}
              onPress={() => onSelect(index)}
            />
          );
        })}
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
