/**
 * WorkoutCompletionCard — post-workout summary (campaign 010 / W24, extended
 * campaign 012 / W07; campaign 023 celebration; campaign 026 identity).
 *
 * Presents a `WorkoutCompletionSummary` (Workout V2, `src/workout/summary.ts`)
 * after a workout finishes: the completion beat (mark + headline + band),
 * a kit `ProgressBar` meter, the meaningful metrics from constitution §16
 * (games, XP, play time) as equal `StatBlock` columns, and — when a game-name
 * resolver is injected — a per-game outcome feed of `ListRow`s straight from
 * the engine's `outcomes` list. Purely presentational: no clock, db or
 * registry access; unknown game ids degrade to their raw id.
 *
 * Campaign 023: the card enters with a short bounded animation (skipped under
 * reduced motion) and celebrates exactly once per workout instance key
 * (canonical success feedback via the global sensory service). Campaign 026
 * replaces the emoji trophy with the code-native `Spark` mark and the legacy
 * shell `ProgressTrack` with the kit meter; all testIDs are unchanged.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { performanceBand } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { usePrefersReducedMotion } from '@/components/game-ui/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { Card, ListRow, ProgressBar, Spark, StatBlock } from '@/components/ui';
import { Motion, Spacing } from '@/constants/theme';
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
  const theme = useTheme();
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
      <Card
        variant="raised"
        padding="lg"
        style={styles.card}
        testID={testID}
        accessibilityLiveRegion="polite">
        <View style={styles.titleRow}>
          <View style={[styles.mark, { backgroundColor: theme.xpSoft }]}>
            <Spark size={20} color={theme.xpSoftText} />
          </View>
          <View style={styles.titleText}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              {workoutName}
            </ThemedText>
            <ThemedText type="headline">Workout complete!</ThemedText>
          </View>
        </View>
        <ThemedText type="bodySmall" themeColor={band.tone} testID={`${testID}-band`}>
          {band.label}
          {summary.avgNormalized !== null
            ? ` · ${Math.round(summary.avgNormalized * 100)}% avg`
            : ''}
        </ThemedText>
        <ProgressBar
          value={summary.completionRatio}
          tone="success"
          accessibilityLabel={`Workout progress, ${summary.completedGames} of ${summary.totalGames} games`}
          testID={`${testID}-bar`}
        />
        <View style={styles.metrics} testID={`${testID}-stats`}>
          <View style={styles.metric}>
            <StatBlock
              label="Games"
              value={`${summary.completedGames}/${summary.totalGames}`}
              metric="score"
              valueType="numeral"
            />
          </View>
          <View style={styles.metric}>
            <StatBlock
              label="XP"
              value={`+${summary.totalXp}`}
              metric="xp"
              valueType="numeral"
            />
          </View>
          <View style={styles.metric}>
            <StatBlock
              label="Time"
              value={formatDurationMs(summary.totalDurationMs)}
              metric="time"
              valueType="numeral"
            />
          </View>
        </View>
        {resolveGameName && playedOutcomes.length > 0 ? (
          <View testID={`${testID}-outcomes`} style={styles.outcomes}>
            {playedOutcomes.map(({ gameId, session }) => {
              const name = resolveGameName(gameId) ?? gameId;
              return (
                <ListRow
                  key={gameId}
                  testID={`${testID}-outcome-${gameId}`}
                  title={name}
                  meta={`${Math.round(session.normalizedResult * 100)}% · +${session.xp} XP`}
                  metaTestID={`${testID}-outcome-result-${gameId}`}
                  icon={<Spark size={12} color={theme.successSoftText} />}
                  tone="successSoft"
                />
              );
            })}
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  // Reward mark tile: code-native Spark on the XP soft fill (no image asset).
  mark: {
    width: 40,
    height: 40,
    borderRadius: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    flex: 1,
    gap: Spacing.half,
  },
  metrics: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.three,
    marginTop: Spacing.half,
  },
  metric: {
    flex: 1,
  },
  outcomes: {
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
});
