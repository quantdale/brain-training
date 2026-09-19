/**
 * ResultRow — shared label/value row for result surfaces (task 10.2).
 *
 * Used on per-game results screens and the global `/results` screen.
 * No game mechanics: just themed typography + layout.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { HAIRLINE } from '@/components/ui/radius';
import { Spacing } from '@/constants/theme';

export interface ResultRowProps {
  label: string;
  value: string;
  /** Optional semantic testID for the value node (callers compose via `testId`). */
  testID?: string;
}

export function ResultRow({ label, value, testID }: ResultRowProps) {
  const theme = useTheme();
  return (
    <View style={[styles.row, styles.divider, { borderBottomColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" testID={testID}>
        {value}
      </ThemedText>
    </View>
  );
}

/**
 * Variant used inside compact game results. Campaign 055 report grammar: rows
 * are separated by hairlines instead of floating in a gap list, and the value
 * stays readable without out-shouting the result headline above it.
 */
export function StatRow({ label, value, testID }: ResultRowProps) {
  const theme = useTheme();
  return (
    <View style={[styles.statRow, styles.divider, { borderBottomColor: theme.border }]}>
      <ThemedText type="bodySmall" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="body" testID={testID} style={styles.statValue}>
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
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  statValue: {
    fontWeight: '700',
  },
  divider: {
    borderBottomWidth: HAIRLINE,
  },
});
