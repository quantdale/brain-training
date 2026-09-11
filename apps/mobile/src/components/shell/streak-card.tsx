/**
 * StreakCard — Home engagement surface.
 *
 * Reference anatomy (Imprint/Foodvisor streak beat, `PATTERNS-PLAY` 18): flame
 * with count → "N day streak" → day strip → next-milestone tease, in that
 * order and no longer. The count is the hero numeral; the strip shows weekly
 * shape; the tease gives the streak somewhere to go.
 *
 * Purely presentational: the caller owns date loading and reconstruction, and
 * `@/streaks` owns what counts as activity (freeze/recovery dates count).
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { STREAK_MILESTONES, previousDate, toUtcDate } from '@/streaks';
import { Radii, Spacing } from '@/theme/tokens';

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
  // Next unreached milestone, so the streak always has a visible next step.
  const nextMilestone = STREAK_MILESTONES.find((milestone) => milestone.days > current);
  const daysToNext = nextMilestone ? nextMilestone.days - current : null;
  const accessibilityLabel = `${current} day streak. ${activeCount} active day${
    activeCount === 1 ? '' : 's'
  } in the last week.${
    daysToNext !== null && nextMilestone
      ? ` ${daysToNext} day${daysToNext === 1 ? '' : 's'} to ${nextMilestone.label}.`
      : ''
  }${atRisk ? ' Play today to keep your streak alive.' : ''}`;

  return (
    <Card variant="plain" testID={testID} accessibilityLabel={accessibilityLabel}>
      <View style={styles.header}>
        <View style={[styles.flameCircle, { backgroundColor: theme.streakSoft }]}>
          <ThemedText type="bodyLarge" allowFontScaling={false} testID={`${testID}-flame`}>
            🔥
          </ThemedText>
        </View>
        <View style={styles.headerText}>
          <ThemedText
            type="numeralXl"
            style={[styles.count, { color: theme.streak }]}
            testID="home-stat-streak">
            {current}
          </ThemedText>
          <ThemedText type="bodySmall" themeColor="textSecondary">
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
            <View
              key={day}
              style={styles.dayColumn}
              testID={`${testID}-day-${index}`}
              accessible
              accessibilityLabel={`${initial}: ${
                isToday && isActive
                  ? 'today, active'
                  : isToday
                    ? 'today, not yet active'
                    : isActive
                      ? 'active'
                      : 'rest day'
              }`}>
              <View
                style={[
                  styles.dot,
                  isActive
                    ? { backgroundColor: theme.streak }
                    : { backgroundColor: theme.surfaceSunken },
                  // Today reads as a ring rather than a colour, so the "today"
                  // position survives a colour-blind or greyscale rendering.
                  isToday && { borderColor: theme.streak, borderWidth: 2 },
                ]}>
                {isActive ? (
                  <ThemedText type="caption" allowFontScaling={false} style={{ color: theme.streakOn }}>
                    ✓
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText type="caption" themeColor={isToday ? 'text' : 'textMuted'} allowFontScaling={false}>
                {initial}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {daysToNext !== null && nextMilestone ? (
        <ThemedText type="caption" themeColor="textSecondary" testID={`${testID}-next-milestone`}>
          {daysToNext} day{daysToNext === 1 ? '' : 's'} to {nextMilestone.label}
          {nextMilestone.rewardXp ? ` · +${nextMilestone.rewardXp} XP` : ''}
        </ThemedText>
      ) : null}

      {atRisk ? (
        <View
          style={[styles.atRisk, { backgroundColor: theme.warningSoft }]}
          testID="home-streak-at-risk">
          <ThemedText type="caption" themeColor="warningSoftText">
            Play today to keep your streak alive.
          </ThemedText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  count: {
    lineHeight: undefined,
  },
  flameCircle: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tracker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  dayColumn: {
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atRisk: {
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.oneHalf,
    marginTop: Spacing.two,
  },
});
