/**
 * Progress — static placeholder summary (Wave 1).
 *
 * Renders the summary slot with placeholder values. Real summaries (overall +
 * per-domain histories, records, activity) come from the persistence layer in
 * later waves; testID `progress-summary` is the stable QA contract.
 */

import { StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

export default function ProgressScreen() {
  return (
    <ScreenShell>
      <ThemedText type="title" testID="progress-title">
        Progress
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Your training history, ratings and records will live here.
      </ThemedText>

      <ThemedView type="surface" style={styles.summaryCard} testID="progress-summary">
        <ThemedText type="subtitle">Summary</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your progress summary will appear here after your first sessions.
        </ThemedText>
        <View style={styles.placeholderRows}>
          <PlaceholderRow label="Sessions" value="0" />
          <PlaceholderRow label="Average score" value="—" />
          <PlaceholderRow label="Best streak" value="0 days" />
        </View>
      </ThemedView>
    </ScreenShell>
  );
}

function PlaceholderRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  placeholderRows: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
