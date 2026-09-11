/**
 * Progress — analytics dashboard (WP-2H; constitution §15, §17, §21; V2 in
 * campaign 010).
 *
 * A personal analytics surface built entirely from stored session and rating
 * evidence:
 *  - an overall composite that reuses the canonical `computeComposite` (no
 *    second score is invented) with a transparent, itemized explanation;
 *  - per-domain cards showing rating, freshness (stale / unseen), net movement
 *    inside the selected window, and recent direction;
 *  - a training-balance card: each session counts toward its game's primary
 *    domain, with per-domain shares, untrained domains called out, plus V2
 *    evenness (effective domains) and a week-by-week share history;
 *  - a time-window selector (7d / 30d / 90d / all) that drives the activity
 *    calendar, domain movement and recent-vs-lifetime comparisons;
 *  - an activity-frequency calendar (no streaks/engagement scores);
 *  - per-game records with a recent-vs-lifetime direction arrow, plus a
 *    "days since last session" staleness indicator;
 *  - V2 additions: session volume vs the previous equal-length window, a
 *    cross-category comparison, personal-best history summary, a rolling
 *    average refinement, workout-completion analytics (read-only consumption
 *    of the persisted workout instances), and a domain-breadth co-occurrence
 *    view rendered strictly as co-occurrence (never causation).
 *
 * All aggregation runs through the pure functions in `@/analytics`; this screen
 * only fetches already-persisted rows and renders them. Every number carries an
 * explainability caption (`explainMetric`). Wording is kept neutral:
 * this is a record of training activity, not a medical or scientific claim.
 *
 * Degrades to an explanatory empty state when the db is unavailable.
 */

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  buildActivityCalendar,
  buildCategoryComparison,
  buildDomainBreadthPerformance,
  buildDomainInsights,
  buildNormalizedBestHistory,
  buildRollingAverageSeries,
  buildSessionVolume,
  buildTrainingBalance,
  buildWeeklyBalance,
  balanceCoverage,
  balanceEffectiveDomains,
  COOCCURRENCE_CAPTION,
  compareRecentVsLifetime,
  daysSinceLastSession,
  explainComposite,
  explainMetric,
  filterByWindow,
  loadProgressSnapshot,
  buildWorkoutAnalytics,
  type CalendarDay,
  type CompositeExplanation,
  type ProgressSnapshot,
  type RecentVsLifetime,
  type TimeWindowKey,
  WINDOW_LABELS,
  WINDOW_ORDER,
  WINDOW_DAYS,
} from '@/analytics';
import { ScreenShell } from '@/components/screen-shell';
import { MasteryInsights } from '@/components/mastery/mastery-insights';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CalendarHeatmap,
  CompareBars,
  MiniBarChart,
  StackedShareBar,
} from '@/components/progress-charts';
import {
  Card,
  EmptyState,
  ListRow,
  ProgressBar,
  SectionGrid,
  SegmentedControl,
  Skeleton,
  SkeletonText,
  Tappable,
} from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase, GameSessionRecord, WorkoutInstance } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { GAME_CATEGORIES as DOMAINS } from '@/sdk';
import { levelForXp, levelProgress, xpIntoLevel, xpForNextLevel } from '@/rating';
import { getGameDefinition } from '@/registry/registry';
import { directionArrow, formatDayLabel, formatMs, formatPercent, formatSigned } from '@/analytics/format';
import { localDateString } from '@/workout/today';

/** Rolling-average width (sessions) for the overview refinement. */
const ROLLING_AVERAGE_SESSIONS = 5;

/** How many recent workout instances the overview loads read-only (newest first). */
const WORKOUT_RECENT_LIMIT = 30;

/** How many weekly slices the balance-history strip shows. */
const BALANCE_HISTORY_WEEKS = 4;

interface ProgressData extends ProgressSnapshot {
  /** Persisted workout instances for the lookback window (may be empty). */
  workouts: WorkoutInstance[];
  /** Lifetime completed-workout count (`WorkoutRepository.countCompleted`). */
  workoutsCompletedLifetime: number;
}

