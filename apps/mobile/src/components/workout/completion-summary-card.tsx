/**
 * WorkoutCompletionCard — post-workout summary (campaign 010 / W24, extended
 * campaign 012 / W07; campaign 023 celebration).
 *
 * Presents a `WorkoutCompletionSummary` (Workout V2, `src/workout/summary.ts`)
 * after a workout finishes: headline + performance band, completion bar, the
 * meaningful metrics from constitution §16 (games, XP, play time), and — when
 * a game-name resolver is injected — a per-game outcome feed straight from the
 * engine's `outcomes` list. Purely presentational: no clock, db or registry
 * access; unknown game ids degrade to their raw id.
 *
 * Campaign 023: the card enters with a short bounded animation (skipped under
 * reduced motion), shows a trophy mark, and celebrates exactly once per
 * workout instance key (banner + canonical success feedback via the global
 * sensory service).
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { ProgressTrack, performanceBand } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usePrefersReducedMotion } from '@/components/game-ui/use-reduced-motion';
import { Elevation, Motion, Radii, Spacing } from '@/constants/theme';
import { liveAudioHaptics } from '@/sdk';
import { parseInstanceKey } from '@/workout/metadata';
import type { WorkoutCompletionSummary } from '@/workout/summary';
import { getWorkoutTemplate } from '@/workout/templates';
import { celebrateReward } from '@/rewards/celebration';
import { formatDurationMs } from './format';

/**
 * Workout keys already celebrated on this JS session. Prevents replaying the
 * celebration every time Home re-focuses and remounts the card; a fresh app
 * launch re-celebrates the latest completion once, which is the desired
 * post-workout moment.
 */
const celebratedKeys = new Set<string>();

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

  // ---- Campaign 023 celebration (once per workout instance key).
  const prefersReducedMotion = usePrefersReducedMotion();
  const entrance = useMemo(() => new Animated.Value(0), []);
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) {
      return;
    }
    firedRef.current = true;
    const firstTime = !celebratedKeys.has(summary.key);
    if (firstTime) {
      celebratedKeys.add(summary.key);
      liveAudioHaptics.feedback('success');
      celebrateReward({
        title: 'Workout complete!',
        xp: summary.totalXp,
        emoji: '🏆',
      });
    }
    if (prefersReducedMotion || !firstTime) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: Motion.entrance,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [summary.key, summary.totalXp, prefersReducedMotion, entrance]);

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
        ],
      }}>
      <ThemedView
        type="surface"
        style={styles.card}
        testID={testID}
        accessibilityLiveRegion="polite">
        <View style={styles.titleRow}>
          <View style={styles.trophyCircle}>
            <ThemedText type="subtitle" allowFontScaling={false}>
              🏆
            </ThemedText>
          </View>
          <ThemedText type="subtitle">Workout complete!</ThemedText>
        </View>
        <ThemedText type="small" themeColor={band.tone} testID={`${testID}-band`}>
          {workoutName} — {band.label}
          {summary.avgNormalized !== null
            ? ` · ${Math.round(summary.avgNormalized * 100)}% avg`
            : ''}
        </ThemedText>
        <ProgressTrack ratio={summary.completionRatio} tone="success" testID={`${testID}-bar`} />
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
    ...Elevation.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  trophyCircle: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(217, 142, 4, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
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
