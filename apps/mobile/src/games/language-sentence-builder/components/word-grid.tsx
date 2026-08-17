/**
 * WordChips — the interactive word-tap surface for the Sentence Builder game.
 *
 * Renders scrambled words as tappable chips. Already-placed words are dimmed.
 * Preserves layout width across remounts via the `fieldWidth` prop from the parent.
 */
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { testId } from '@/sdk';

export interface WordChipsProps {
  words: readonly string[];
  tappedIndices: readonly number[];
  disabled?: boolean;
  testID: string;
  onTapWord: (scrambledIndex: number) => void;
}

export function WordChips({
  words,
  tappedIndices,
  disabled = false,
  testID,
  onTapWord,
}: WordChipsProps) {
  const theme = useTheme();
  const tappedSet = useMemo(() => new Set(tappedIndices), [tappedIndices]);

  return (
    <View style={styles.grid} testID={testID}>
      {words.map((word, index) => {
        const isTapped = tappedSet.has(index);
        return (
          <Pressable
            key={`${word}-${index}`}
            testID={`${testID}.word.${index}`}
            accessibilityRole="button"
            accessibilityLabel={word}
            accessibilityState={{ disabled: disabled || isTapped }}
            disabled={disabled || isTapped}
            onPress={() => onTapWord(index)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: isTapped ? theme.border : theme.accent,
                borderColor: isTapped ? theme.border : theme.accent,
                opacity: pressed ? 0.7 : isTapped ? 0.4 : 1,
              },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: '#FFFFFF' }}
              numberOfLines={1}>
              {word}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

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
