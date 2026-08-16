/**
 * Home — dashboard placeholder (Wave 1).
 *
 * Static slots per PROJECT_CONSTITUTION §13, in first-viewport order:
 * Today's Workout CTA, streak/XP/level stats, recent games. All data is
 * placeholder; persistence and the workout generator arrive in later waves.
 * Slot testIDs are the stable QA contract.
 */

import { StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <ScreenShell>
      <ThemedText type="caption" themeColor="accent" testID="home-brand">
        BRAIN TRAINING
      </ThemedText>
      <ThemedText type="title" testID="home-title">
        Home
      </ThemedText>

      {/* Today's Workout CTA slot — static until the daily-workout generator lands. */}
      <ThemedView type="surface" style={styles.ctaCard} testID="home-workout-cta">
        <ThemedText type="subtitle">Today's Workout</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your daily 4-game training plan will appear here. The workout generator
          arrives in a later wave.
        </ThemedText>
        <ThemedView type="accentSoft" style={styles.ctaPill}>
          <ThemedText type="smallBold" themeColor="accent">
            Coming soon
          </ThemedText>
        </ThemedView>
      </ThemedView>

      {/* Streak / XP / level slot — static placeholder values. */}
      <View style={styles.statsRow}>
        <StatCard testID="home-stat-streak" label="Streak" value="0 days" />
        <StatCard testID="home-stat-xp" label="XP" value="0" />
        <StatCard testID="home-stat-level" label="Level" value="1" />
      </View>

      {/* Recent games slot — empty until sessions are persisted. */}
      <ThemedView type="surface" style={styles.recentCard} testID="home-recent-games">
        <ThemedText type="subtitle">Recent games</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your latest sessions will show up here after your first workout.
        </ThemedText>
      </ThemedView>
    </ScreenShell>
  );
}

function StatCard({
  testID,
  label,
  value,
}: {
  testID: string;
  label: string;
  value: string;
}) {
  return (
    <ThemedView type="surface" style={styles.statCard} testID={testID}>
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
  ctaCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  ctaPill: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statCard: {
    flex: 1,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  recentCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
});
