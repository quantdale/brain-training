/**
 * Progress — a training record with a narrative lead (WP-2H; constitution §15,
 * §17, §21; V2 in campaign 010; framing in campaign 055).
 *
 * A personal record built entirely from stored session and rating evidence:
 *  - a compact consistency rail (day cells) and the canonical composite ring
 *    carry the first viewport, so the screen reads as a training story before
 *    it reads as a table;
 *  - recent form ("Your recent training") and one evidence-backed suggestion
 *    ("Suggested next") follow the focal ring;
 *  - every analytical block below — summary, domain ratings, training balance,
 *    activity, volume, records — uses Report/ReportRow hairline grammar
 *    (campaign 055 §2.9) instead of stacked cards.
 *
 * All aggregation runs through the pure functions in `@/analytics`; this screen
 * only fetches already-persisted rows and renders them. Every number carries an
 * explainability caption (`explainMetric`). Wording is kept neutral:
 * this is a record of training activity, not a medical or scientific claim.
 *
 * The composite reuses the canonical `computeComposite` (no second score is
 * invented) with a transparent, itemized explanation. The time-window selector
 * (7d / 30d / 90d / all) drives consistency, activity, domain movement and the
 * recent-vs-lifetime comparisons.
 *
 * Degrades to a recoverable error state (not a new-player empty state) when
 * the db is unavailable; retry reruns the load.
 */

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { StateCard } from '@/components/shell';
import { MasteryInsights } from '@/components/mastery/mastery-insights';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CalendarHeatmap,
  CompareBars,
  HeatmapCell,
  MiniBarChart,
  StackedShareBar,
} from '@/components/progress-charts';
import {
  ArcadePanel,
  Badge,
  Card,
  EmptyState,
  Entrance,
  ProgressBar,
  ProgressRing,
  Report,
  ReportRow,
  SectionGrid,
  SegmentedControl,
  Skeleton,
  SkeletonText,
  Spark,
  Tappable,
} from '@/components/ui';
import { DomainColors, Radii, Spacing, type DomainName } from '@/constants/theme';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import type { AppDatabase, GameSessionRecord, WorkoutInstance } from '@/db';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDbData } from '@/hooks/use-db-data';
import { getDb } from "@/db";
import {
  progressionInputFingerprint,
  readNewestProgressionInput,
} from "@/progression/focus-sync";
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

/** Day cells in the first-viewport consistency rail (the most recent days). */
const CONSISTENCY_RAIL_DAYS = 14;

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

/**
 * Pure focus-throttle decision (061, unit-tested; INPUT-AWARE from 072).
 *
 * The original predicate was a pure time window, and the comment defended it
 * with "sessions take minutes, so a bounce inside this window cannot hide real
 * data". That reasoning covers a session completed in the PAST — it does not
 * cover one completed *in this app, seconds ago*: a player finishes a workout
 * and returns to Progress inside the window, and the reload is skipped, so the
 * screen reports a pre-workout state with a fresh timestamp. The timestamp is
 * what makes it look current.
 *
 * So a changed input (the newest persisted session) always forces a reload,
 * exactly as the shared progression gate already does. `lastFingerprint` is
 * maintained by the screen, which is the only place that knows when a load
 * actually completed.
 */
const FOCUS_RELOAD_MIN_MS = 5000;

