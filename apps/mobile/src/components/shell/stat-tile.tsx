/**
 * StatTile — compact value/label tile for dashboard stat rows (W13).
 *
 * Matches the Home stat-card visual contract exactly (headline accent value
 * over a secondary caption) so screens can share one component without visual
 * drift.
 */

import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

export function StatTile({
  value,
  label,
  testID,
}: {
  value: string;
  label: string;
  testID?: string;
}) {
  return (
    <ThemedView type="surface" style={styles.tile} testID={testID}>
      <ThemedText type="headline" themeColor="accent">
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: Spacing.half,
  },
});
