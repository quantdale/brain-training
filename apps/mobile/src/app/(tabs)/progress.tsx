/**
 * Progress — analytics dashboard (WP-2H; constitution §15, §17, §21).
 *
 * A personal analytics surface built entirely from stored session and rating
 * evidence:
 *  - an overall composite that reuses the canonical `computeComposite` (no
 *    second score is invented) with a transparent, itemized explanation;
 *  - per-domain cards showing rating, freshness (stale / unseen), net movement
 *    inside the selected window, and recent direction;
 *  - a time-window selector (7d / 30d / 90d / all) that drives the activity
 *    calendar, domain movement and recent-vs-lifetime comparisons;
 *  - an activity-frequency calendar (no streaks/engagement scores);
 *  - per-game records and a recent-vs-lifetime summary.
 *
 * All aggregation runs through the pure functions in `@/analytics`; this screen
 * only fetches already-persisted rows and renders them. Wording is kept neutral:
 * this is a record of training activity, not a medical or scientific claim.
 *
 * Degrades to an explanatory empty state when the db is unavailable.
 */

import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  buildActivityCalendar,
  buildDomainInsights,
  compareRecentVsLifetime,
  explainComposite,
  filterByWindow,
  loadProgressSnapshot,
  type ProgressSnapshot,
  type TimeWindowKey,
  WINDOW_LABELS,
  WINDOW_ORDER,
  WINDOW_DAYS,
} from '@/analytics';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SegmentedControl, HeatmapRow } from '@/components/progress-charts';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { GAME_CATEGORIES as DOMAINS } from '@/sdk';
import { levelForXp, levelProgress, xpIntoLevel, xpForNextLevel } from '@/rating';
import { getGameDefinition } from '@/registry/registry';
import { directionArrow, formatPercent, formatSigned } from '@/analytics/format';

const EMPTY_SNAPSHOT: ProgressSnapshot = {
  ratings: [],
  ratingHistory: [],
  sessions: [],
  aggregates: [],
  totalXp: 0,
  balance: 0,
};

/** Calendar span for the overview heatmap (days). */
const OVERVIEW_CALENDAR_DAYS = 84; // ~12 weeks

function load(db: AppDatabase): Promise<ProgressSnapshot> {
  return loadProgressSnapshot(db);
}

