/**
 * WorkoutCompletionCard — post-workout summary (campaign 010 / W24, extended
 * campaign 012 / W07).
 *
 * Presents a `WorkoutCompletionSummary` (Workout V2, `src/workout/summary.ts`)
 * after a workout finishes: headline + performance band, completion bar, the
 * meaningful metrics from constitution §16 (games, XP, play time), and — when
 * a game-name resolver is injected — a per-game outcome feed straight from the
 * engine's `outcomes` list. Purely presentational: no clock, db or registry
 * access; unknown game ids degrade to their raw id.
 */

import { StyleSheet, View } from 'react-native';

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
  resolveGameName,
  testID = 'workout-completion-card',
}: {
  summary: WorkoutCompletionSummary;
  /** Optional game-id → display-name resolver (registry injected by caller). */
  resolveGameName?: (gameId: string) => string | null;
  testID?: string;
}) {
  // Performance band over matched sessions; null average (no matched
  // session records) degrades to the neutral "Session complete" band.
  const band = performanceBand(summary.avgNormalized ?? -1);
  const parsed = parseInstanceKey(summary.key);
  const workoutName =
    (parsed.templateId ? getWorkoutTemplate(parsed.templateId)?.name : null) ??
    "Today's Workout";
  const playedOutcomes = summary.outcomes.flatMap((outcome) =>
    outcome.played && outcome.session
      ? [{ gameId: outcome.gameId, session: outcome.session }]
      : [],
  );

  return (
    <ThemedView
      type="surface"
      style={styles.card}
      testID={testID}
      accessibilityLiveRegion="polite">
      <ThemedText type="subtitle">Workout complete!</ThemedText>
      <ThemedText type="small" themeColor={band.tone} testID={`${testID}-band`}>
        {workoutName} — {band.label}
        {summary.avgNormalized !== null
          ? ` · ${Math.round(summary.avgNormalized * 100)}% avg`
          : ''}
      </ThemedText>
      <ProgressTrack ratio={summary.completionRatio} testID={`${testID}-bar`} />
      <ThemedText type="small" themeColor="textSecondary" testID={`${testID}-stats`}>
        {summary.completedGames}/{summary.totalGames} games · +
        {summary.totalXp} XP · {formatDurationMs(summary.totalDurationMs)}
      </ThemedText>
      {resolveGameName && playedOutcomes.length > 0 ? (
        <View testID={`${testID}-outcomes`} style={styles.outcomes}>
          {playedOutcomes.map(({ gameId, session }) => {
            const name = resolveGameName(gameId) ?? gameId;
            return (
              <View
                key={gameId}
                style={styles.outcomeRow}
                testID={`${testID}-outcome-${gameId}`}>
                <View style={styles.outcomeText}>
                  <ThemedText type="small">{name}</ThemedText>
                </View>
                <ThemedText
                  type="caption"
                  themeColor="textSecondary"
                  testID={`${testID}-outcome-result-${gameId}`}>
                  {Math.round(session.normalizedResult * 100)}% · +{session.xp}{' '}
                  XP
                </ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  outcomes: {
    gap: Spacing.oneHalf,
    marginTop: Spacing.half,
  },
  outcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  outcomeText: {
    flex: 1,
  },
});
