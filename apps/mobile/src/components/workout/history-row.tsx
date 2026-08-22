/**
 * WorkoutHistoryRow — one compact recent-workout row (campaign 010 / W24,
 * extended campaign 012 / W07).
 *
 * Renders a `WorkoutCompletionSummary` from the engine's history API
 * (`useWorkoutTemplates.history`) as a single non-interactive row: workout
 * name (with its length variant for template workouts, so "Math Focus · Short"
 * and "Math Focus · Extended" read as distinct sessions), relative day,
 * progress, and XP. The clock is injected (`nowMs`) so the relative-day label
 * stays deterministic under test.
 */

import { StyleSheet, View } from 'react-native';

import { formatRelativeDay } from '@/components/shell/format';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { parseInstanceKey } from '@/workout/metadata';
import type { WorkoutCompletionSummary } from '@/workout/summary';
import { getWorkoutTemplate, WORKOUT_LENGTHS } from '@/workout/templates';
import { localDayStartMs } from './format';

export function WorkoutHistoryRow({
  summary,
  nowMs,
  testID,
}: {
  summary: WorkoutCompletionSummary;
  /** Clock injection: caller passes Date.now() so labels stay testable. */
  nowMs: number;
  testID?: string;
}) {
  const parsed = parseInstanceKey(summary.key);
  const baseName =
    (parsed.templateId ? getWorkoutTemplate(parsed.templateId)?.name : null) ??
    "Today's Workout";
  // Template rows carry their length variant in the instance key — surface it
  // so two sessions of the same template never look identical. Daily rows are
  // always standard and stay unsuffixed.
  const lengthLabel = parsed.templateId
    ? (WORKOUT_LENGTHS.find((spec) => spec.id === parsed.length)?.label ?? null)
    : null;
  const name = lengthLabel ? `${baseName} · ${lengthLabel}` : baseName;
  // Prefer the matched-session completion time; fall back to local midnight
  // of the instance's own date (NaN-safe: formatRelativeDay renders "—").
  const dayLabel = formatRelativeDay(
    summary.finishedAt ?? localDayStartMs(summary.date),
    nowMs,
  );
  const progressLabel =
    summary.status === 'completed'
      ? `${summary.completedGames}/${summary.totalGames} games`
      : `${summary.completedGames}/${summary.totalGames} games · In progress`;

  return (
    <View
      style={styles.row}
      testID={testID}
      accessibilityLabel={`${name}, ${dayLabel}, ${progressLabel}, plus ${summary.totalXp} XP`}>
      <View style={styles.text}>
        <ThemedText type="small" testID={testID ? `${testID}-name` : undefined}>
          {name}
        </ThemedText>
        <ThemedText
          type="caption"
          themeColor="textSecondary"
          testID={testID ? `${testID}-detail` : undefined}>
          {dayLabel} · {progressLabel}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" testID={testID ? `${testID}-xp` : undefined}>
        +{summary.totalXp} XP
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
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
