/**
 * StreakCard — Home engagement hero (campaign 023).
 *
 * Presents the reconstructed streak state as a vibrant first-viewport card:
 * flame mark, current day count, and a trailing 7-day activity tracker built
 * from authoritative session/coverage dates (freeze/recovery dates count as
 * active, matching the shared streak model in `@/streaks`). An at-risk nudge
 * renders when today has no activity yet. Purely presentational: the caller
 * owns date loading and reconstruction.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { previousDate, toUtcDate } from '@/streaks';

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const TRACKER_DAYS = 7;

export interface StreakCardProps {
  /** Effective current streak length in days. */
  current: number;
  /** Local YYYY-MM-DD activity dates from session history. */
  activityDates: readonly string[];
  /** Freeze/recovery dates that count as activity in the streak model. */
  coveredDates?: readonly string[];
  /** Today's local YYYY-MM-DD. */
  today: string;
  /** True when today has no qualifying activity yet. */
  atRisk?: boolean;
  testID?: string;
}

export function StreakCard({
  current,
  activityDates,
  coveredDates = [],
  today,
  atRisk = false,
  testID = 'home-streak-card',
}: StreakCardProps) {
  const theme = useTheme();
  const activeDates = useMemo(
    () => new Set([...activityDates, ...coveredDates]),
    [activityDates, coveredDates],
  );

  // Trailing 7 calendar days ending today (oldest first) for the tracker row.
  const days = useMemo(() => {
    const out: string[] = [];
    let cursor = today;
    for (let i = 0; i < TRACKER_DAYS; i += 1) {
      out.unshift(cursor);
      cursor = previousDate(cursor);
    }
    return out;
  }, [today]);

  const activeCount = days.filter((day) => activeDates.has(day)).length;
  const accessibilityLabel = `${current} day streak. ${activeCount} active day${
    activeCount === 1 ? '' : 's'
  } in the last week.${atRisk ? ' Play today to keep your streak alive.' : ''}`;

  return (
    <ThemedView
      type="surface"
      style={styles.card}
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}>
      <View style={styles.header}>
        <View style={[styles.flameCircle, { backgroundColor: theme.streakSoft }]}>
          <ThemedText type="subtitle" allowFontScaling={false} testID={`${testID}-flame`}>
            🔥
          </ThemedText>
        </View>
        <View style={styles.headerText}>
          <ThemedText
            type="display"
            style={[styles.count, { color: theme.streak }]}
            testID="home-stat-streak">
            {current}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            day streak
          </ThemedText>
        </View>
      </View>

      <View style={styles.tracker} testID={`${testID}-tracker`}>
        {days.map((day, index) => {
          const isActive = activeDates.has(day);
          const isToday = day === today;
          const parsed = toUtcDate(day);
          const initial = parsed ? WEEKDAY_INITIALS[parsed.getUTCDay()] : '·';
          return (
            <View key={day} style={styles.dayColumn} testID={`${testID}-day-${index}`}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive ? theme.streak : theme.backgroundElement,
                    borderColor: isToday ? theme.streak : 'transparent',
                  },
                ]}
              />
              <ThemedText
                type="caption"
                themeColor={isToday ? 'text' : 'textSecondary'}
                allowFontScaling={false}>
                {initial}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {atRisk ? (
        <View
          style={[styles.atRisk, { backgroundColor: theme.warningSoft }]}
          testID="home-streak-at-risk">
          <ThemedText type="caption" themeColor="warning">
            Play today to keep your streak alive.
          </ThemedText>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.three,
    gap: Spacing.twoHalf,
    ...Elevation.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  flameCircle: {
    width: 52,
    height: 52,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    justifyContent: 'center',
  },
  count: {
    fontWeight: '700',
  },
  tracker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayColumn: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: Radii.pill,
    borderWidth: 2,
  },
  atRisk: {
    borderRadius: Radii.medium,
    paddingVertical: Spacing.oneHalf,
    paddingHorizontal: Spacing.two,
  },
});
