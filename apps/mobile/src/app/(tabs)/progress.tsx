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
 * Degrades to a recoverable error state (not a new-player empty state) when
 * the db is unavailable; retry reruns the load.
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
  buildNextConsideration,
  buildProgressConsistency,
  buildProgressMovement,
  formatDaysSince,
  type CalendarDay,
  type CompositeExplanation,
  type DomainInsight,
  type DomainSessionShare,
  type NextConsideration,
  type ProgressConsistency,
  type ProgressMovement,
  type ProgressSnapshot,
  type RecentVsLifetime,
  type TimeWindowKey,
  WINDOW_LABELS,
  WINDOW_ORDER,
  WINDOW_DAYS,
} from '@/analytics';
import { ScreenShell } from '@/components/screen-shell';
import { SectionHeader, StateCard } from '@/components/shell';
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
  Badge,
  Card,
  EmptyState,
  Entrance,
  ListRow,
  ProgressBar,
  ProgressRing,
  SectionGrid,
  SegmentedControl,
  Skeleton,
  SkeletonText,
  Spark,
  StatBlock,
  Tappable,
} from '@/components/ui';
import { DomainColors, Radii, Spacing, type DomainName } from '@/constants/theme';
import type { AppDatabase, GameSessionRecord, WorkoutInstance } from '@/db';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDbData } from '@/hooks/use-db-data';
import { useTheme } from '@/hooks/use-theme';
import { GAME_CATEGORIES as DOMAINS } from '@/sdk';
import { levelForXp, levelProgress, xpIntoLevel, xpForNextLevel } from '@/rating';
import { getGameDefinition } from '@/registry/registry';
import { directionArrow, formatDayLabel, formatMs, formatPercent, formatSigned, plural } from '@/analytics/format';
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
  const theme = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data, loaded, error } = useDbData(load, [refreshKey], EMPTY_DATA);
  // Recovery action for the error state: bumping the key reruns the load.
  const retry = useCallback(() => setRefreshKey((k) => k + 1), []);
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

  // Campaign 033: answer the three overview questions from the same selected
  // window before exposing the deeper analytics stack. These are pure
  // summaries over existing rows; ratings, scoring, and persistence remain
  // untouched.
  const consistency = useMemo(
    () => buildProgressConsistency(data.sessions, nowMs, windowKey),
    [data.sessions, nowMs, windowKey],
  );
  const recordedMovement = useMemo(
    () => buildProgressMovement(data.sessions, nowMs, windowKey),
    [data.sessions, nowMs, windowKey],
  );
  const nextConsideration = useMemo(
    () => buildNextConsideration(domainInsights, trainingBalance),
    [domainInsights, trainingBalance],
  );

  // Most/least trained domains for the equal-column insight pair (in-window shares).
  const trainedBalance = trainingBalance.perDomain.filter((entry) => entry.sessions > 0);
  const mostTrained = trainedBalance.length > 0 ? trainedBalance[0] : null;
  const leastTrained =
    trainedBalance.length > 1
      ? trainedBalance.reduce(
          (min, entry) => (entry.sessions < min.sessions ? entry : min),
          trainedBalance[0],
        )
      : null;

  return (
    <ScreenShell>
      <View style={styles.header}>
        <ThemedText type="eyebrow" themeColor="accentText">
          YOUR TRAINING RECORD
        </ThemedText>
        <ThemedText type="title" testID="progress-title">
          Progress
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          A clear view of consistency, recorded movement and what to consider next.
        </ThemedText>
      </View>

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
      ) : error ? (
        // A read failure must not read as a brand-new player: `data` stays at
        // the fallback snapshot, so without this branch the tab showed the
        // "No sessions yet" welcome as if nothing were wrong.
        <StateCard
          variant="error"
          title="Couldn't load your progress"
          message="Your training history is unavailable right now."
          testID="progress-error"
          action={{ label: 'Try again', onPress: retry }}
        />
      ) : (
        <>
      {isNewPlayer ? (
        <Entrance index={0}>
          <Card tone="accentSoft" testID="progress-welcome">
            <EmptyState
              icon={<Spark size={36} color={theme.accent} coreColor={theme.accentOn} />}
              title="No sessions yet"
              message="Play a game to start building ratings."
              actionLabel="Browse games"
              onAction={() => router.push('/games')}
              actionVariant="primary"
              testID="progress-empty"
            />
          </Card>
        </Entrance>
      ) : null}

      {!isNewPlayer ? (
        <Entrance index={1}>
          <ProgressAnswers
            consistency={consistency}
            movement={recordedMovement}
            nextConsideration={nextConsideration}
            windowLabel={WINDOW_LABELS[windowKey]}
          />
        </Entrance>
      ) : null}

      <CompositeCard
        composite={composite}
        trend={heroTrend}
        testID="progress-composite"
        empty={isNewPlayer}
      />

      <Entrance index={isNewPlayer ? 1 : 0}>
        <Card testID="progress-summary">
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle">Summary</ThemedText>
            <Badge label={WINDOW_LABELS[windowKey]} tone="info" size="sm" />
          </View>
          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <StatBlock label="Level" value={String(level)} metric="xp" valueType="numeral" />
            </View>
            <View style={styles.statCell}>
              <StatBlock
                label="XP"
                value={String(data.totalXp)}
                metric="xp"
                valueType="numeral"
              />
            </View>
            <View style={styles.statCell}>
              <StatBlock
                label="Sessions"
                value={String(windowedSessions.length)}
                metric="score"
                valueType="numeral"
              />
            </View>
            <View style={styles.statCell}>
              <StatBlock
                label="Coins"
                value={String(data.balance)}
                metric="currency"
                valueType="numeral"
              />
            </View>
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
      </Entrance>

      <Entrance index={isNewPlayer ? 2 : 1}>
        <View testID="progress-domains" style={styles.section}>
          <SectionHeader
            title="Domain ratings"
            caption="Each domain keeps its own colour everywhere. Ratings never decay — stale cards refresh when you train that domain again."
          />
          <SectionGrid>
            {domainInsights.map((d) => (
              <DomainRatingCard key={d.domain} insight={d} />
            ))}
          </SectionGrid>
        </View>
      </Entrance>

      {!isNewPlayer ? (
        <Entrance index={2}>
          <Card testID="progress-balance">
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">Training balance</ThemedText>
              <Badge
                label={`${trainingBalance.trainedDomains}/${DOMAINS.length} domains`}
                tone="info"
                size="sm"
              />
            </View>
            <StackedShareBar segments={balanceSegments} height={14} testID="progress-balance-bar" />
            {mostTrained ? (
              <BalancePair
                most={mostTrained}
                least={leastTrained}
                total={trainingBalance.mappedSessions}
              />
            ) : null}
            <View style={styles.rows}>
              {trainingBalance.perDomain
                .filter((entry) => entry.sessions > 0)
                .map((entry) => (
                  <ListRow
                    key={entry.domain}
                    title={entry.domain}
                    icon={<DomainDot domain={entry.domain} />}
                    meta={`${entry.sessions}× · ${formatPercent(entry.share)}`}
                    testID={`progress-balance-${domainSlug(entry.domain)}`}
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
        </Entrance>
      ) : null}

      <Entrance index={3}>
        <Card testID="progress-activity">
          <View style={styles.cardHeader}>
            <View style={styles.sectionHeading}>
              <ThemedText type="subtitle">Activity</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Your training rhythm, one cell per day.
              </ThemedText>
            </View>
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
      </Entrance>

      <Entrance index={4}>
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
                : `Sessions per week, oldest first. Busiest week ${plural(Math.max(...volume.weeklyCounts), 'session')}.`
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
      </Entrance>

      <Entrance index={5}>
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
      </Entrance>

      <Entrance index={6}>
      <SectionGrid>
      {!isNewPlayer ? (
        <Card testID="progress-categories">
          <ThemedText type="subtitle">Category comparison</ThemedText>
          <View style={styles.rows}>
            {categoryComparison.rows.map((row) => (
              <ListRow
                key={row.domain}
                title={row.domain}
                icon={<DomainDot domain={row.domain} />}
                subtitle={`${row.sessions}× this window${row.avgNormalized !== null ? ` · avg ${formatPercent(row.avgNormalized)}` : ''}`}
                meta={`${row.rating === null ? '—' : row.rating}${row.movement !== 0 ? ` ${directionArrow(row.direction)} ${formatSigned(row.movement)}` : ''}`}
                onPress={() => router.push(`/progress-domain?domain=${encodeURIComponent(row.domain)}`)}
                accessibilityHint={`Open ${row.domain} details`}
                testID={`progress-category-${domainSlug(row.domain)}`}
              />
            ))}
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
      </Entrance>

      <Entrance index={7}>
        <Card
          onPress={() => router.push('/progress-detail')}
          testID="progress-detail-link"
          accessibilityLabel="Open the full training history"
          accessibilityHint="Shows per-domain trends, game records and recent sessions">
          <View style={styles.cardHeader}>
            <View style={styles.sectionHeading}>
              <ThemedText type="bodyLarge">Full history</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Per-domain trends, game records and recent sessions.
              </ThemedText>
            </View>
            <ThemedText type="headline" themeColor="accentText">
              ›
            </ThemedText>
          </View>
        </Card>
      </Entrance>

      <Entrance index={8}>
      <SectionGrid>
      <Card testID="progress-game-stats">
        <ThemedText type="subtitle">Per game</ThemedText>
        {data.aggregates.length > 0 ? (
          <View style={styles.rows}>
            {data.aggregates.map((a) => {
              const def = getGameDefinition(a.gameId);
              return (
                <View key={a.gameId}>
                  <ListRow
                    title={def?.name ?? a.gameId}
                    icon={def ? <DomainDot domain={def.primaryCategory} /> : undefined}
                    subtitle={`${a.count}× · best ${Math.round(a.bestNormalized * 100)}%`}
                    onPress={() => router.push(`/progress-game?gameId=${encodeURIComponent(a.gameId)}`)}
                    accessibilityHint={`Open ${def?.name ?? a.gameId} analytics`}
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
              );
            })}
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
      </Entrance>

      {/* Campaign 014 (W5): mastery distribution + closest milestones —
          the forward-looking interpretation layer, one scroll away. */}
      <Entrance index={9}>
        <MasteryInsights />
      </Entrance>
        </>
      )}
    </ScreenShell>
  );
}

/**
 * Answer-first Progress summary. The sections are intentionally compact so a
 * returning player can read the selected window, recorded movement, and one
 * next consideration before the composite and advanced analytics.
 */
function ProgressAnswers({
  consistency,
  movement,
  nextConsideration,
  windowLabel,
}: {
  consistency: ProgressConsistency;
  movement: ProgressMovement;
  nextConsideration: NextConsideration | null;
  windowLabel: string;
}) {
  const theme = useTheme();
  const movementTone: 'success' | 'danger' | 'textSecondary' =
    movement.direction === 'up'
      ? 'success'
      : movement.direction === 'down'
        ? 'danger'
        : 'textSecondary';

  return (
    <Card variant="raised" testID="progress-answers">
      <View style={styles.cardHeader}>
        <View style={styles.sectionHeading}>
          <ThemedText type="subtitle">At a glance</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Based on your recorded sessions in this window.
          </ThemedText>
        </View>
        <Badge label={windowLabel} tone="info" size="sm" />
      </View>

      <View testID="progress-consistency" style={styles.answerSection}>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          CONSISTENCY
        </ThemedText>
        <View style={styles.answerStatRow}>
          <View style={styles.answerStat}>
            <StatBlock
              label="Trained days"
              value={String(consistency.activeDays)}
              metric="streak"
              valueType="numeralLg"
            />
          </View>
          <View style={styles.answerStat}>
            <StatBlock
              label="Sessions"
              value={String(consistency.sessions)}
              metric="score"
              valueType="numeralLg"
            />
          </View>
          <View style={styles.answerStat}>
            <StatBlock
              label="Per active day"
              value={
                consistency.averagePerActiveDay > 0
                  ? consistency.averagePerActiveDay.toFixed(1)
                  : '—'
              }
              metric="score"
              valueType="numeralLg"
            />
          </View>
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {consistency.activeDays === 0
            ? `No sessions recorded in ${windowLabel} yet.`
            : `${plural(consistency.sessions, 'session')} across ${plural(consistency.activeDays, 'active day')}. ${explainMetric('progress-consistency')}`}
        </ThemedText>
      </View>

      <View
        testID="progress-movement"
        style={[styles.answerSection, styles.answerSectionBorder, { borderTopColor: theme.border }]}
      >
        <ThemedText type="eyebrow" themeColor="textSecondary">
          RECORDED MOVEMENT
        </ThemedText>
        <ThemedText type="headline" themeColor={movementTone}>
          {movementHeadline(movement, windowLabel)}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {movement.sampleSize === 0
            ? 'Movement will appear after a session is recorded.'
            : movement.sampleSize === 1
              ? 'One session is not enough to describe movement yet.'
              : `${plural(movement.sampleSize, 'session')} used. ${explainMetric('recorded-movement')}`}
        </ThemedText>
      </View>

      <View
        testID="progress-focus"
        style={[styles.answerSection, styles.answerSectionBorder, { borderTopColor: theme.border }]}
      >
        <ThemedText type="eyebrow" themeColor="textSecondary">
          NEXT CONSIDERATION
        </ThemedText>
        {nextConsideration ? (
          <Tappable
            testID="progress-focus-action"
            onPress={() =>
              router.push(
                `/progress-domain?domain=${encodeURIComponent(nextConsideration.domain)}`,
              )
            }
            accessibilityLabel={`Open ${nextConsideration.domain} details, ${nextConsiderationCopy(nextConsideration, windowLabel)}`}
            accessibilityHint="Open this domain's recorded history"
            style={styles.focusAction}
            pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
            <View style={styles.focusIdentity}>
              <DomainDot domain={nextConsideration.domain} />
              <View style={styles.focusCopy}>
                <ThemedText type="bodyLarge" numberOfLines={1}>
                  {nextConsideration.domain}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                  {nextConsiderationCopy(nextConsideration, windowLabel)}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="headline" themeColor="accentText">
              ›
            </ThemedText>
          </Tappable>
        ) : (
          <ThemedText type="bodySmall" themeColor="textSecondary">
            No additional consideration is available from this record yet.
          </ThemedText>
        )}
      </View>
    </Card>
  );
}

function movementHeadline(movement: ProgressMovement, windowLabel: string): string {
  if (movement.status === 'empty') {
    return `No sessions in ${windowLabel}`;
  }
  if (movement.status === 'insufficient') {
    return `One recorded result in ${windowLabel}`;
  }
  const delta = Math.round((movement.delta ?? 0) * 100);
  if (movement.comparison === 'first-to-latest') {
    return delta === 0
      ? 'First and latest recorded results match'
      : `${formatSigned(delta)} points from first to latest`;
  }
  return delta === 0
    ? `${windowLabel} average matches lifetime`
    : `${formatSigned(delta)} points vs lifetime average`;
}

function nextConsiderationCopy(next: NextConsideration, windowLabel: string): string {
  if (next.reason === 'not-trained') {
    return `No sessions recorded in ${windowLabel}`;
  }
  if (next.reason === 'not-recent') {
    return `Not played recently · last update ${formatDaysSince(next.daysSinceUpdate)}`;
  }
  return `${plural(next.sessionsInWindow, 'session')} in ${windowLabel} · least practiced`;
}

/** Hero ring: the largest spacing step doubled, sized for a 4-digit numeral beside it. */
const HERO_RING_SIZE = Spacing.six * 2 + Spacing.threeHalf;

/**
 * Domain identity key for a display domain name. Registry/rating domains are
 * display-cased (`Memory`, `Logic & Problem Solving`) while palette keys are
 * lowercase single words; the lookup folds both instead of assuming a match.
 */
function domainKeyFor(domain: string): DomainName | null {
  const normalized = domain.trim().toLowerCase();
  if (normalized.startsWith('logic')) return 'logic';
  return normalized in DomainColors.light ? (normalized as DomainName) : null;
}

/** testID slug for a domain (`Logic & Problem Solving` → `logicproblemsolving`). */
function domainSlug(domain: string): string {
  return domain.replace(/[^a-z]/gi, '').toLowerCase();
}

/** Identity dot for a domain — colour is never the only signal (text sits beside it). */
function DomainDot({ domain, size = Spacing.three }: { domain: string; size?: number }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const key = domainKeyFor(domain);
  const family = key ? DomainColors[scheme][key] : null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Radii.pill,
        backgroundColor: family ? family.base : theme.borderStrong,
      }}
    />
  );
}

/**
 * One domain's rating as an identity card: the domain's soft fill and hue
 * carry recognition, while status and movement stay in text so colour is
 * never the only signal. Preserves the contracted `progress-domain-<slug>`
 * testID and the drill-down route.
 */
function DomainRatingCard({ insight }: { insight: DomainInsight }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const key = domainKeyFor(insight.domain);
  const family = key ? DomainColors[scheme][key] : null;
  const unseen = insight.status === 'unseen';
  const slug = domainSlug(insight.domain);
  const statusLine = unseen
    ? 'Untrained · starts at the initial rating'
    : insight.status === 'stale'
      ? `Stale · last trained ${insight.daysSinceUpdate}d ago`
      : `Fresh · trained ${insight.daysSinceUpdate}d ago`;
  const movement =
    insight.windowMovement !== 0
      ? `${directionArrow(insight.direction)} ${formatSigned(insight.windowMovement)}`
      : null;
  const movementTone =
    insight.direction === 'up'
      ? theme.successText
      : insight.direction === 'down'
        ? theme.dangerText
        : theme.textSecondary;
  return (
    <Card
      variant="outlined"
      onPress={() => router.push(`/progress-domain?domain=${encodeURIComponent(insight.domain)}`)}
      testID={`progress-domain-${slug}`}
      accessibilityLabel={`${insight.domain}, ${
        unseen ? 'untrained' : `rating ${insight.rating}`
      }${movement ? `, ${movement} in this window` : ''}`}
      accessibilityHint={`Open ${insight.domain} details`}
      style={[
        styles.domainCard,
        {
          backgroundColor: family ? (unseen ? theme.surfaceSunken : family.soft) : theme.surface,
          borderColor: family ? family.base : theme.border,
        },
      ]}>
      <View style={styles.domainCardHeader}>
        <View style={[styles.domainDot, { backgroundColor: family ? family.base : theme.borderStrong }]} />
        <ThemedText
          type="eyebrow"
          numberOfLines={1}
          style={[styles.domainName, { color: family ? family.softText : theme.textSecondary }]}>
          {insight.domain}
        </ThemedText>
      </View>
      <View style={styles.domainValueRow}>
        <ThemedText
          type="numeralLg"
          testID={`progress-domain-value-${slug}`}
          style={{ color: family ? family.softText : theme.textSecondary }}>
          {insight.rating === null ? '—' : insight.rating}
        </ThemedText>
        {movement ? (
          <ThemedText type="label" style={{ color: movementTone }}>
            {movement}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText
        type="caption"
        numberOfLines={2}
        style={{ color: family ? family.softText : theme.textSecondary }}>
        {statusLine}
      </ThemedText>
    </Card>
  );
}

/** Most/least-trained pair: two equal identity columns from stored session shares. */
function BalancePair({
  most,
  least,
  total,
}: {
  most: DomainSessionShare;
  least: DomainSessionShare | null;
  total: number;
}) {
  return (
    <View style={styles.insightPair} testID="progress-balance-insights">
      <InsightPane label="Most trained" entry={most} total={total} />
      {least ? <InsightPane label="Needs attention" entry={least} total={total} /> : null}
    </View>
  );
}

function InsightPane({ label, entry, total }: { label: string; entry: DomainSessionShare; total: number }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const key = domainKeyFor(entry.domain);
  const family = key ? DomainColors[scheme][key] : null;
  const foreground = family ? family.softText : theme.textSecondary;
  return (
    <View
      style={[
        styles.insightPane,
        {
          backgroundColor: family ? family.soft : theme.surfaceSunken,
          borderColor: family ? family.base : theme.border,
        },
      ]}>
      <ThemedText type="eyebrow" style={{ color: foreground }}>
        {label}
      </ThemedText>
      <ThemedText type="bodyLarge" numberOfLines={1} style={{ color: foreground }}>
        {entry.domain}
      </ThemedText>
      <ThemedText type="caption" style={{ color: foreground }}>
        {entry.sessions} session{entry.sessions === 1 ? '' : 's'} ·{' '}
        {formatPercent(total > 0 ? entry.share : 0)}
      </ThemedText>
    </View>
  );
}

/**
 * Hero composite surface: a domain-coverage ring plus the canonical composite
 * numeral (never a second score — `explainComposite` stays the source), the
 * labelled window trend and the transparent weight explanation.
 */
export function CompositeCard({
  composite,
  trend,
  testID,
  empty = false,
}: {
  composite: CompositeExplanation;
  /** Labelled window-vs-lifetime delta rendered under the hero numeral. */
  trend?: { text: string; tone: 'success' | 'danger' | 'textSecondary' } | null;
  testID?: string;
  /** New players get an explanatory compact state, not a hero score. */
  empty?: boolean;
}) {
  const trained = composite.domains.filter((d) => d.status !== 'unseen').length;
  const total = composite.domains.length;
  const trainedShare = total > 0 ? trained / total : 0;
  return (
    <Entrance index={0}>
      <Card variant={empty ? 'outlined' : 'hero'} shape={empty ? 'block' : 'poster'} testID="progress-composite-card">
        <View testID={testID} style={empty ? styles.emptyComposite : styles.hero}>
          {empty ? (
            <>
              <View style={styles.cardHeader}>
                <ThemedText type="subtitle">How ratings start</ThemedText>
                <Badge label="No history" tone="info" size="sm" />
              </View>
              <ThemedText
                type="numeralLg"
                themeColor="textSecondary"
                testID={testID ? `${testID}-value` : undefined}>
                {composite.composite}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Each domain starts at {composite.initialRating}. A recorded rating will appear
                here after you play.
              </ThemedText>
            </>
          ) : (
            <>
          <View style={styles.heroMain}>
            <ProgressRing
              value={trainedShare}
              size={HERO_RING_SIZE}
              tone="accent"
              label={`${trained} of ${total} domains trained`}
              testID={testID ? `${testID}-ring` : undefined}>
              <ThemedText type="numeral">{trained}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                of {total}
              </ThemedText>
            </ProgressRing>
            <View style={styles.heroCopy}>
              <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.heroText}>
                Overall recorded rating
              </ThemedText>
              <ThemedText
                type="numeralXl"
                themeColor="accent"
                style={styles.heroText}
                testID={testID ? `${testID}-value` : undefined}
                accessibilityLabel={`Overall rating ${composite.composite}`}>
                {composite.composite}
              </ThemedText>
              {trend ? (
                <ThemedText
                  type="bodySmall"
                  themeColor={trend.tone}
                  style={styles.heroText}
                  testID={testID ? `${testID}-trend` : undefined}>
                  {trend.text}
                </ThemedText>
              ) : null}
              <ThemedText type="caption" themeColor="textSecondary" style={styles.heroText}>
                {trained} trained · {composite.unseenDomains} untrained · {composite.staleDomains} stale
              </ThemedText>
            </View>
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            Canonical average of all {total} domain ratings. Untrained domains start at{' '}
            {composite.initialRating}; stale updates count half. {explainMetric('composite')}
          </ThemedText>
            </>
          )}
        </View>
      </Card>
    </Entrance>
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
      <View testID={testID} style={styles.card}>
        <View style={styles.cardHeader}>
          <ThemedText type="subtitle">Recent vs lifetime</ThemedText>
          <Badge label={windowLabel} tone="info" size="sm" />
        </View>
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
      <StatBlock label={label} value={value} tone={tone} valueType="numeralLg" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.twoHalf,
  },
  card: {
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionHeading: {
    flex: 1,
    gap: Spacing.half,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statCell: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
  },
  hero: {
    gap: Spacing.three,
  },
  emptyComposite: {
    gap: Spacing.two,
  },
  heroMain: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroCopy: {
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'stretch',
  },
  heroText: {
    textAlign: 'center',
  },
  answerSection: {
    gap: Spacing.one,
  },
  answerSectionBorder: {
    borderTopWidth: 1,
    paddingTop: Spacing.two,
  },
  answerStatRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  answerStat: {
    flex: 1,
    minWidth: 0,
  },
  focusAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: Spacing.six,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: Radii.medium,
  },
  focusIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  focusCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  insightPair: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  insightPane: {
    flex: 1,
    gap: Spacing.half,
    borderWidth: 2,
    borderRadius: Radii.medium,
    padding: Spacing.twoHalf,
  },
  domainCard: {
    borderWidth: 2,
  },
  domainCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  domainDot: {
    width: Spacing.three,
    height: Spacing.three,
    borderRadius: Radii.pill,
  },
  domainName: {
    flex: 1,
  },
  domainValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
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
