/**
 * ColorSwatch — displays a color swatch with a color name label.
 *
 * The swatch shows the actual color visually, while the label text is rendered
 * in a potentially different color (congruent or incongruent Stroop trial).
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { testId } from '@/sdk';

import { COLOR_HEX, GAME_ID, type ColorName } from '../types';

export interface ColorSwatchProps {
  swatchColor: ColorName;
  labelColor: ColorName;
  testID?: string;
}

export function ColorSwatch({ swatchColor, labelColor, testID }: ColorSwatchProps) {
  return (
    <View style={styles.container} testID={testID}>
      <View
        style={[styles.swatch, { backgroundColor: COLOR_HEX[swatchColor] }]}
        testID={testId(GAME_ID, 'swatch')}
      />
      <ThemedText
        type="headline"
        style={{ color: COLOR_HEX[labelColor] }}
        testID={testId(GAME_ID, 'label')}>
        {swatchColor.toUpperCase()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  swatch: {
    width: 120,
    height: 120,
    borderRadius: Radii.large,
  },
});
