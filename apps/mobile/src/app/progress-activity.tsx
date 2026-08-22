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
import { Pressable, StyleSheet, View } from 'react-native';

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
import { ThemedView } from '@/components/themed-view';
import { HeatmapRow, LabeledBars } from '@/components/progress-charts';
import { Radii, Spacing } from '@/constants/theme';
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
  return loadProgressSnapshot(db);
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
  const weeks: number[][] = [];
  const counts = calendar.days.map((d) => d.count);
  for (let i = 0; i < counts.length; i += 7) {
    weeks.push(counts.slice(i, i + 7).map((c) => (maxCount > 0 ? c / maxCount : 0)));
  }

  return (
    <ScreenShell>
      <Pressable testID="progress-activity-back" accessibilityRole="button" onPress={() => router.back()}>
        <ThemedText type="smallBold" themeColor="accent">
          ‹ Back
        </ThemedText>
      </Pressable>

      <ThemedText type="title" testID="progress-activity-title">
        Activity
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        How often you trained over the last ~6 months.
      </ThemedText>

      {!loaded ? (
        <StateCard
          variant="loading"
          title="Loading…"
          message="Building your activity calendar."
          testID="progress-activity-loading"
        />
      ) : error ? (
        <StateCard
          variant="error"
          title="Couldn't load activity"
          message="Your training history is unavailable right now."
          testID="progress-activity-error"
          action={{ label: 'Try again', onPress: retry }}
        />
      ) : calendar.totalSessions === 0 ? (
        <StateCard
          variant="empty"
          title="No sessions yet"
          message="Play a game to start filling your activity calendar."
          testID="progress-activity-empty"
          action={{
            label: 'Browse games',
            onPress: () => router.push('/games'),
            accessibilityLabel: 'Browse the game library',
          }}
        />
      ) : (
        <>

      <ThemedView type="surface" style={styles.card} testID="progress-activity-summary">
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
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-activity-heatmap">
        <ThemedText type="subtitle">Calendar</ThemedText>
        <View style={styles.heatmap}>
          {weeks.map((week, wi) => (
            <HeatmapRow
              key={wi}
              testID={`progress-activity-heatmap-w${wi}`}
              intensities={week}
            />
          ))}
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
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-activity-distribution">
        <ThemedText type="subtitle">Frequency</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Days with a given number of sessions.
        </ThemedText>
        <View style={styles.rows}>
          {buckets.map((b) => (
            <View key={b.perDay} style={styles.row} testID={`progress-activity-bucket-${b.perDay}`}>
              <ThemedText type="small">
                {b.perDay} session{b.perDay === 1 ? '' : 's'} / day
              </ThemedText>
              <ThemedText type="smallBold">{b.days}×</ThemedText>
            </View>
          ))}
        </View>
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-activity-weekdays">
        <ThemedText type="subtitle">Weekday pattern</ThemedText>
        <LabeledBars
          testID="progress-activity-weekday-bars"
          bars={weekdays.map((w) => ({ key: String(w.weekday), label: w.label, value: w.sessions }))}
        />
        <View style={styles.rows}>
          {weekdays.map((w) => (
            <View key={w.weekday} style={styles.row} testID={`progress-activity-weekday-${w.weekday}`}>
              <ThemedText type="small">{w.label}</ThemedText>
              <ThemedText type="smallBold">
                {w.sessions} session{w.sessions === 1 ? '' : 's'} · {w.activeDays} active day
                {w.activeDays === 1 ? '' : 's'}
              </ThemedText>
            </View>
          ))}
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {explainMetric('weekday-pattern')}
        </ThemedText>
      </ThemedView>

      {months.length > 0 ? (
        <ThemedView type="surface" style={styles.card} testID="progress-activity-monthly">
          <ThemedText type="subtitle">By month</ThemedText>
          <View style={styles.rows}>
            {months.map((m) => (
              <View key={m.monthKey} style={styles.row} testID={`progress-activity-month-${m.monthKey}`}>
                <ThemedText type="small">{m.monthKey}</ThemedText>
                <ThemedText type="smallBold">
                  {m.sessions} session{m.sessions === 1 ? '' : 's'} · {m.activeDays} active day
                  {m.activeDays === 1 ? '' : 's'}
                </ThemedText>
              </View>
            ))}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            Months partially covered by this view include only their covered days.
          </ThemedText>
        </ThemedView>
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
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
