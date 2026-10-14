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
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  activeRuns,
  activityFrequencyBuckets,
  buildActivityCalendar,
  daysSinceLastSession,
  explainMetric,
  loadProgressSnapshot,
  monthlyActivity,
  weekdayDistribution,
  type ProgressSnapshot,
} from '@/analytics';
import { ScreenShell } from '@/components/screen-shell';
import { StateCard } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { CalendarHeatmap, LabeledBars } from '@/components/progress-charts';
import {
  BackLink,
  Card,
  Entrance,
  ListRow,
  SectionGrid,
  Skeleton,
  SkeletonText,
  Report,
  ReportRow,
  useSafeBack,
} from '@/components/ui';
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
  const { width, fontScale } = useWindowDimensions();
  const stackedSummary = width < 360 || fontScale >= 1.5;
  // 058: cold deep links land with an empty stack — fall back to /progress.
  const goBack = useSafeBack('/progress');
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
      <BackLink testID="progress-activity-back" onPress={goBack} />

      <ThemedText type="title" testID="progress-activity-title">
        Activity
      </ThemedText>
      <ThemedText type="bodySmall" themeColor="textSecondary">
        Your completed sessions over the last 182 days.
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
        <StateCard variant="empty" title="No activity in this view"
          message="No completed sessions in the last 182 days. Play a game to add a training day."
          testID="progress-activity-empty" action={{ label: 'Browse games', onPress: () => router.replace('/games') }} />
      ) : (
        <>

      <Card style={styles.evidenceCard} variant="outlined" padding="md" testID="progress-activity-summary">
        <View style={[styles.summaryRow, stackedSummary && styles.summaryStacked]} testID="progress-activity-summary-layout">
          <SummaryStat label="Sessions" value={String(calendar.totalSessions)} />
          <SummaryStat label="Active days" value={String(calendar.activeDays)} />
        </View>
        <ThemedText type="caption" themeColor="textSecondary" testID="progress-activity-share">
          {calendar.activeDays} of {CALENDAR_DAYS} days active ({Math.round((calendar.activeDays / CALENDAR_DAYS) * 100)}%).
          {' '}Last session {daysSinceLast === 0 ? 'today' : `${daysSinceLast ?? '—'} ${daysSinceLast === 1 ? 'day' : 'days'} ago`}.
        </ThemedText>
      </Card>

      <Entrance index={1}>
      <Card style={styles.evidenceCard} testID="progress-activity-heatmap">
        <ThemedText type="headline">Training days</ThemedText>
        <CalendarHeatmap days={calendar.days} maxCount={maxCount}
          testID="progress-activity-calendar" />
      </Card>
      </Entrance>

      <Report title="Training rhythm" testID="progress-activity-runs">
        <ReportRow label="Sessions per active day" value={calendar.avgPerActiveDay > 0 ? calendar.avgPerActiveDay.toFixed(1) : '—'} divider />
        <ReportRow label="Current run of active days" value={`${runs.current}d`} divider />
        <ReportRow label="Longest run in this view" value={`${runs.longest}d`} />
        {calendar.busiest ? <ThemedText type="caption" themeColor="textSecondary">
          Busiest day: {formatDayLabel(nowMs - calendar.busiest.offsetDays * 24 * 60 * 60 * 1000)} · {calendar.busiest.count} sessions.
        </ThemedText> : null}
        <ThemedText type="caption" themeColor="textSecondary">{explainMetric('activity-runs')}</ThemedText>
      </Report>

      <Entrance index={2}>
      <SectionGrid>
      <Card style={styles.evidenceCard} testID="progress-activity-distribution">
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

      <Card style={styles.evidenceCard} testID="progress-activity-weekdays">
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
      </Entrance>

      {months.length > 0 ? (
        <Entrance index={3}>
        <Card style={styles.evidenceCard} testID="progress-activity-monthly">
          <ThemedText type="subtitle">By month</ThemedText>
          <View style={styles.rows}>
            {months.map((m) => (
              <ListRow
                key={m.monthKey}
                title={new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m.monthKey}-01T00:00:00Z`))}
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
        </Entrance>
      ) : null}
        </>
      )}
    </ScreenShell>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="numeral">{value}</ThemedText>
      <ThemedText type="bodySmall" themeColor="textSecondary">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  evidenceCard: { gap: Spacing.two },
  summaryStacked: { flexDirection: 'column' },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
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
