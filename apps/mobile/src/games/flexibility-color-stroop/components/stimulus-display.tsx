/**
 * Stimulus display — shows the color word in its ink color.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { STROOP_COLOR_HEX } from '../types';
import type { StroopColor } from '../types';

interface StimulusDisplayProps {
  word: string;
  inkColor: StroopColor;
  testID?: string;
}

export function StimulusDisplay({ word, inkColor, testID }: StimulusDisplayProps) {
  const theme = useTheme();
  const hexColor = STROOP_COLOR_HEX[inkColor];

  return (
    <View style={styles.container} testID={testID}>
      <ThemedText
        type="display"
        style={{ color: hexColor, fontWeight: '700' }}
        accessibilityLabel={`Word: ${word}, ink color: ${inkColor}`}>
        {word}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.five,
    minHeight: 120,
  },
});