const EMPTY_DATA: ProgressData = {
  ratings: [],
  ratingHistory: [],
  sessions: [],
  aggregates: [],
  totalXp: 0,
  balance: 0,
  workouts: [],
  workoutsCompletedLifetime: 0,
};

/** Calendar span for the overview heatmap (days). */
const OVERVIEW_CALENDAR_DAYS = 84; // ~12 weeks

async function load(db: AppDatabase): Promise<ProgressData> {
  const snapshot = await loadProgressSnapshot(db, Date.now());
  // Read-only workout consumption through the existing repository API: one
  // bounded newest-first read (`WorkoutRepository.listRecent`, campaign 010
  // W22) replaces the former per-day getByDate walk, plus the O(1) completed
  // counter. Optional chaining keeps analytics alive when the repository
  // itself is unavailable (partial fakes, degraded db) — the workout card
  // just hides.
  const workouts = (await db.workouts?.listRecent?.(WORKOUT_RECENT_LIMIT)) ?? [];
  const workoutsCompletedLifetime =
    (await db.workouts?.countCompleted?.(localDateString(new Date()))) ?? 0;
  return { ...snapshot, workouts, workoutsCompletedLifetime };
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

  const { data, loaded } = useDbData(load, [refreshKey], EMPTY_DATA);
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

  // Training balance: each session counts toward its game's primary domain.
  const trainingBalance = useMemo(
    () =>
      buildTrainingBalance(
        data.sessions,
        (gameId) => getGameDefinition(gameId)?.primaryCategory ?? null,
        DOMAINS,
        nowMs,
        windowKey,
      ),
    [data.sessions, nowMs, windowKey],
  );
  const balanceSegments = useMemo(
    () =>
      trainingBalance.perDomain
        .filter((entry) => entry.sessions > 0)
        .map((entry) => ({ key: entry.domain, fraction: entry.share })),
    [trainingBalance],
  );

  // Whole days since the most recent stored session (staleness indicator).
  const daysSinceLast = useMemo(
    () => daysSinceLastSession(data.sessions, nowMs),
    [data.sessions, nowMs],
  );

  // V2: session volume in-window vs the preceding equal-length window.
  const volume = useMemo(
    () => buildSessionVolume(data.sessions, nowMs, windowKey),
    [data.sessions, nowMs, windowKey],
  );
  const volumeCompareRows = useMemo(() => {
    const max = Math.max(volume.windowSessions, volume.previousWindowSessions ?? 0, 1);
    const rows = [
      {
        key: 'current',
        label: `This window (${WINDOW_LABELS[windowKey]})`,
        valueLabel: String(volume.windowSessions),
        fraction: volume.windowSessions / max,
      },
    ];
    if (volume.previousWindowSessions !== null) {
      rows.push({
        key: 'previous',
        label: 'Previous window',
        valueLabel: String(volume.previousWindowSessions),
        fraction: volume.previousWindowSessions / max,
      });
    }
    return rows;
  }, [volume, windowKey]);

  // V2: cross-category comparison (ratings + in-window per-category activity).
  const resolveDomain = useCallback(
    (gameId: string) => getGameDefinition(gameId)?.primaryCategory ?? null,
    [],
  );
  const categoryComparison = useMemo(
    () =>
      buildCategoryComparison({
        insights: domainInsights,
        sessions: data.sessions,
        resolveDomain,
        nowMs,
        windowKey,
      }),
    [domainInsights, data.sessions, resolveDomain, nowMs, windowKey],
  );

  // V2: workout-completion analytics over the read-only instance walk.
  const workoutAnalytics = useMemo(
    () => buildWorkoutAnalytics(data.workouts, data.workoutsCompletedLifetime),
    [data.workouts, data.workoutsCompletedLifetime],
  );
  const hasWorkoutData = data.workouts.length > 0 || data.workoutsCompletedLifetime > 0;

  // V2: domain-breadth co-occurrence view (presentation of co-occurrence only).
  const breadth = useMemo(
    () => buildDomainBreadthPerformance(data.sessions, resolveDomain),
    [data.sessions, resolveDomain],
  );

  // V2: personal-best history on the shared normalized scale.
  const bestHistory = useMemo(
    () => buildNormalizedBestHistory(data.sessions, nowMs),
    [data.sessions, nowMs],
  );

  // Sessions that set or extended the personal best (PB-chain events carry
  // their source session id) — used to badge rows in the recent-sessions
  // list so record moments stay visible in context.
  const pbSessionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of bestHistory.events) {
      if (event.sessionId) {
        ids.add(event.sessionId);
      }
    }
    return ids;
  }, [bestHistory]);

  // V2: rolling-average refinement of the recent-vs-lifetime comparison.
  const normalizedPointsAsc = useMemo(
    () =>
      data.sessions
        .slice()
        .sort((a, b) => a.completedAt - b.completedAt)
        .map((s) => ({ t: s.completedAt, value: s.normalizedResult })),
    [data.sessions],
  );
  const rollingLatest = useMemo(() => {
    const series = buildRollingAverageSeries(normalizedPointsAsc, ROLLING_AVERAGE_SESSIONS);
    return series.length > 0 ? series[series.length - 1].value : null;
  }, [normalizedPointsAsc]);

  // V2 balance enhancements: evenness + week-by-week share history.
  const effectiveDomains = useMemo(
    () => balanceEffectiveDomains(trainingBalance),
    [trainingBalance],
  );
  const coverage = useMemo(
    () => balanceCoverage(trainingBalance, DOMAINS),
    [trainingBalance],
  );
  const weeklyBalance = useMemo(
    () =>
      buildWeeklyBalance(data.sessions, resolveDomain, DOMAINS, nowMs, BALANCE_HISTORY_WEEKS),
    [data.sessions, resolveDomain, nowMs],
  );

  // Per-game recent-vs-lifetime direction for the "Per game" list.
  const perGameDelta = useMemo(() => {
    const byGame = new Map<string, GameSessionRecord[]>();
    for (const session of data.sessions) {
      const list = byGame.get(session.gameId);
      if (list) {
        list.push(session);
      } else {
        byGame.set(session.gameId, [session]);
      }
    }
    const deltas = new Map<string, number>();
    for (const [gameId, sessions] of byGame) {
      const delta = compareRecentVsLifetime(sessions, rvlWindow, nowMs).deltaAvgNormalized;
      if (delta !== null) {
        deltas.set(gameId, delta);
      }
    }
    return deltas;
  }, [data.sessions, rvlWindow, nowMs]);
  // Labelled hero delta: this window's average against the lifetime average.
  const heroTrend = useMemo<{ text: string; tone: 'success' | 'danger' | 'textSecondary' } | null>(() => {
    const delta = recentVsLifetime.deltaAvgNormalized;
    if (delta === null || recentVsLifetime.recentCount === 0) {
      return null;
    }
    if (delta === 0) {
      return {
        text: `Even with lifetime · last ${WINDOW_LABELS[windowKey]}`,
        tone: 'textSecondary',
      };
    }
    return {
      text: `${directionArrow(delta > 0 ? 'up' : 'down')} ${formatSigned(Math.round(delta * 100))}% vs lifetime · last ${WINDOW_LABELS[windowKey]}`,
      tone: delta > 0 ? 'success' : 'danger',
    };
  }, [recentVsLifetime, windowKey]);

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

      <SegmentedControl
        testID="progress-window-selector"
        value={windowKey}
        onChange={(next) => setWindowKey(next as TimeWindowKey)}
        options={WINDOW_ORDER.map((k) => ({
          value: k,
          label: WINDOW_LABELS[k],
          testID: `progress-window-${k}`,
        }))}
      />

      {!loaded ? (
        <>
          <Skeleton height={160} testID="progress-loading" />
          <SkeletonText lines={3} testID="progress-loading-text" />
        </>
      ) : (
        <>
      {isNewPlayer ? (
        <Card>
          <EmptyState
            title="No sessions yet"
            message="Play a game to start building ratings."
            actionLabel="Browse games"
            onAction={() => router.push('/games')}
            testID="progress-empty"
          />
        </Card>
      ) : null}
      <Card testID="progress-summary">
        <ThemedText type="subtitle">Summary</ThemedText>
        <View style={styles.summaryRow}>
          <SummaryStat label="Level" value={String(level)} />
          <SummaryStat label="XP" value={String(data.totalXp)} />
          <SummaryStat label={`Sessions (${WINDOW_LABELS[windowKey]})`} value={String(windowedSessions.length)} />
          <SummaryStat label="Coins" value={String(data.balance)} />
        </View>
        <ProgressBar
          value={levelProgress(data.totalXp)}
          tone="xp"
          label={`Level ${level}`}
          valueLabel={`${xpIntoLevel(data.totalXp)} / ${xpForNextLevel(data.totalXp)} XP to level ${level + 1}`}
          testID="progress-level-bar"
        />
        {!isNewPlayer && daysSinceLast !== null ? (
          <ThemedText type="caption" themeColor="textSecondary" testID="progress-last-session">
            Last session:{' '}
            {daysSinceLast === 0 ? 'today' : `${daysSinceLast}d ago`} ·{' '}
            {explainMetric('recency').toLowerCase()}
          </ThemedText>
        ) : null}
      </Card>

      <CompositeCard composite={composite} trend={heroTrend} testID="progress-composite" />

      <Card testID="progress-domains">
        <ThemedText type="subtitle">Domain ratings</ThemedText>
        <View style={styles.rows}>
          {domainInsights.map((d) => (
            <ListRow
              key={d.domain}
              title={d.domain}
              subtitle={
                d.status === 'stale'
                  ? `Stale · last trained ${d.daysSinceUpdate}d ago`
                  : d.status === 'unseen'
                    ? 'Untrained'
                    : `Fresh${d.daysSinceUpdate !== null ? ` · trained ${d.daysSinceUpdate}d ago` : ''}`
              }
              meta={`${d.rating === null ? '—' : d.rating}${d.windowMovement !== 0 ? ` ${directionArrow(d.direction)} ${formatSigned(d.windowMovement)}` : ''}`}
              onPress={() => router.push(`/progress-domain?domain=${encodeURIComponent(d.domain)}`)}
              testID={`progress-domain-${d.domain.replace(/[^a-z]/gi, '').toLowerCase()}`}
            />
          ))}
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          Ratings never decay — stale ones are marked and refresh when you train that
          domain again. Movement shown is for the selected window.
        </ThemedText>
      </Card>

      {!isNewPlayer ? (
        <Card testID="progress-balance">
          <ThemedText type="subtitle">Training balance</ThemedText>
          <StackedShareBar segments={balanceSegments} testID="progress-balance-bar" />
          <View style={styles.rows}>
            {trainingBalance.perDomain
              .filter((entry) => entry.sessions > 0)
              .map((entry) => (
                <ListRow
                  key={entry.domain}
                  title={entry.domain}
                  meta={`${entry.sessions}× · ${formatPercent(entry.share)}`}
                  testID={`progress-balance-${entry.domain.replace(/[^a-z]/gi, '').toLowerCase()}`}
                />
              ))}
          </View>
          {trainingBalance.untrainedDomains.length > 0 ? (
            <ThemedText type="caption" themeColor="textSecondary" testID="progress-balance-untrained">
              Not trained in this window: {trainingBalance.untrainedDomains.join(', ')}.
            </ThemedText>
          ) : null}
          {trainingBalance.unmappedSessions > 0 ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {trainingBalance.unmappedSessions} session
              {trainingBalance.unmappedSessions === 1 ? '' : 's'} not counted (game or domain
              unknown).
            </ThemedText>
          ) : null}
          {!isNewPlayer && trainingBalance.mappedSessions > 0 ? (
            <View style={styles.rows} testID="progress-balance-diversity">
              <ThemedText type="caption" themeColor="textSecondary">
                Evenness: {effectiveDomains.toFixed(1)} effective domains of{' '}
                {DOMAINS.length} ({formatPercent(coverage)} coverage).{' '}
                {explainMetric('diversity')}
              </ThemedText>
              {weeklyBalance
                .filter((slice) => slice.sessions > 0)
                .map((slice) => (
                  <View key={slice.endOffsetDays} style={styles.rows}>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {slice.endOffsetDays === 0
                        ? 'This week'
                        : `Ended ${slice.endOffsetDays}d ago`}{' '}
                      · {slice.sessions} session{slice.sessions === 1 ? '' : 's'}
                    </ThemedText>
                    <StackedShareBar
                      height={6}
                      testID={`progress-balance-week-${slice.endOffsetDays}`}
                      segments={slice.perDomain
                        .filter((entry) => entry.share > 0)
                        .map((entry) => ({ key: entry.domain, fraction: entry.share }))}
                    />
                  </View>
                ))}
            </View>
          ) : null}
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('balance')}
          </ThemedText>
        </Card>
      ) : null}
      <Card testID="progress-activity">
        <View style={styles.cardHeader}>
          <ThemedText type="subtitle">Activity</ThemedText>
          <Tappable
            testID="progress-activity-link"
            onPress={() => router.push('/progress-activity')}
            accessibilityLabel="Open the full activity calendar"
            accessibilityHint="Shows every training day in this view">
            <ThemedText type="smallBold" themeColor="accent">
              Full calendar ›
            </ThemedText>
          </Tappable>
        </View>
        <ActivityHeatmap
          days={calendar.days}
          maxCount={calendar.busiest?.count ?? 0}
          testID="progress-activity-heatmap"
        />
        <ThemedText type="caption" themeColor="textSecondary">
          {calendar.activeDays} active days · {calendar.totalSessions} sessions in this
          view
        </ThemedText>
      </Card>

      <SectionGrid>
      {!isNewPlayer ? (
        <Card testID="progress-volume">
          <ThemedText type="subtitle">Session volume</ThemedText>
          <CompareBars
            testID="progress-volume-compare"
            rows={volumeCompareRows}
            summary={`This window ${volume.windowSessions} sessions${volume.previousWindowSessions !== null ? `, previous window ${volume.previousWindowSessions}` : ''}`}
          />
          {volume.deltaSessions !== null && volume.deltaSessions !== 0 ? (
            <ThemedText
              type="caption"
              themeColor={volume.direction === 'up' ? 'success' : 'danger'}
              testID="progress-volume-delta">
              {directionArrow(volume.direction)} {formatSigned(volume.deltaSessions)} sessions
              vs previous window
            </ThemedText>
          ) : null}
          <MiniBarChart
            values={volume.weeklyCounts}
            testID="progress-volume-weekly"
            emptyLabel="Weekly buckets need a bounded window"
            labels={volume.weeklyCounts.map((_, i) =>
              i === volume.weeklyCounts.length - 1 ? 'Now' : `-${volume.weeklyCounts.length - 1 - i}w`,
            )}
            summary={
              volume.weeklyCounts.length === 0
                ? 'Weekly buckets need a bounded window'
                : `Sessions per week, oldest first. Busiest week ${Math.max(...volume.weeklyCounts)} sessions.`
            }
          />
          <ThemedText type="caption" themeColor="textSecondary">
            {volume.activeDays} active day{volume.activeDays === 1 ? '' : 's'} ·{' '}
            {volume.perWeek === null ? '—' : volume.perWeek.toFixed(1)} sessions/week.{' '}
            {explainMetric('volume')}
          </ThemedText>
        </Card>
      ) : null}

      <RecentVsLifetimeCard
        rvl={recentVsLifetime}
        windowLabel={WINDOW_LABELS[windowKey]}
        rollingLatest={rollingLatest}
        testID="progress-recent"
      />
      </SectionGrid>

      <SectionGrid>
      {!isNewPlayer && bestHistory.current !== null ? (
        <Card testID="progress-personal-best">
          <ThemedText type="subtitle">Personal best</ThemedText>
          <View style={styles.summaryRow}>
            <SummaryStat
              label="Best session"
              value={formatPercent(bestHistory.current.value)}
            />
            <SummaryStat label="Set" value={formatDayLabel(bestHistory.current.t)} />
            <SummaryStat
              label="Standing"
              value={
                bestHistory.standingDays === 0
                  ? 'Today'
                  : `${bestHistory.standingDays ?? 0}d`
              }
            />
            <SummaryStat label="Times raised" value={String(bestHistory.timesBeaten)} />
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('personal-best-history')}
          </ThemedText>
        </Card>
      ) : null}

      {hasWorkoutData ? (
        <Card testID="progress-workouts">
          <ThemedText type="subtitle">Workout completion</ThemedText>
          <View style={styles.summaryRow}>
            <SummaryStat
              label={`Done (last ${WORKOUT_RECENT_LIMIT})`}
              value={`${workoutAnalytics.completedInstances}/${workoutAnalytics.loadedInstances}`}
            />
            <SummaryStat
              label="Rate"
              value={
                workoutAnalytics.completionRate === null
                  ? '—'
                  : formatPercent(workoutAnalytics.completionRate)
              }
            />
            <SummaryStat
              label="Current run"
              value={`${workoutAnalytics.currentCompletedRun}d`}
            />
            <SummaryStat label="All-time" value={String(workoutAnalytics.lifetimeCompleted)} />
          </View>
          <ThemedText type="caption" themeColor="textSecondary" testID="progress-workouts-games">
            Games finished inside workouts: {workoutAnalytics.gamesCompleted} of{' '}
            {workoutAnalytics.gamesAssigned} assigned · longest completed run{' '}
            {workoutAnalytics.longestCompletedRun}d.
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('workout-completion')}
          </ThemedText>
        </Card>
      ) : null}
      </SectionGrid>

      <SectionGrid>
      {!isNewPlayer ? (
        <Card testID="progress-categories">
          <ThemedText type="subtitle">Category comparison</ThemedText>
          <View style={styles.rows}>
            {categoryComparison.rows.map((row) => {
              const slug = row.domain.replace(/[^a-z]/gi, '').toLowerCase();
              return (
                <ListRow
                  key={row.domain}
                  title={row.domain}
                  subtitle={`${row.sessions}× this window${row.avgNormalized !== null ? ` · avg ${formatPercent(row.avgNormalized)}` : ''}`}
                  meta={`${row.rating === null ? '—' : row.rating}${row.movement !== 0 ? ` ${directionArrow(row.direction)} ${formatSigned(row.movement)}` : ''}`}
                  onPress={() => router.push(`/progress-domain?domain=${encodeURIComponent(row.domain)}`)}
                  accessibilityHint={`Open ${row.domain} details`}
                  testID={`progress-category-${slug}`}
                />
              );
            })}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('category-comparison')}
          </ThemedText>
        </Card>
      ) : null}

      {!isNewPlayer && breadth.groups.length > 0 ? (
        <Card testID="progress-cooccurrence">
          <ThemedText type="subtitle">Training breadth &amp; results</ThemedText>
          <View style={styles.rows}>
            {breadth.groups.map((group) => (
              <View
                key={group.breadth}
                style={styles.row}
                testID={`progress-cooccurrence-breadth-${group.breadth}`}>
                <ThemedText type="small">
                  {group.breadth} domain{group.breadth === 1 ? '' : 's'} / day
                </ThemedText>
                <ThemedText type="smallBold">
                  {group.days} day{group.days === 1 ? '' : 's'} ·{' '}
                  {group.avgNormalized === null ? '—' : formatPercent(group.avgNormalized)} avg
                </ThemedText>
              </View>
            ))}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {COOCCURRENCE_CAPTION}
          </ThemedText>
        </Card>
      ) : null}
      </SectionGrid>

      <Card
        onPress={() => router.push('/progress-detail')}
        testID="progress-detail-link"
        accessibilityLabel="Open the full training history"
        accessibilityHint="Shows per-domain trends, game records and recent sessions">
        <ThemedText type="smallBold" themeColor="accent">
          Full history ›
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Per-domain trends, game records and recent sessions.
        </ThemedText>
      </Card>
      <SectionGrid>
      <Card testID="progress-game-stats">
        <ThemedText type="subtitle">Per game</ThemedText>
        {data.aggregates.length > 0 ? (
          <View style={styles.rows}>
            {data.aggregates.map((a) => (
              <View key={a.gameId}>
                <ListRow
                  title={getGameDefinition(a.gameId)?.name ?? a.gameId}
                  subtitle={`${a.count}× · best ${Math.round(a.bestNormalized * 100)}%`}
                  onPress={() => router.push(`/progress-game?gameId=${encodeURIComponent(a.gameId)}`)}
                  accessibilityHint={`Open ${getGameDefinition(a.gameId)?.name ?? a.gameId} analytics`}
                  testID={`progress-game-${a.gameId}`}
                />
                {perGameDelta.get(a.gameId) !== undefined ? (
                  <ThemedText
                    type="caption"
                    themeColor={
                      perGameDelta.get(a.gameId)! > 0
                        ? 'success'
                        : perGameDelta.get(a.gameId)! < 0
                          ? 'danger'
                          : 'textSecondary'
                    }
                    testID={`progress-game-trend-${a.gameId}`}>
                    {directionArrow(
                      perGameDelta.get(a.gameId)! > 0
                        ? 'up'
                        : perGameDelta.get(a.gameId)! < 0
                          ? 'down'
                          : 'flat',
                    )}{' '}
                    vs lifetime ({WINDOW_LABELS[windowKey]})
                  </ThemedText>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No games played yet.
          </ThemedText>
        )}
      </Card>

      <Card testID="progress-recent-sessions">
        <ThemedText type="subtitle">Recent sessions</ThemedText>
        {data.sessions.length > 0 ? (
          <View style={styles.rows}>
            {data.sessions.slice(0, 10).map((session) => (
              <View key={session.id} style={styles.sessionRow}>
                <View style={styles.sessionRowMain}>
                  <ListRow
                    title={`${getGameDefinition(session.gameId)?.name ?? session.gameId} · ${formatDayLabel(session.completedAt)}`}
                    subtitle={pbSessionIds.has(session.id) ? 'Personal best' : undefined}
                    meta={`${Math.round(session.normalizedResult * 100)}%`}
                    onPress={() => router.push(`/results?id=${encodeURIComponent(session.id)}`)}
                    accessibilityHint="Open session results"
                    testID={`progress-session-${session.id}`}
                  />
                </View>
                {pbSessionIds.has(session.id) ? (
                  <ThemedView
                    type="accentSoft"
                    style={styles.pbBadge}
                    testID={`progress-session-pb-${session.id}`}>
                    <ThemedText type="caption" themeColor="accent">
                      PB
                    </ThemedText>
                  </ThemedView>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Your latest sessions will show up here.
          </ThemedText>
        )}
      </Card>
      </SectionGrid>

      {/* Campaign 014 (W5): mastery distribution + closest milestones —
          the forward-looking interpretation layer, one scroll away. */}
      <MasteryInsights />
        </>
      )}
    </ScreenShell>
  );
}

export function CompositeCard({
  composite,
  trend,
  testID,
}: {
  composite: CompositeExplanation;
  /** Labelled window-vs-lifetime delta rendered under the hero numeral. */
  trend?: { text: string; tone: 'success' | 'danger' | 'textSecondary' } | null;
  testID?: string;
}) {
  return (
    <Card variant="hero" testID="progress-composite-card">
      <View testID={testID}>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          Overall performance
        </ThemedText>
        <ThemedText
          type="numeralXl"
          themeColor="accent"
          testID={testID ? `${testID}-value` : undefined}
          accessibilityLabel={`Overall rating ${composite.composite}`}>
          {composite.composite}
        </ThemedText>
        {trend ? (
          <ThemedText
            type="bodySmall"
            themeColor={trend.tone}
            testID={testID ? `${testID}-trend` : undefined}>
            {trend.text}
          </ThemedText>
        ) : null}
        <ThemedText type="caption" themeColor="textSecondary">
          {composite.seenDomains} trained · {composite.unseenDomains} untrained ·{' '}
          {composite.staleDomains} stale
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Average of all domains. Untrained start at {composite.initialRating}; stale
          count half.
        </ThemedText>
        <View style={styles.rows}>
          {composite.domains.map((d) => (
            <ListRow
              key={d.domain}
              title={d.domain}
              subtitle={`${d.status}${d.weight < 1 ? ` · counts ${d.weight}×` : ''}`}
              meta={String(d.rating)}
              testID={
                testID
                  ? `${testID}-domain-${d.domain.replace(/[^a-z]/gi, '').toLowerCase()}`
                  : undefined
              }
            />
          ))}
        </View>
        </View>
    </Card>
  );
}
export function ActivityHeatmap({
  days,
  maxCount,
  testID,
}: {
  days: readonly CalendarDay[];
  maxCount: number;
  testID?: string;
}) {
  return (
    <View testID="progress-heatmap">
      <CalendarHeatmap days={days} maxCount={maxCount} testID={testID} />
    </View>
  );
}

export function RecentVsLifetimeCard({
  rvl,
  windowLabel,
  rollingLatest = null,
  testID,
}: {
  rvl: RecentVsLifetime;
  windowLabel: string;
  /** Latest trailing rolling average across sessions (`null` when too few). */
  rollingLatest?: number | null;
  testID?: string;
}) {
  const avg = rvl.recentAvgNormalized;
  const delta = rvl.deltaAvgNormalized;
  const hasRecent = rvl.recentCount > 0;
  return (
    <Card testID="progress-rvl-card">
      <View testID={testID}>
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
      {rollingLatest !== null ? (
        <ThemedText type="caption" themeColor="textSecondary" testID={`${testID}-rolling`}>
          Rolling last-5-session average: {formatPercent(rollingLatest)}.{' '}
          {explainMetric('rolling-average')}
        </ThemedText>
      ) : null}
      {rvl.lifetimeAvgAccuracy !== null ? (
        <View style={styles.summaryRow}>
          <SummaryStat
            label={`Acc (${windowLabel})`}
            value={rvl.recentAvgAccuracy === null ? '—' : formatPercent(rvl.recentAvgAccuracy)}
          />
          <SummaryStat label="Acc (all)" value={formatPercent(rvl.lifetimeAvgAccuracy)} />
          <SummaryStat
            label="Δ acc"
            value={
              rvl.deltaAvgAccuracy === null
                ? '—'
                : formatSigned(Math.round((rvl.deltaAvgAccuracy ?? 0) * 100)) + '%'
            }
            tone={
              rvl.deltaAvgAccuracy === null
                ? undefined
                : rvl.deltaAvgAccuracy > 0
                  ? 'success'
                  : rvl.deltaAvgAccuracy < 0
                    ? 'danger'
                    : undefined
            }
          />
        </View>
      ) : null}
      {rvl.lifetimeAvgReactionMs !== null ? (
        <View style={styles.summaryRow}>
          <SummaryStat
            label={`React (${windowLabel})`}
            value={rvl.recentAvgReactionMs === null ? '—' : formatMs(rvl.recentAvgReactionMs)}
          />
          <SummaryStat label="React (all)" value={formatMs(rvl.lifetimeAvgReactionMs)} />
          <SummaryStat
            label="Δ react"
            value={
              rvl.deltaAvgReactionMs === null
                ? '—'
                : formatSigned(Math.round(rvl.deltaAvgReactionMs)) + 'ms'
            }
            // Lower reaction time is better: a negative delta is the good direction.
            tone={
              rvl.deltaAvgReactionMs === null
                ? undefined
                : rvl.deltaAvgReactionMs < 0
                  ? 'success'
                  : rvl.deltaAvgReactionMs > 0
                    ? 'danger'
                    : undefined
            }
          />
        </View>
      ) : null}
      {!hasRecent ? (
        <ThemedText type="caption" themeColor="textSecondary">
          No sessions in this window yet — keep training to compare.
        </ThemedText>
      ) : null}
      </View>
    </Card>
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

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
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
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sessionRowMain: {
    flex: 1,
  },
  pbBadge: {
    borderRadius: Radii.pill,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
