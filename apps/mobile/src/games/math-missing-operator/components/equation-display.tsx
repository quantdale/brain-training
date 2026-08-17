/**
 * EquationDisplay — renders `a _ b = c` with the missing-operator slot.
 *
 * While playing (`reveal` is null) the slot shows a highlighted `?`; after a
 * round resolves, the parent passes the operator to reveal (the player's pick
 * when correct, the true operator otherwise) and the slot shows its glyph.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { testId } from '@/sdk';

import { GAME_ID, OPERATOR_GLYPHS } from '../types';
import type { Equation, Operator } from '../types';

export interface EquationDisplayProps {
  equation: Equation;
  /** Operator to reveal in the slot; null while the round is open. */
  reveal?: Operator | null;
  /** Semantic id for the container (e.g. `tutorial-equation`). */
  testID?: string;
}

export function EquationDisplay({
  equation,
  reveal = null,
  testID: containerTestId = testId(GAME_ID, 'equation'),
}: EquationDisplayProps) {
  const theme = useTheme();
  const glyph = reveal !== null ? OPERATOR_GLYPHS[reveal] : '?';

  return (
    <View
      style={styles.row}
      testID={containerTestId}
      accessibilityLabel={`${equation.a} question mark ${equation.b} equals ${equation.c}`}
      accessible>
      <ThemedText type="headline">{equation.a}</ThemedText>
      <View
        style={[styles.slot, { borderColor: reveal !== null ? theme.accent : theme.border }]}>
        <ThemedText
          type="headline"
          themeColor={reveal !== null ? 'accent' : 'textSecondary'}
          testID={testId(GAME_ID, 'operator-slot')}>
          {glyph}
        </ThemedText>
      </View>
      <ThemedText type="headline">{equation.b}</ThemedText>
      <ThemedText type="headline">=</ThemedText>
      <ThemedText type="headline">{equation.c}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  slot: {
    minWidth: 56,
    height: 56,
    borderRadius: Radii.medium,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
