/**
 * WorkoutCompletionCard — post-workout summary (campaign 010 / W24).
 *
 * Presents a `WorkoutCompletionSummary` (Workout V2, `src/workout/summary.ts`)
 * after a workout finishes: headline + performance band, completion bar, and
 * the meaningful metrics from constitution §16 (games, XP, play time). Purely
 * presentational: the summary is computed by the engine/repository, game
 * names come from an injected resolver, and no clock is read.
 */

import { StyleSheet } from 'react-native';

import { ProgressTrack, performanceBand } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { parseInstanceKey } from '@/workout/metadata';
import type { WorkoutCompletionSummary } from '@/workout/summary';
import { getWorkoutTemplate } from '@/workout/templates';
import { formatDurationMs } from './format';

export function WorkoutCompletionCard({
  summary,
  testID = 'workout-completion-card',
}: {
  summary: WorkoutCompletionSummary;
  testID?: string;
}) {
  // Performance band over matched sessions; null average (no matched
  // session records) degrades to the neutral "Session complete" band.
  const band = performanceBand(summary.avgNormalized ?? -1);
  const parsed = parseInstanceKey(summary.key);
  const workoutName =
    (parsed.templateId ? getWorkoutTemplate(parsed.templateId)?.name : null) ??
    "Today's Workout";

  return (
    <ThemedView
      type="surface"
      style={styles.card}
      testID={testID}
      accessibilityLiveRegion="polite">
      <ThemedText type="subtitle">Workout complete!</ThemedText>
      <ThemedText type="small" themeColor={band.tone} testID={`${testID}-band`}>
        {workoutName} — {band.label}
      </ThemedText>
      <ProgressTrack ratio={summary.completionRatio} testID={`${testID}-bar`} />
      <ThemedText type="small" themeColor="textSecondary" testID={`${testID}-stats`}>
        {summary.completedGames}/{summary.totalGames} games · +
        {summary.totalXp} XP · {formatDurationMs(summary.totalDurationMs)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
});