export default function ProgressScreen() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data } = useDbData(load, [refreshKey], EMPTY_SNAPSHOT);
  const [windowKey, setWindowKey] = useState<TimeWindowKey>('30d');

  const windowedSessions = useMemo(
    () => filterByWindow(data.sessions, nowMs, windowKey),
    [data.sessions, nowMs, windowKey],
  );

  const domainInsights = useMemo(
    () => buildDomainInsights(data.ratings, DOMAINS, data.ratingHistory, nowMs, windowKey),
    [data.ratings, data.ratingHistory, nowMs, windowKey],
  );

  const composite = useMemo(
    () => explainComposite(data.ratings, DOMAINS, nowMs),
    [data.ratings, nowMs],
  );

  const calendarDays = windowKey === 'all' ? OVERVIEW_CALENDAR_DAYS : (WINDOW_DAYS[windowKey] ?? OVERVIEW_CALENDAR_DAYS);
  const calendar = useMemo(
    () => buildActivityCalendar(data.sessions, calendarDays, nowMs),
    [data.sessions, calendarDays, nowMs],
  );

  const rvlWindow: '7d' | '30d' | '90d' = windowKey === 'all' ? '90d' : windowKey;
  const recentVsLifetime = useMemo(
    () => compareRecentVsLifetime(data.sessions, rvlWindow, nowMs),
    [data.sessions, rvlWindow, nowMs],
  );

  const level = levelForXp(data.totalXp);
  const isNewPlayer = data.sessions.length === 0;

  return (
    <ScreenShell>
      <ThemedText type="title" testID="progress-title">
        Progress
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Your training history, ratings and records.
      </ThemedText>

      <View style={styles.windowRow}>
        <SegmentedControl<TimeWindowKey>
          testID="progress-window"
          value={windowKey}
          onChange={setWindowKey}
          options={WINDOW_ORDER.map((k) => ({ key: k, label: WINDOW_LABELS[k] }))}
        />
      </View>

      {isNewPlayer ? (
        <ThemedView type="surface" style={styles.card} testID="progress-empty">
          <ThemedText type="subtitle">No sessions yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Play any game to start building your ratings and activity history. Your
            overall composite begins at {composite.composite} for every domain and
            updates as you train.
          </ThemedText>
        </ThemedView>
      ) : null}

      <ThemedView type="surface" style={styles.card} testID="progress-summary">
        <ThemedText type="subtitle">Summary</ThemedText>
        <View style={styles.summaryRow}>
          <SummaryStat label="Level" value={String(level)} />
          <SummaryStat label="XP" value={String(data.totalXp)} />
          <SummaryStat label={`Sessions (${WINDOW_LABELS[windowKey]})`} value={String(windowedSessions.length)} />
          <SummaryStat label="Coins" value={String(data.balance)} />
        </View>
        <View style={styles.progressTrack} testID="progress-level-bar">
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(levelProgress(data.totalXp) * 100)}%` },
            ]}
          />
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {xpIntoLevel(data.totalXp)} / {xpForNextLevel(data.totalXp)} XP to level {level + 1}
        </ThemedText>
      </ThemedView>

      <CompositeCard composite={composite} testID="progress-composite" />

      <ThemedView type="surface" style={styles.card} testID="progress-domains">
        <ThemedText type="subtitle">Domain ratings</ThemedText>
        <View style={styles.rows}>
          {domainInsights.map((d) => (
            <Link
              key={d.domain}
              href={{ pathname: '/progress-domain' as any, params: { domain: d.domain } }}
              asChild>
              <Pressable
                style={styles.row}
                accessibilityRole="button"
                testID={`progress-domain-${d.domain.replace(/[^a-z]/gi, '').toLowerCase()}`}>
                <View style={styles.domainLeft}>
                  <ThemedText type="small">{d.domain}</ThemedText>
                  <StatusChip status={d.status} daysSince={d.daysSinceUpdate} />
                </View>
                <View style={styles.domainRight}>
                  <ThemedText type="smallBold">
                    {d.rating === null ? '—' : d.rating}
                  </ThemedText>
                  {d.windowMovement !== 0 ? (
                    <ThemedText
                      type="caption"
                      themeColor={d.direction === 'up' ? 'success' : 'danger'}>
                      {directionArrow(d.direction)} {formatSigned(d.windowMovement)}
                    </ThemedText>
                  ) : (
                    <ThemedText type="caption" themeColor="textSecondary">
                      no change
                    </ThemedText>
                  )}
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          Ratings never decay — stale ones are marked and refresh when you train that
          domain again. Movement shown is for the selected window.
        </ThemedText>
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-activity">
        <View style={styles.cardHeader}>
          <ThemedText type="subtitle">Activity</ThemedText>
          <Link href={"/progress-activity" as any} asChild>
            <Pressable accessibilityRole="button" testID="progress-activity-link">
              <ThemedText type="smallBold" themeColor="accent">
                Full calendar ›
              </ThemedText>
            </Pressable>
          </Link>
        </View>
        <ActivityHeatmap
          days={calendar.days.map((d) => d.count)}
          maxCount={calendar.busiest?.count ?? 0}
          testID="progress-activity-heatmap"
        />
        <ThemedText type="caption" themeColor="textSecondary">
          {calendar.activeDays} active days · {calendar.totalSessions} sessions in this
          view
        </ThemedText>
      </ThemedView>

      <RecentVsLifetimeCard rvl={recentVsLifetime} windowLabel={WINDOW_LABELS[windowKey]} testID="progress-recent" />

      <Link href="/progress-detail" asChild>
        <Pressable testID="progress-detail-link" accessibilityRole="button">
          <ThemedView type="surface" style={styles.card}>
            <ThemedText type="smallBold" themeColor="accent">
              Full history ›
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Per-domain trends, game records and recent sessions.
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>

      <ThemedView type="surface" style={styles.card} testID="progress-game-stats">
        <ThemedText type="subtitle">Per game</ThemedText>
        {data.aggregates.length > 0 ? (
          <View style={styles.rows}>
            {data.aggregates.map((a) => (
              <Link
                key={a.gameId}
                href={{ pathname: '/progress-game' as any, params: { gameId: a.gameId } }}
                asChild>
                <Pressable
                  style={styles.row}
                  accessibilityRole="button"
                  testID={`progress-game-${a.gameId}`}>
                  <ThemedText type="small">
                    {getGameDefinition(a.gameId)?.name ?? a.gameId}
                  </ThemedText>
                  <ThemedText type="smallBold">
                    {a.count}× · best {Math.round(a.bestNormalized * 100)}%
                  </ThemedText>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No games played yet.
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-recent-sessions">
        <ThemedText type="subtitle">Recent sessions</ThemedText>
        {data.sessions.length > 0 ? (
          <View style={styles.rows}>
            {data.sessions.slice(0, 10).map((session) => (
              <Link key={session.id} href={`/results?id=${session.id}`} asChild>
                <Pressable style={styles.row} testID={`progress-session-${session.id}`}>
                  <ThemedText type="small">
                    {getGameDefinition(session.gameId)?.name ?? session.gameId}
                  </ThemedText>
                  <ThemedText type="smallBold">
                    {Math.round(session.normalizedResult * 100)}%
                  </ThemedText>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Your latest sessions will show up here.
          </ThemedText>
        )}
      </ThemedView>
    </ScreenShell>
  );
}

export function CompositeCard({
  composite,
  testID,
}: {
  composite: ReturnType<typeof explainComposite>;
  testID?: string;
}) {
  return (
    <ThemedView type="surface" style={styles.card} testID={testID}>
      <ThemedText type="subtitle">Overall performance</ThemedText>
      <View style={styles.compositeRow}>
        <ThemedText type="display" themeColor="accent" testID={`${testID}-value`}>
          {composite.composite}
        </ThemedText>
        <View style={styles.compositeMeta}>
          <ThemedText type="caption" themeColor="textSecondary">
            {composite.seenDomains} trained · {composite.unseenDomains} untrained ·{' '}
            {composite.staleDomains} stale
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Average of all domains. Untrained start at {composite.initialRating}; stale
            count half.
          </ThemedText>
        </View>
      </View>
      <View style={styles.rows}>
        {composite.domains.map((d) => (
          <View
            key={d.domain}
            style={styles.row}
            testID={`${testID}-domain-${d.domain.replace(/[^a-z]/gi, '').toLowerCase()}`}>
            <ThemedText type="small">{d.domain}</ThemedText>
            <View style={styles.domainRight}>
              <ThemedText type="smallBold">{d.rating}</ThemedText>
              <ThemedText
                type="caption"
                themeColor={
                  d.status === 'stale'
                    ? 'warning'
                    : d.status === 'unseen'
                      ? 'textSecondary'
                      : 'success'
                }>
                {d.status}
                {d.weight < 1 ? ` ×${d.weight}` : ''}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

export function ActivityHeatmap({
  days,
  maxCount,
  testID,
}: {
  days: readonly number[];
  maxCount: number;
  testID?: string;
}) {
  const weeks: number[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return (
    <View style={styles.heatmap}>
      {weeks.map((week, wi) => (
        <HeatmapRow
          key={wi}
          testID={testID ? `${testID}-w${wi}` : undefined}
          intensities={week.map((c) => (maxCount > 0 ? c / maxCount : 0))}
        />
      ))}
    </View>
  );
}

export function RecentVsLifetimeCard({
  rvl,
  windowLabel,
  testID,
}: {
  rvl: ReturnType<typeof compareRecentVsLifetime>;
  windowLabel: string;
  testID?: string;
}) {
  const avg = rvl.recentAvgNormalized;
  const delta = rvl.deltaAvgNormalized;
  const hasRecent = rvl.recentCount > 0;
  return (
    <ThemedView type="surface" style={styles.card} testID={testID}>
      <ThemedText type="subtitle">Recent vs lifetime</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        Avg performance ({windowLabel}) compared with all-time.
      </ThemedText>
      <View style={styles.summaryRow}>
        <SummaryStat
          label={`Avg (${windowLabel})`}
          value={hasRecent ? formatPercent(avg ?? 0) : '—'}
        />
        <SummaryStat label="Avg (all)" value={formatPercent(rvl.lifetimeAvgNormalized)} />
        <SummaryStat
          label="Δ avg"
          value={delta === null ? '—' : formatSigned(Math.round((delta ?? 0) * 100)) + '%'}
          tone={delta === null ? undefined : delta > 0 ? 'success' : delta < 0 ? 'danger' : undefined}
        />
      </View>
      {!hasRecent ? (
        <ThemedText type="caption" themeColor="textSecondary">
          No sessions in this window yet — keep training to compare.
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}) {
  return (
    <View style={styles.stat}>
      <ThemedText
        type="headline"
        themeColor={tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'accent'}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function StatusChip({ status, daysSince }: { status: string; daysSince: number | null }) {
  const label =
    status === 'stale'
      ? `stale · ${daysSince}d ago`
      : status === 'unseen'
        ? 'untrained'
        : 'fresh';
  const color = status === 'stale' ? 'warning' : status === 'unseen' ? 'textSecondary' : 'success';
  return (
    <ThemedText type="caption" themeColor={color}>
      {label}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  windowRow: {
    marginTop: Spacing.one,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
  },
  progressTrack: {
    height: 8,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(128,128,128,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(120,120,255,0.8)',
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
  domainLeft: {
    gap: Spacing.half,
  },
  domainRight: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  compositeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  compositeMeta: {
    flex: 1,
    gap: Spacing.half,
  },
  heatmap: {
    flexDirection: 'row',
    gap: Spacing.half,
    flexWrap: 'wrap',
  },
});
