/**
 * ScrambledDisplay — shows the scrambled word and category hint.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { GAME_ID } from '../types';

export interface ScrambledDisplayProps {
  scrambled: string;
  category: string;
}

export function ScrambledDisplay({ scrambled, category }: ScrambledDisplayProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="caption" themeColor="textSecondary" testID={testId(GAME_ID, 'category')}>
        Hint: {category}
      </ThemedText>
      <ThemedText
        type="headline"
        themeColor="text"
        testID={testId(GAME_ID, 'scrambled-word')}
        style={styles.scrambled}>
        {scrambled.toUpperCase()}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Unscramble the letters
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  scrambled: {
    letterSpacing: 6,
    fontSize: 28,
  },
});