export function shouldScheduleFocusReload(
  lastLoadMs: number,
  nowMs: number,
  fingerprint: string = '',
  lastFingerprint: string | null = null,
): boolean {
  if (lastFingerprint !== null && lastFingerprint !== fingerprint) {
    return true;
  }
  return nowMs - lastLoadMs > FOCUS_RELOAD_MIN_MS;
}

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
  // 061/072: throttle focus reloads — the snapshot materializes the whole
  // history, so a bounce within 5s of a load needlessly re-materializes it.
  // The throttle is INPUT-AWARE: a changed newest-session fingerprint always
  // forces a reload, so a session completed in-app is never hidden behind the
  // window (the pure-time version could, and did).
  const lastLoadRef = useRef(0);
  // The fingerprint of the newest session the last COMPLETED load observed. The
  // focus handler cannot read it synchronously (it needs the db), so the gate
  // works from the fingerprint captured when a load settles.
  const lastFingerprintRef = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      setNowMs(now);
      void (async () => {
        // The gate must never be the thing that breaks the screen: an
        // uninitialized db makes `getDb()` throw, and a focus handler that
        // throws takes the whole route with it. On any failure we fall back to
        // the pure time window, which is the pre-072 behavior and always safe.
        let fingerprint: string | null = null;
        try {
          const newest = await readNewestProgressionInput(getDb(), now);
          fingerprint = progressionInputFingerprint(newest);
        } catch {
          fingerprint = null;
        }
        if (shouldScheduleFocusReload(lastLoadRef.current, now, fingerprint ?? '', lastFingerprintRef.current)) {
          lastLoadRef.current = now;
          setRefreshKey((k) => k + 1);
        }
      })();
    }, []),
  );

  const { data, loaded, error } = useDbData(load, [refreshKey], EMPTY_DATA, {
    label: 'progress',
    isEmpty: (value) => value.sessions.length === 0,
  });
  // Record the fingerprint a COMPLETED load observed, so the next focus can
  // tell "nothing changed" from "something changed while the window ran".
  useEffect(() => {
    if (!loaded || error) {
      return;
    }
    lastFingerprintRef.current = progressionInputFingerprint({
      id: data.sessions[0]?.id ?? '',
      completedAt: data.sessions[0]?.completedAt ?? 0,
    });
  }, [loaded, error, data]);
  // Recovery action for the error state: bumping the key reruns the load, and
  // the fingerprint check must not throttle the retry.
  const retry = useCallback(() => {
    lastLoadRef.current = 0;
    lastFingerprintRef.current = null;
    setRefreshKey((k) => k + 1);
  }, []);
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
        text: `Matching your lifetime average · last ${WINDOW_LABELS[windowKey]}`,
        tone: 'textSecondary',
      };
    }
    return {
      text: `${directionArrow(delta > 0 ? 'up' : 'down')} ${formatSigned(Math.round(delta * 100))}% vs your lifetime average · last ${WINDOW_LABELS[windowKey]}`,
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
          Your consistency, recent form and what to try next.
        </ThemedText>
      </View>

      <SegmentedControl
        testID="progress-window-selector"
        value={windowKey}
        onChange={(next) => setWindowKey(next as TimeWindowKey)}
        compact
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

      {/* Narrative lead: the consistency rail (day cells) and the composite
          ring frame the window before any metric table appears. */}
      {!isNewPlayer ? (
        <Entrance index={0}>
          <ConsistencyRail
            consistency={consistency}
            days={calendar.days}
            windowLabel={WINDOW_LABELS[windowKey]}
          />
        </Entrance>
      ) : null}

      <Entrance index={1}>
        <CompositeCard
          composite={composite}
          trend={heroTrend}
          testID="progress-composite"
          empty={isNewPlayer}
        />
      </Entrance>

      {!isNewPlayer ? (
        <Entrance index={2}>
          <ProgressNarrative
            movement={recordedMovement}
            nextConsideration={nextConsideration}
            windowLabel={WINDOW_LABELS[windowKey]}
          />
        </Entrance>
      ) : null}

      <Entrance index={isNewPlayer ? 2 : 3}>
        <Report testID="progress-domains" title="Domain ratings">
          <View style={styles.reportBody}>
            {domainInsights.map((d, index) => (
              <DomainRatingRow
                key={d.domain}
                insight={d}
                divider={index < domainInsights.length - 1}
              />
            ))}
            <ThemedText type="caption" themeColor="textSecondary">
              Each domain keeps its own colour everywhere. Ratings never decay — stale ratings
              refresh when you train that domain again.
            </ThemedText>
          </View>
        </Report>
      </Entrance>

      <Entrance index={isNewPlayer ? 3 : 4}>
        <Report
          testID="progress-summary"
          title="Summary"
          action={<Badge label={WINDOW_LABELS[windowKey]} tone="info" size="sm" />}>
          <View style={styles.reportBody}>
            <ReportRow label="Level" value={String(level)} valueTone="xp" divider />
            <ReportRow label="XP" value={String(data.totalXp)} valueTone="xp" divider />
            <ReportRow label="Sessions" value={String(windowedSessions.length)} divider />
            <ReportRow label="Coins" value={String(data.balance)} divider />
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
          </View>
        </Report>
      </Entrance>

      {!isNewPlayer ? (
        <Entrance index={5}>
          <Report
            testID="progress-balance"
            title="Training balance"
            action={
              <Badge
                label={`${trainingBalance.trainedDomains}/${DOMAINS.length} domains`}
                tone="info"
                size="sm"
              />
            }>
            <View style={styles.reportBody}>
              <StackedShareBar segments={balanceSegments} height={14} testID="progress-balance-bar" />
              {mostTrained ? (
                <BalancePair
                  most={mostTrained}
                  least={leastTrained}
                  total={trainingBalance.mappedSessions}
                />
              ) : null}
              <View style={styles.stack}>
                {trainingBalance.perDomain
                  .filter((entry) => entry.sessions > 0)
                  .map((entry, index, rows) => (
                    <ReportRow
                      key={entry.domain}
                      label={entry.domain}
                      icon={<DomainDot domain={entry.domain} />}
                      value={`${entry.sessions}× · ${formatPercent(entry.share)}`}
                      testID={`progress-balance-${domainSlug(entry.domain)}`}
                      divider={index < rows.length - 1}
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
                <View style={styles.stack} testID="progress-balance-diversity">
                  <ThemedText type="caption" themeColor="textSecondary">
                    Evenness: {effectiveDomains.toFixed(1)} effective domains of{' '}
                    {DOMAINS.length} ({formatPercent(coverage)} coverage).{' '}
                    {explainMetric('diversity')}
                  </ThemedText>
                  {weeklyBalance
                    .filter((slice) => slice.sessions > 0)
                    .map((slice) => (
                      <View key={slice.endOffsetDays} style={styles.stack}>
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
            </View>
          </Report>
        </Entrance>
      ) : null}

      <Entrance index={isNewPlayer ? 4 : 6}>
        <Report
          testID="progress-activity"
          title="Activity"
          action={
            <Tappable
              testID="progress-activity-link"
              onPress={() => router.push('/progress-activity')}
              style={styles.textLinkRow}
              accessibilityLabel="Open the full activity calendar"
              accessibilityHint="Shows every training day in this view">
              <ThemedText type="smallBold" themeColor="accent">
                Full calendar ›
              </ThemedText>
            </Tappable>
          }>
          <View style={styles.reportBody}>
            <ThemedText type="caption" themeColor="textSecondary">
              Your training rhythm, one cell per day.
            </ThemedText>
            <ActivityHeatmap
              days={calendar.days}
              maxCount={calendar.busiest?.count ?? 0}
              testID="progress-activity-heatmap"
            />
            <ThemedText type="caption" themeColor="textSecondary">
              {calendar.activeDays} active days · {calendar.totalSessions} sessions in this
              view
            </ThemedText>
          </View>
        </Report>
      </Entrance>

      <Entrance index={isNewPlayer ? 5 : 7}>
      <SectionGrid>
      {!isNewPlayer ? (
        <Report testID="progress-volume" title="Session volume">
          <View style={styles.reportBody}>
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
          </View>
        </Report>
      ) : null}

      <RecentVsLifetimeCard
        rvl={recentVsLifetime}
        windowLabel={WINDOW_LABELS[windowKey]}
        rollingLatest={rollingLatest}
        testID="progress-recent"
      />
      </SectionGrid>
      </Entrance>

      <Entrance index={isNewPlayer ? 6 : 8}>
      <SectionGrid>
      {!isNewPlayer && bestHistory.current !== null ? (
        <Report testID="progress-personal-best" title="Personal best">
          <View style={styles.reportBody}>
            <ReportRow
              label="Best session"
              value={formatPercent(bestHistory.current.value)}
              divider
            />
            <ReportRow label="Set" value={formatDayLabel(bestHistory.current.t)} divider />
            <ReportRow
              label="Standing"
              value={
                bestHistory.standingDays === 0
                  ? 'Today'
                  : `${bestHistory.standingDays ?? 0}d`
              }
              divider
            />
            <ReportRow label="Times raised" value={String(bestHistory.timesBeaten)} divider />
            <ThemedText type="caption" themeColor="textSecondary">
              {explainMetric('personal-best-history')}
            </ThemedText>
          </View>
        </Report>
      ) : null}

      {hasWorkoutData ? (
        <Report testID="progress-workouts" title="Workout completion">
          <View style={styles.reportBody}>
            <ReportRow
              label={`Done (last ${WORKOUT_RECENT_LIMIT})`}
              value={`${workoutAnalytics.completedInstances}/${workoutAnalytics.loadedInstances}`}
              divider
            />
            <ReportRow
              label="Rate"
              value={
                workoutAnalytics.completionRate === null
                  ? '—'
                  : formatPercent(workoutAnalytics.completionRate)
              }
              divider
            />
            <ReportRow
              label="Current run"
              value={`${workoutAnalytics.currentCompletedRun}d`}
              divider
            />
            <ReportRow label="All-time" value={String(workoutAnalytics.lifetimeCompleted)} divider />
            <ThemedText type="caption" themeColor="textSecondary" testID="progress-workouts-games">
              Games finished inside workouts: {workoutAnalytics.gamesCompleted} of{' '}
              {workoutAnalytics.gamesAssigned} assigned · longest completed run{' '}
              {workoutAnalytics.longestCompletedRun}d.
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {explainMetric('workout-completion')}
            </ThemedText>
          </View>
        </Report>
      ) : null}
      </SectionGrid>
      </Entrance>

      <Entrance index={isNewPlayer ? 7 : 9}>
      <SectionGrid>
      {!isNewPlayer ? (
        <Report testID="progress-categories" title="Category comparison">
          <View style={styles.reportBody}>
            {categoryComparison.rows.map((row, index) => (
              <ReportRow
                key={row.domain}
                label={row.domain}
                icon={<DomainDot domain={row.domain} />}
                hint={`${row.sessions}× this window${row.avgNormalized !== null ? ` · avg ${formatPercent(row.avgNormalized)}` : ''}`}
                value={`${row.rating === null ? '—' : row.rating}${row.movement !== 0 ? ` ${directionArrow(row.direction)} ${formatSigned(row.movement)}` : ''}`}
                onPress={() => router.push(`/progress-domain?domain=${encodeURIComponent(row.domain)}`)}
                testID={`progress-category-${domainSlug(row.domain)}`}
                divider={index < categoryComparison.rows.length - 1}
              />
            ))}
            <ThemedText type="caption" themeColor="textSecondary">
              {explainMetric('category-comparison')}
            </ThemedText>
          </View>
        </Report>
      ) : null}

      {!isNewPlayer && breadth.groups.length > 0 ? (
        <Report testID="progress-cooccurrence" title="Training breadth & results">
          <View style={styles.reportBody}>
            {breadth.groups.map((group, index) => (
              <ReportRow
                key={group.breadth}
                testID={`progress-cooccurrence-breadth-${group.breadth}`}
                label={`${group.breadth} domain${group.breadth === 1 ? '' : 's'} / day`}
                value={`${group.days} day${group.days === 1 ? '' : 's'} · ${
                  group.avgNormalized === null ? '—' : formatPercent(group.avgNormalized)
                } avg`}
                divider={index < breadth.groups.length - 1}
              />
            ))}
            <ThemedText type="caption" themeColor="textSecondary">
              {COOCCURRENCE_CAPTION}
            </ThemedText>
          </View>
        </Report>
      ) : null}
      </SectionGrid>
      </Entrance>

      <Entrance index={isNewPlayer ? 8 : 10}>
        <Report testID="progress-detail">
          <ReportRow
            label="Full history"
            hint="Per-domain trends, game records and recent sessions."
            onPress={() => router.push('/progress-detail')}
            testID="progress-detail-link"
            accessibilityLabel="Open the full training history"
          />
        </Report>
      </Entrance>

      <Entrance index={isNewPlayer ? 9 : 11}>
      <SectionGrid>
      <Report testID="progress-game-stats" title="Per game">
        <View style={styles.reportBody}>
          {data.aggregates.length > 0 ? (
            data.aggregates.map((a, index) => {
              const def = getGameDefinition(a.gameId);
              const delta = perGameDelta.get(a.gameId);
              return (
                <ReportRow
                  key={a.gameId}
                  label={def?.name ?? a.gameId}
                  hint={`${a.count}× · best ${Math.round(a.bestNormalized * 100)}%`}
                  icon={def ? <DomainDot domain={def.primaryCategory} /> : undefined}
                  onPress={() => router.push(`/progress-game?gameId=${encodeURIComponent(a.gameId)}`)}
                  testID={`progress-game-${a.gameId}`}
                  divider={index < data.aggregates.length - 1}
                  trailing={
                    delta !== undefined ? (
                      <ThemedText
                        type="caption"
                        themeColor={
                          delta > 0 ? 'success' : delta < 0 ? 'danger' : 'textSecondary'
                        }
                        testID={`progress-game-trend-${a.gameId}`}>
                        {directionArrow(delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat')}{' '}
                        vs lifetime ({WINDOW_LABELS[windowKey]})
                      </ThemedText>
                    ) : undefined
                  }
                />
              );
            })
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              No games played yet.
            </ThemedText>
          )}
        </View>
      </Report>

      <Report testID="progress-recent-sessions" title="Recent sessions">
        <View style={styles.reportBody}>
          {data.sessions.length > 0 ? (
            data.sessions.slice(0, 10).map((session, index) => {
              const isPb = pbSessionIds.has(session.id);
              return (
                <ReportRow
                  key={session.id}
                  label={`${getGameDefinition(session.gameId)?.name ?? session.gameId} · ${formatDayLabel(session.completedAt)}`}
                  hint={isPb ? 'Personal best' : undefined}
                  value={`${Math.round(session.normalizedResult * 100)}%`}
                  onPress={() => router.push(`/results?id=${encodeURIComponent(session.id)}`)}
                  testID={`progress-session-${session.id}`}
                  divider={index < Math.min(data.sessions.length, 10) - 1}
                  trailing={
                    isPb ? (
                      <ThemedView
                        type="accentSoft"
                        style={styles.pbBadge}
                        testID={`progress-session-pb-${session.id}`}>
                        <ThemedText type="caption" themeColor="accent">
                          PB
                        </ThemedText>
                      </ThemedView>
                    ) : undefined
                  }
                />
              );
            })
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Your latest sessions will show up here.
            </ThemedText>
          )}
        </View>
      </Report>
      </SectionGrid>
      </Entrance>

      {/* Campaign 014 (W5): mastery distribution + closest milestones —
          the forward-looking interpretation layer, one scroll away. */}
      <Entrance index={isNewPlayer ? 10 : 12}>
        <MasteryInsights />
      </Entrance>
        </>
      )}
    </ScreenShell>
  );
}

/**
 * First-viewport consistency rail: the most recent days of the selected
 * window as day cells, followed by the window's plain-language facts. The
 * cells are a rhythm strip (the window's exact numbers live in the sentence
 * and in the Activity report), so the rail never claims more than it shows.
 */
function ConsistencyRail({
  consistency,
  days,
  windowLabel,
}: {
  consistency: ProgressConsistency;
  days: readonly CalendarDay[];
  windowLabel: string;
}) {
  const railDays = days.slice(-CONSISTENCY_RAIL_DAYS);
  const maxCount = Math.max(1, ...railDays.map((day) => day.count));
  const railSessions = railDays.reduce((sum, day) => sum + day.count, 0);
  const railActive = railDays.filter((day) => day.hasSession).length;
  const railSummary = `${plural(railSessions, 'session')} across ${plural(railActive, 'active day')} in the last ${railDays.length} days`;
  return (
    <Report
      testID="progress-consistency"
      title="Consistency"
      action={<Badge label={windowLabel} tone="info" size="sm" />}>
      <View style={styles.reportBody}>
        <View
          style={styles.consistencyRail}
          accessible
          accessibilityRole="image"
          accessibilityLabel={railSummary}>
          {railDays.map((day) => (
            <HeatmapCell key={day.dateKey} intensity={day.count / maxCount} />
          ))}
        </View>
        <ThemedText type="caption" themeColor="textMuted">
          Last {railDays.length} days
        </ThemedText>
        {consistency.activeDays === 0 ? (
          <ThemedText type="bodyRead" themeColor="textSecondary">
            No sessions in this window yet.
          </ThemedText>
        ) : (
          <ThemedText type="bodyRead" themeColor="textSecondary">
            {plural(consistency.sessions, 'session')} across{' '}
            {plural(consistency.activeDays, 'active day')} ·{' '}
            {consistency.averagePerActiveDay.toFixed(1)} per active day.
          </ThemedText>
        )}
      </View>
    </Report>
  );
}

/**
 * Narrative pair under the ring: what the recent sessions say ("Your recent
 * training") and one evidence-backed domain to consider next ("Suggested
 * next"). Facts and disclosure rules are unchanged — only the framing order
 * and player-facing language (campaign 055 §2.9).
 */
function ProgressNarrative({
  movement,
  nextConsideration,
  windowLabel,
}: {
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
    <View testID="progress-answers" style={styles.answers}>
      <Report testID="progress-movement" title="Your recent training">
        <View style={styles.reportBody}>
          <ThemedText type="headline" themeColor={movementTone}>
            {movementHeadline(movement)}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {movement.sampleSize === 0
              ? 'Your recent form will appear after your next session.'
              : movement.sampleSize === 1
                ? "One session isn't enough to show a trend yet."
                : `${plural(movement.sampleSize, 'session')} in this window. ${explainMetric('recorded-movement')}`}
          </ThemedText>
        </View>
      </Report>

      <Report testID="progress-focus" title="Suggested next">
        {nextConsideration ? (
          <Tappable
            testID="progress-focus-action"
            onPress={() =>
              router.push(
                `/progress-domain?domain=${encodeURIComponent(nextConsideration.domain)}`,
              )
            }
            accessibilityLabel={`Open ${nextConsideration.domain} details, ${nextConsiderationCopy(nextConsideration)}`}
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
                  {nextConsiderationCopy(nextConsideration)}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="headline" themeColor="accentText">
              ›
            </ThemedText>
          </Tappable>
        ) : (
          <View style={styles.reportBody}>
            <ThemedText type="bodySmall" themeColor="textSecondary">
              Nothing to suggest yet.
            </ThemedText>
          </View>
        )}
      </Report>
    </View>
  );
}

function movementHeadline(movement: ProgressMovement): string {
  if (movement.status === 'empty') {
    return 'No sessions in this window';
  }
  if (movement.status === 'insufficient') {
    return 'One result so far';
  }
  const delta = Math.round((movement.delta ?? 0) * 100);
  if (movement.comparison === 'first-to-latest') {
    return delta === 0
      ? 'Your first and latest sessions match'
      : `${formatSigned(delta)} points since your first session`;
  }
  return delta === 0
    ? "This window's average matches your lifetime"
    : `${formatSigned(delta)} points vs your lifetime average`;
}

function nextConsiderationCopy(next: NextConsideration): string {
  if (next.reason === 'not-trained') {
    return 'Not trained in this window yet';
  }
  if (next.reason === 'not-recent') {
    return `Not played recently · last trained ${formatDaysSince(next.daysSinceUpdate)}`;
  }
  return `${plural(next.sessionsInWindow, 'session')} in this window · least practiced`;
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
 * One domain's rating as a report line: the identity dot carries the domain
 * hue, status and movement stay in text so colour is never the only signal.
 * Preserves the contracted `progress-domain-<slug>` and
 * `progress-domain-value-<slug>` testIDs and the drill-down route.
 */
function DomainRatingRow({ insight, divider }: { insight: DomainInsight; divider: boolean }) {
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
    <ReportRow
      testID={`progress-domain-${slug}`}
      icon={<DomainDot domain={insight.domain} />}
      label={insight.domain}
      hint={statusLine}
      divider={divider}
      onPress={() => router.push(`/progress-domain?domain=${encodeURIComponent(insight.domain)}`)}
      accessibilityLabel={`${insight.domain}, ${
        unseen ? 'untrained' : `rating ${insight.rating}`
      }${movement ? `, ${movement} in this window` : ''}`}
      trailing={
        <View style={styles.domainValueRow}>
          <ThemedText
            type="numeral"
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
      }
    />
  );
}

/** Most/least-trained pair: two report rows from stored session shares. */
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
    <View testID="progress-balance-insights">
      <ReportRow
        label="Most trained"
        value={most.domain}
        hint={`${plural(most.sessions, 'session')} · ${formatPercent(total > 0 ? most.share : 0)}`}
        icon={<DomainDot domain={most.domain} />}
        divider={least !== null}
      />
      {least ? (
        <ReportRow
          label="Needs attention"
          value={least.domain}
          hint={`${plural(least.sessions, 'session')} · ${formatPercent(total > 0 ? least.share : 0)}`}
          icon={<DomainDot domain={least.domain} />}
        />
      ) : null}
    </View>
  );
}

/**
 * Focal composite surface: a domain-coverage ring plus the canonical composite
 * numeral (never a second score — `explainComposite` stays the source), the
 * labelled window trend and the transparent weight explanation. The one
 * elevated panel on the screen (campaign 055 §2.3).
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
    <ArcadePanel emphasis={empty ? 'flat' : 'focal'} testID="progress-composite-card">
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
              Each domain starts at {composite.initialRating}. Your rating will appear here
              after you play.
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
              OVERALL RATING
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
          Average of all {total} domain ratings. Untrained domains start at{' '}
          {composite.initialRating}; stale updates count half.
        </ThemedText>
          </>
        )}
      </View>
    </ArcadePanel>
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
  const deltaTone =
    delta === null ? 'textSecondary' : delta > 0 ? 'success' : delta < 0 ? 'danger' : 'textSecondary';
  const accuracyTone =
    rvl.deltaAvgAccuracy === null
      ? 'textSecondary'
      : rvl.deltaAvgAccuracy > 0
        ? 'success'
        : rvl.deltaAvgAccuracy < 0
          ? 'danger'
          : 'textSecondary';
  const reactionTone =
    rvl.deltaAvgReactionMs === null
      ? 'textSecondary'
      : rvl.deltaAvgReactionMs < 0
        ? 'success'
        : rvl.deltaAvgReactionMs > 0
          ? 'danger'
          : 'textSecondary';
  return (
    <Report
      testID="progress-rvl-card"
      title="Recent vs lifetime"
      action={<Badge label={windowLabel} tone="info" size="sm" />}>
      <View testID={testID} style={styles.reportBody}>
        <ThemedText type="caption" themeColor="textSecondary">
          This window compared with all time.
        </ThemedText>
        <ReportRow
          label="Average"
          hint={`${windowLabel} vs all time`}
          value={`${hasRecent ? formatPercent(avg ?? 0) : '—'} · ${formatPercent(rvl.lifetimeAvgNormalized)}`}
          trailing={
            delta === null ? undefined : (
              <ThemedText type="label" themeColor={deltaTone}>
                {`Δ ${formatSigned(Math.round((delta ?? 0) * 100))}%`}
              </ThemedText>
            )
          }
          divider
        />
        {rollingLatest !== null ? (
          <ThemedText type="caption" themeColor="textSecondary" testID={`${testID}-rolling`}>
            Rolling last-5-session average: {formatPercent(rollingLatest)}.{' '}
            {explainMetric('rolling-average')}
          </ThemedText>
        ) : null}
        {rvl.lifetimeAvgAccuracy !== null ? (
          <ReportRow
            label="Accuracy"
            hint={`${windowLabel} vs all time`}
            value={`${rvl.recentAvgAccuracy === null ? '—' : formatPercent(rvl.recentAvgAccuracy)} · ${formatPercent(rvl.lifetimeAvgAccuracy)}`}
            trailing={
              rvl.deltaAvgAccuracy === null ? undefined : (
                <ThemedText type="label" themeColor={accuracyTone}>
                  {`Δ ${formatSigned(Math.round((rvl.deltaAvgAccuracy ?? 0) * 100))}%`}
                </ThemedText>
              )
            }
            divider
          />
        ) : null}
        {rvl.lifetimeAvgReactionMs !== null ? (
          <ReportRow
            label="Reaction"
            hint={`${windowLabel} vs all time · lower is better`}
            value={`${rvl.recentAvgReactionMs === null ? '—' : formatMs(rvl.recentAvgReactionMs)} · ${formatMs(rvl.lifetimeAvgReactionMs)}`}
            trailing={
              rvl.deltaAvgReactionMs === null ? undefined : (
                <ThemedText type="label" themeColor={reactionTone}>
                  {`Δ ${formatSigned(Math.round(rvl.deltaAvgReactionMs))}ms`}
                </ThemedText>
              )
            }
          />
        ) : null}
        {!hasRecent ? (
          <ThemedText type="caption" themeColor="textSecondary">
            No sessions in this window yet.
          </ThemedText>
        ) : null}
      </View>
    </Report>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  // 058: text-only links meet the 44dp floor by style, not by accident.
  textLinkRow: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reportBody: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  stack: {
    gap: Spacing.two,
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
  consistencyRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.half,
  },
  answers: {
    gap: Spacing.three,
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
  domainValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    flexShrink: 0,
  },
  pbBadge: {
    borderRadius: Radii.pill,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
