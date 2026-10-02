/**
 * `StatRow` — shared label/value row for result surfaces (task 10.2).
 *
 * Used on per-game results screens and the global `/results` screen.
 * No game mechanics: just themed typography + layout.
 *
 * Each row is ONE accessible statement (`label: value`): the two visual
 * columns are read as a single fact instead of two unrelated nodes (065).
 *
 * 071: the `ResultRow` component that used to share this file is removed — it
 * had zero importers, and `StatRow` is the live twin every result surface
 * actually renders. Two names for one layout in one file is how a reader ends
 * up editing the one nothing uses.
 */
import { StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { HAIRLINE } from '@/components/ui/radius';
import { Spacing } from '@/constants/theme';

export interface StatRowProps {
  label: string;
  value: string;
  /** Optional semantic testID for the value node (callers compose via `testId`). */
  testID?: string;
}

export function StatRow({ label, value, testID }: StatRowProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.statRow, styles.divider, { borderBottomColor: theme.border }]}
      accessible
      accessibilityLabel={`${label}: ${value}`}>
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
    minHeight: MIN_TOUCH_TARGET,
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
