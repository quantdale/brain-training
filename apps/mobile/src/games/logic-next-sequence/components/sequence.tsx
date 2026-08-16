/**
 * SequenceChips — the visible terms of a puzzle rendered as number chips,
 * followed by a slot for the missing next term.
 *
 * `nextValue === null` renders the open "?" slot (question phase); a number
 * renders the answer chip highlighted with the accent (round result).
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GAME_ID } from '../types';

export interface SequenceChipsProps {
  terms: readonly number[];
  /** Null = the open "?" slot; a number = the revealed continuation. */
  nextValue: number | null;
  /** Semantic testID of the chip row container. */
  testID: string;
}

export function SequenceChips({ terms, nextValue, testID }: SequenceChipsProps) {
  const theme = useTheme();
  return (
    <View style={styles.row} testID={testID} accessibilityLabel="Number sequence">
      {terms.map((value, index) => (
        <View
          key={index}
          style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}
          testID={testId(GAME_ID, 'sequence', 'term', String(index))}>
          <ThemedText type="bodyLarge" style={styles.number}>
            {value}
          </ThemedText>
        </View>
      ))}
      <View
        style={[styles.chip, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
        testID={testId(GAME_ID, 'sequence', 'next')}>
        <ThemedText
          type="bodyLarge"
          themeColor={nextValue === null ? 'textSecondary' : 'text'}
          style={styles.number}>
          {nextValue === null ? '?' : nextValue}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minWidth: 48,
    paddingVertical: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
});
