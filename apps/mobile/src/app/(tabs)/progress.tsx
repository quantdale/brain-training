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

import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
  type ProgressSnapshot,
  type TimeWindowKey,
  WINDOW_LABELS,
  WINDOW_ORDER,
  WINDOW_DAYS,
} from '@/analytics';
import { ScreenShell } from '@/components/screen-shell';
import { StateCard } from '@/components/shell';
import { MasteryInsights } from '@/components/mastery/mastery-insights';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CompareBars,
  MiniBarChart,
  SegmentedControl,
  HeatmapRow,
  StackedShareBar,
} from '@/components/progress-charts';
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

      {!loaded ? (
        <StateCard
          variant="loading"
          title="Loading…"
          message="Crunching your training history."
          testID="progress-loading"
        />
      ) : (
        <>
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
        {!isNewPlayer && daysSinceLast !== null ? (
          <ThemedText type="caption" themeColor="textSecondary" testID="progress-last-session">
            Last session:{' '}
            {daysSinceLast === 0 ? 'today' : `${daysSinceLast}d ago`} ·{' '}
            {explainMetric('recency').toLowerCase()}
          </ThemedText>
        ) : null}
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

      {!isNewPlayer ? (
        <ThemedView type="surface" style={styles.card} testID="progress-balance">
          <ThemedText type="subtitle">Training balance</ThemedText>
          <StackedShareBar segments={balanceSegments} testID="progress-balance-bar" />
          <View style={styles.rows}>
            {trainingBalance.perDomain
              .filter((entry) => entry.sessions > 0)
              .map((entry) => (
                <View
                  key={entry.domain}
                  style={styles.row}
                  testID={`progress-balance-${entry.domain.replace(/[^a-z]/gi, '').toLowerCase()}`}>
                  <ThemedText type="small">{entry.domain}</ThemedText>
                  <ThemedText type="smallBold">
                    {entry.sessions}× · {formatPercent(entry.share)}
                  </ThemedText>
                </View>
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
        </ThemedView>
      ) : null}

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

      {!isNewPlayer ? (
        <ThemedView type="surface" style={styles.card} testID="progress-volume">
          <ThemedText type="subtitle">Session volume</ThemedText>
          <CompareBars testID="progress-volume-compare" rows={volumeCompareRows} />
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
          />
          <ThemedText type="caption" themeColor="textSecondary">
            {volume.activeDays} active day{volume.activeDays === 1 ? '' : 's'} ·{' '}
            {volume.perWeek === null ? '—' : volume.perWeek.toFixed(1)} sessions/week.{' '}
            {explainMetric('volume')}
          </ThemedText>
        </ThemedView>
      ) : null}

      <RecentVsLifetimeCard
        rvl={recentVsLifetime}
        windowLabel={WINDOW_LABELS[windowKey]}
        rollingLatest={rollingLatest}
        testID="progress-recent"
      />

      {!isNewPlayer && bestHistory.current !== null ? (
        <ThemedView type="surface" style={styles.card} testID="progress-personal-best">
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
        </ThemedView>
      ) : null}

      {hasWorkoutData ? (
        <ThemedView type="surface" style={styles.card} testID="progress-workouts">
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
        </ThemedView>
      ) : null}

      {!isNewPlayer ? (
        <ThemedView type="surface" style={styles.card} testID="progress-categories">
          <ThemedText type="subtitle">Category comparison</ThemedText>
          <View style={styles.rows}>
            {categoryComparison.rows.map((row) => {
              const slug = row.domain.replace(/[^a-z]/gi, '').toLowerCase();
              return (
                <Link
                  key={row.domain}
                  href={{ pathname: '/progress-domain' as any, params: { domain: row.domain } }}
                  asChild>
                  <Pressable
                    style={styles.row}
                    accessibilityRole="button"
                    testID={`progress-category-${slug}`}>
                    <View style={styles.domainLeft}>
                      <ThemedText type="small">{row.domain}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {row.sessions}× this window
                        {row.avgNormalized !== null
                          ? ` · avg ${formatPercent(row.avgNormalized)}`
                          : ''}
                      </ThemedText>
                    </View>
                    <View style={styles.domainRight}>
                      <ThemedText type="smallBold">
                        {row.rating === null ? '—' : row.rating}
                      </ThemedText>
                      {row.movement !== 0 ? (
                        <ThemedText
                          type="caption"
                          themeColor={row.direction === 'up' ? 'success' : 'danger'}>
                          {directionArrow(row.direction)} {formatSigned(row.movement)}
                        </ThemedText>
                      ) : (
                        <ThemedText type="caption" themeColor="textSecondary">
                          no change
                        </ThemedText>
                      )}
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('category-comparison')}
          </ThemedText>
        </ThemedView>
      ) : null}

      {!isNewPlayer && breadth.groups.length > 0 ? (
        <ThemedView type="surface" style={styles.card} testID="progress-cooccurrence">
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
        </ThemedView>
      ) : null}

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
                  <View style={styles.domainRight}>
                    <ThemedText type="smallBold">
                      {a.count}× · best {Math.round(a.bestNormalized * 100)}%
                    </ThemedText>
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
                <Pressable
                  style={styles.row}
                  accessibilityRole="button"
                  testID={`progress-session-${session.id}`}>
                  <ThemedText type="small">
                    {getGameDefinition(session.gameId)?.name ?? session.gameId} ·{' '}
                    {formatDayLabel(session.completedAt)}
                  </ThemedText>
                  <View style={styles.domainRight}>
                    <ThemedText type="smallBold">
                      {Math.round(session.normalizedResult * 100)}%
                    </ThemedText>
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
  rollingLatest = null,
  testID,
}: {
  rvl: ReturnType<typeof compareRecentVsLifetime>;
  windowLabel: string;
  /** Latest trailing rolling average across sessions (`null` when too few). */
  rollingLatest?: number | null;
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
  pbBadge: {
    alignSelf: 'flex-end',
    borderRadius: Radii.pill,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
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
