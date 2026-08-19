/**
 * ResultRow — shared label/value row for result surfaces (task 10.2).
 *
 * Used on per-game results screens and the global `/results` screen.
 * No game mechanics: just themed typography + layout.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';

export interface ResultRowProps {
  label: string;
  value: string;
  /** Optional semantic testID for the value node (callers compose via `testId`). */
  testID?: string;
}

export function ResultRow({ label, value, testID }: ResultRowProps) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" testID={testID}>
        {value}
      </ThemedText>
    </View>
  );
}

/** Variant used inside compact game results (value in bodyLarge). */
export function StatRow({ label, value, testID }: ResultRowProps) {
  return (
    <View style={styles.statRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="bodyLarge" testID={testID}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
  },
});
