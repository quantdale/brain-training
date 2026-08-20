/**
 * WordChips — the interactive word-tap surface for the Sentence Builder game.
 *
 * Renders scrambled words as tappable chips. Already-placed words are dimmed.
 * Preserves layout width across remounts via the `fieldWidth` prop from the parent.
 *
 * The list is memoized, and each chip is its own memoized leaf that invokes the
 * stable `onTapWord(index)` handler internally. This keeps an unchanged chip
 * from re-rendering when an unrelated chip is tapped (only the tapped chip's
 * `isTapped` changes).
 */
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface WordChipsProps {
  words: readonly string[];
  tappedIndices: readonly number[];
  disabled?: boolean;
  testID: string;
  onTapWord: (scrambledIndex: number) => void;
}

/** One tappable word. Memoized so only the tapped chip re-renders. */
const WordChip = memo(function WordChip({
  word,
  index,
  isTapped,
  disabled,
  testID,
  onTapWord,
}: {
  word: string;
  index: number;
  isTapped: boolean;
  disabled: boolean;
  testID: string;
  onTapWord?: (scrambledIndex: number) => void;
}) {
  const theme = useTheme();
  const isDisabled = disabled || isTapped;
  return (
    <Pressable
      testID={`${testID}.word.${index}`}
      accessibilityRole="button"
      accessibilityLabel={word}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onTapWord ? () => onTapWord(index) : undefined}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: isTapped ? theme.border : theme.accent,
          borderColor: isTapped ? theme.border : theme.accent,
          opacity: pressed ? 0.7 : isTapped ? 0.4 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: '#FFFFFF' }} numberOfLines={1}>
        {word}
      </ThemedText>
    </Pressable>
  );
});

export const WordChips = memo(function WordChips({
  words,
  tappedIndices,
  disabled = false,
  testID,
  onTapWord,
}: WordChipsProps) {
  const tappedSet = useMemo(() => new Set(tappedIndices), [tappedIndices]);

  return (
    <View style={styles.grid} testID={testID}>
      {words.map((word, index) => (
        <WordChip
          key={`${word}-${index}`}
          word={word}
          index={index}
          isTapped={tappedSet.has(index)}
          disabled={disabled}
          testID={testID}
          onTapWord={onTapWord}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.oneHalf,
    padding: Spacing.two,
    minHeight: 48,
  },
  chip: {
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    paddingVertical: Spacing.oneHalf,
    paddingHorizontal: Spacing.three,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
