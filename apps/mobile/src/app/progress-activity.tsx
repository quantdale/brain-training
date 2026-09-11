/**
 * Activity calendar — `/progress-activity`.
 *
 * A full-frequency view of training over time. Built only from completion
 * timestamps (bucketing by UTC day, matching the rest of the product). This is a
 * frequency view, not an engagement/streak score — it simply shows how often
 * training happened.
 *
 * V2 (campaign 010) additions: consecutive active-day runs inside the window
 * (window-local frequency, not the engagement streak), a weekday-pattern
 * distribution, and a month-by-month rollup — all pure restatements of the
 * same stored completion timestamps.
 */

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  activeRuns,
  activityFrequencyBuckets,
  buildActivityCalendar,
  daysSinceLastSession,
  explainMetric,
  loadProgressSnapshot,
  monthlyActivity,
  weekdayDistribution,
  type CalendarDay,
  type ProgressSnapshot,
} from '@/analytics';
import { ScreenShell } from '@/components/screen-shell';
import { StateCard } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { HeatmapRow, LabeledBars } from '@/components/progress-charts';
import { BackLink, Card, EmptyState, ListRow, SectionGrid, Skeleton, SkeletonText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { AppDatabase } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { formatDayLabel } from '@/analytics/format';

const CALENDAR_DAYS = 182; // ~26 weeks

const EMPTY: ProgressSnapshot = {
  ratings: [],
  ratingHistory: [],
  sessions: [],
  aggregates: [],
  totalXp: 0,
  balance: 0,
};

function load(db: AppDatabase): Promise<ProgressSnapshot> {
  return loadProgressSnapshot(db, Date.now());
}

export default function ProgressActivityScreen() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data, loaded, error } = useDbData(load, [refreshKey], EMPTY);
  // Recovery action for the error state: bumping the key reruns the load.
  const retry = useCallback(() => setRefreshKey((k) => k + 1), []);

  const calendar = useMemo(
    () => buildActivityCalendar(data.sessions, CALENDAR_DAYS, nowMs),
    [data.sessions, nowMs],
  );
  const buckets = useMemo(() => activityFrequencyBuckets(calendar), [calendar]);
  const daysSinceLast = useMemo(
    () => daysSinceLastSession(data.sessions, nowMs),
    [data.sessions, nowMs],
  );

  // V2: runs, weekday pattern and monthly rollup over the same window.
  const runs = useMemo(() => activeRuns(calendar), [calendar]);
  const weekdays = useMemo(() => weekdayDistribution(calendar), [calendar]);
  const months = useMemo(() => monthlyActivity(calendar), [calendar]);

  const maxCount = calendar.busiest?.count ?? 0;

  return (
    <ScreenShell>
      <BackLink testID="progress-activity-back" onPress={() => router.back()} />

      <ThemedText type="title" testID="progress-activity-title">
        Activity
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        How often you trained over the last ~6 months.
      </ThemedText>

      {!loaded ? (
        <>
          <Skeleton height={160} testID="progress-activity-loading" />
          <SkeletonText lines={3} testID="progress-activity-loading-text" />
        </>
      ) : error ? (
        <StateCard
          variant="error"
          title="Couldn't load activity"
          message="Your training history is unavailable right now."
          testID="progress-activity-error"
          action={{ label: 'Try again', onPress: retry }}
        />
      ) : calendar.totalSessions === 0 ? (
        <Card>
          <EmptyState
            title="No sessions yet"
            message="Play a game to fill this calendar."
            actionLabel="Browse games"
            onAction={() => router.push('/games')}
            testID="progress-activity-empty"
          />
        </Card>
      ) : (
        <>

      <Card testID="progress-activity-summary">
        <View style={styles.summaryRow}>
          <SummaryStat label="Sessions" value={String(calendar.totalSessions)} />
          <SummaryStat label="Active days" value={String(calendar.activeDays)} />
          <SummaryStat
            label="Avg / active day"
            value={calendar.avgPerActiveDay > 0 ? calendar.avgPerActiveDay.toFixed(1) : '—'}
          />
          <SummaryStat
            label="Days since last"
            value={
              daysSinceLast === null ? '—' : daysSinceLast === 0 ? 'Today' : `${daysSinceLast}d`
            }
          />
        </View>
        {calendar.busiest ? (
          <ThemedText type="caption" themeColor="textSecondary">
            Busiest day: {formatDayLabel(nowMs - calendar.busiest.offsetDays * 24 * 60 * 60 * 1000)} (
            {calendar.busiest.count} sessions).
          </ThemedText>
        ) : null}
        <ThemedText type="caption" themeColor="textSecondary" testID="progress-activity-share">
          {calendar.activeDays} of {CALENDAR_DAYS} days active (
          {Math.round((calendar.activeDays / CALENDAR_DAYS) * 100)}%).
        </ThemedText>
        <View style={styles.summaryRow} testID="progress-activity-runs">
          <SummaryStat label="Current run" value={`${runs.current}d`} />
          <SummaryStat label="Longest run" value={`${runs.longest}d`} />
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {explainMetric('activity-runs')}
        </ThemedText>
      </Card>

      <Card testID="progress-activity-heatmap">
        <ThemedText type="subtitle">Calendar</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {calendar.days.length > 0
            ? `${formatDayLabel(Date.parse(`${calendar.days[0].dateKey}T00:00:00Z`))} – ${formatDayLabel(Date.parse(`${calendar.days[calendar.days.length - 1].dateKey}T00:00:00Z`))}`
            : 'No activity in this view yet'}
        </ThemedText>
        <View style={styles.heatmap}>
          {(() => {
            const weeks: CalendarDay[][] = [];
            for (let i = 0; i < calendar.days.length; i += 7) {
              weeks.push(calendar.days.slice(i, i + 7));
            }
            return weeks.map((week, wi) => {
              const weekSessions = week.reduce((sum, day) => sum + day.count, 0);
              const weekActive = week.filter((day) => day.count > 0).length;
              return (
                <HeatmapRow
                  key={wi}
                  testID={`progress-activity-heatmap-w${wi}`}
                  intensities={week.map((d) => (maxCount > 0 ? d.count / maxCount : 0))}
                  weekLabel={`Week of ${formatDayLabel(Date.parse(`${week[0].dateKey}T00:00:00Z`))}: ${weekSessions} session${weekSessions === 1 ? '' : 's'} over ${weekActive} active day${weekActive === 1 ? '' : 's'}`}
                />
              );
            });
          })()}
        </View>
        <View style={styles.legend}>
          <ThemedText type="caption" themeColor="textSecondary">
            Less
          </ThemedText>
          <View style={styles.legendCells}>
            {[0, 0.33, 0.66, 1].map((v, i) => (
              <View key={i} style={styles.legendCell} testID={`progress-activity-legend-${i}`}>
                <HeatmapRow intensities={[v]} />
              </View>
            ))}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            More
          </ThemedText>
        </View>
      </Card>

      <SectionGrid>
      <Card testID="progress-activity-distribution">
        <ThemedText type="subtitle">Frequency</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Days with a given number of sessions.
        </ThemedText>
        <View style={styles.rows}>
          {buckets.map((b) => (
            <ListRow
              key={b.perDay}
              title={`${b.perDay} session${b.perDay === 1 ? '' : 's'} / day`}
              meta={`${b.days}×`}
              testID={`progress-activity-bucket-${b.perDay}`}
            />
          ))}
        </View>
      </Card>

      <Card testID="progress-activity-weekdays">
        <ThemedText type="subtitle">Weekday pattern</ThemedText>
        <LabeledBars
          testID="progress-activity-weekday-bars"
          bars={weekdays.map((w) => ({ key: String(w.weekday), label: w.label, value: w.sessions }))}
          formatValue={(v) => `${v}×`}
          summary={`Sessions by weekday. ${weekdays.map((w) => `${w.label} ${w.sessions}`).join(', ')}.`}
        />
        <View style={styles.rows}>
          {weekdays.map((w) => (
            <ListRow
              key={w.weekday}
              title={w.label}
              subtitle={`${w.activeDays} active day${w.activeDays === 1 ? '' : 's'}`}
              meta={`${w.sessions} session${w.sessions === 1 ? '' : 's'}`}
              testID={`progress-activity-weekday-${w.weekday}`}
            />
          ))}
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {explainMetric('weekday-pattern')}
        </ThemedText>
      </Card>
      </SectionGrid>

      {months.length > 0 ? (
        <Card testID="progress-activity-monthly">
          <ThemedText type="subtitle">By month</ThemedText>
          <View style={styles.rows}>
            {months.map((m) => (
              <ListRow
                key={m.monthKey}
                title={m.monthKey}
                subtitle={`${m.activeDays} active day${m.activeDays === 1 ? '' : 's'}`}
                meta={`${m.sessions} session${m.sessions === 1 ? '' : 's'}`}
                testID={`progress-activity-month-${m.monthKey}`}
              />
            ))}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            Months partially covered by this view include only their covered days.
          </ThemedText>
        </Card>
      ) : null}
        </>
      )}
    </ScreenShell>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="headline" themeColor="accent">
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
  },
  heatmap: {
    flexDirection: 'row',
    gap: Spacing.half,
    flexWrap: 'wrap',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendCells: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  legendCell: {
    width: 14,
  },
  rows: {
    gap: Spacing.two,
  },
});
