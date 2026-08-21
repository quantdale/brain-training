/**
 * Per-domain drill-down — `/progress-domain?domain=...`.
 *
 * Shows one cognitive domain's rating history and the games that contribute to
 * it, all derived from stored evidence: current rating with freshness, the
 * all-time personal best rating, window-scoped session/average/best stats, an
 * in-window rating trend (falling back to all-time when the window holds fewer
 * than two updates), per-game contribution counts with best results, and the
 * domain's recent sessions. Unseen domains render an explanatory state (no
 * fabricated rating). Neutral wording throughout.
 */

import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  buildActivityCalendar,
  buildDomainInsights,
  filterByWindow,
  isWithinWindow,
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
import { SegmentedControl, MiniBarChart, HeatmapRow } from '@/components/progress-charts';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase, GameSessionRecord, RatingHistoryEntry } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { getGameDefinition } from '@/registry/registry';
import {
  directionArrow,
  formatDayLabel,
  formatPercent,
  formatSigned,
} from '@/analytics/format';

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

/** Sessions whose game's primary or secondary domain matches. */
function sessionsForDomain(
  sessions: readonly GameSessionRecord[],
  domain: string,
): GameSessionRecord[] {
  return sessions.filter((s) => {
    const def = getGameDefinition(s.gameId);
    if (!def) return false;
    return (
      String(def.primaryCategory) === domain ||
      (def.secondaryDomains ?? []).some((d) => String(d) === domain)
    );
  });
}

export default function ProgressDomainScreen() {
  const params = useLocalSearchParams<{ domain?: string }>();
  const domain = typeof params.domain === 'string' ? params.domain : '';

  const [refreshKey, setRefreshKey] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data } = useDbData(load, [refreshKey, domain], EMPTY);
  const [windowKey, setWindowKey] = useState<TimeWindowKey>('30d');

  const domainSessions = useMemo(
    () => sessionsForDomain(data.sessions, domain),
    [data.sessions, domain],
  );

  const windowedDomainSessions = useMemo(
    () => filterByWindow(domainSessions, nowMs, windowKey),
    [domainSessions, nowMs, windowKey],
  );

  // Window average + lifetime best of the stored normalized results.
  const windowAvg = useMemo(
    () =>
      windowedDomainSessions.length === 0
        ? null
        : windowedDomainSessions.reduce((s, x) => s + x.normalizedResult, 0) /
          windowedDomainSessions.length,
    [windowedDomainSessions],
  );
  const lifetimeBest = useMemo(
    () =>
      domainSessions.length === 0
        ? null
        : domainSessions.reduce((m, x) => Math.max(m, x.normalizedResult), -Infinity),
    [domainSessions],
  );

  const insight = useMemo(() => {
    const list = buildDomainInsights(data.ratings, [domain], data.ratingHistory, nowMs, windowKey);
    return list[0];
  }, [data.ratings, data.ratingHistory, nowMs, windowKey, domain]);

  const historySeries = useMemo(
    () =>
      data.ratingHistory
        .filter((h: RatingHistoryEntry) => h.domain === domain)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((h) => h.ratingAfter),
    [data.ratingHistory, domain],
  );

  // Prefer the in-window slice for the trend; fall back to all-time when the
  // window holds fewer than two updates (a single point has no shape).
  const windowHistoryValues = useMemo(
    () =>
      data.ratingHistory
        .filter((h: RatingHistoryEntry) => h.domain === domain)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .filter((h) => isWithinWindow(h.createdAt, nowMs, windowKey))
        .map((h) => h.ratingAfter),
    [data.ratingHistory, domain, nowMs, windowKey],
  );
  const chartValues = windowHistoryValues.length >= 2 ? windowHistoryValues : historySeries;
  const chartCaption =
    windowHistoryValues.length >= 2
      ? `${windowHistoryValues.length} rating updates in this window.`
      : `${historySeries.length} recorded updates — all-time shown (fewer than 2 in this window).`;

  const calendarDays = windowKey === 'all' ? 84 : (WINDOW_DAYS[windowKey] ?? 84);
  const calendar = useMemo(
    () => buildActivityCalendar(domainSessions, calendarDays, nowMs),
    [domainSessions, calendarDays, nowMs],
  );

  const byGame = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of domainSessions) {
      map.set(s.gameId, (map.get(s.gameId) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [domainSessions]);

  if (!domain) {
    return (
      <ScreenShell>
        <ThemedText type="title">Domain</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" testID="progress-domain-missing">
          No domain selected.
        </ThemedText>
        <Link href={"/progress" as any} asChild>
          <Pressable accessibilityRole="button" testID="progress-domain-back-link">
            <ThemedText type="smallBold" themeColor="accent">
              ‹ Back to Progress
            </ThemedText>
          </Pressable>
        </Link>
      </ScreenShell>
    );
  }

  const unseen = insight?.status === 'unseen';

  return (
    <ScreenShell>
      <Pressable
        testID="progress-domain-back"
        accessibilityRole="button"
        onPress={() => router.back()}>
        <ThemedText type="smallBold" themeColor="accent">
          ‹ Back
        </ThemedText>
      </Pressable>

      <ThemedText type="title" testID="progress-domain-title">
        {domain}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Rating history and contributing games.
      </ThemedText>

      <View style={styles.windowRow}>
        <SegmentedControl<TimeWindowKey>
          testID="progress-domain-window"
          value={windowKey}
          onChange={setWindowKey}
          options={WINDOW_ORDER.map((k) => ({ key: k, label: WINDOW_LABELS[k] }))}
        />
      </View>

      {unseen ? (
        <ThemedView type="surface" style={styles.card} testID="progress-domain-unseen">
          <ThemedText type="subtitle">Not trained yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            You haven&apos;t played a {domain} game. This domain contributes the starting
            rating ({insight?.rating ?? 1000}) to your overall composite until you train it.
          </ThemedText>
        </ThemedView>
      ) : (
        <ThemedView type="surface" style={styles.card} testID="progress-domain-summary">
          <ThemedText type="subtitle">Rating</ThemedText>
          <View style={styles.ratingRow}>
            <ThemedText type="display" themeColor="accent">
              {insight?.rating ?? '—'}
            </ThemedText>
            {insight && insight.windowMovement !== 0 ? (
              <ThemedText
                type="headline"
                themeColor={insight.direction === 'up' ? 'success' : 'danger'}>
                {directionArrow(insight.direction)} {formatSigned(insight.windowMovement)}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {insight?.status === 'stale'
              ? `Stale — last trained ${insight.daysSinceUpdate} days ago.`
              : `Fresh — trained ${insight?.daysSinceUpdate} days ago.`}{' '}
            {insight?.sessions ?? 0} sessions · {insight?.windowEntries ?? 0} updates in this window.
          </ThemedText>
          {insight?.bestRating !== null ? (
            <ThemedText
              type="caption"
              themeColor="textSecondary"
              testID="progress-domain-best">
              Personal best {insight.bestRating}
              {insight.bestRatingAt !== null ? ` · set ${formatDayLabel(insight.bestRatingAt)}` : ''}
            </ThemedText>
          ) : null}
          <View style={styles.summaryRow} testID="progress-domain-stats">
            <DomainStat
              label={`Sessions (${WINDOW_LABELS[windowKey]})`}
              value={String(windowedDomainSessions.length)}
            />
            <DomainStat
              label={`Avg (${WINDOW_LABELS[windowKey]})`}
              value={windowAvg === null ? '—' : formatPercent(windowAvg)}
            />
            <DomainStat
              label="Best ever"
              value={lifetimeBest === null ? '—' : formatPercent(lifetimeBest)}
            />
          </View>
        </ThemedView>
      )}

      <ThemedView type="surface" style={styles.card} testID="progress-domain-history">
        <ThemedText type="subtitle">Rating over time</ThemedText>
        <MiniBarChart
          values={chartValues}
          testID="progress-domain-history-chart"
          emptyLabel="No rating updates in this window"
        />
        <ThemedText type="caption" themeColor="textSecondary">
          {chartCaption}
        </ThemedText>
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-domain-activity">
        <ThemedText type="subtitle">Activity</ThemedText>
        <View style={styles.heatmap}>
          {(() => {
            const weeks: number[][] = [];
            const counts = calendar.days.map((d) => d.count);
            const max = calendar.busiest?.count ?? 0;
            for (let i = 0; i < counts.length; i += 7) {
              weeks.push(counts.slice(i, i + 7).map((c) => (max > 0 ? c / max : 0)));
            }
            return weeks.map((week, wi) => (
              <HeatmapRow key={wi} testID={`progress-domain-heatmap-w${wi}`} intensities={week} />
            ));
          })()}
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {calendar.activeDays} active days · {calendar.totalSessions} sessions in this view.
        </ThemedText>
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-domain-games">
        <ThemedText type="subtitle">Games in this domain</ThemedText>
        {byGame.length > 0 ? (
          <View style={styles.rows}>
            {byGame.map(([gameId, count]) => {
              const aggregate = data.aggregates.find((a) => a.gameId === gameId);
              return (
                <Link
                  key={gameId}
                  href={{ pathname: '/progress-game' as any, params: { gameId } }}
                  asChild>
                  <Pressable
                    style={styles.row}
                    accessibilityRole="button"
                    testID={`progress-domain-game-${gameId}`}>
                    <ThemedText type="small">
                      {getGameDefinition(gameId)?.name ?? gameId}
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {count}×
                      {aggregate ? ` · best ${Math.round(aggregate.bestNormalized * 100)}%` : ''}
                    </ThemedText>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No sessions recorded for this domain.
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-domain-recent">
        <ThemedText type="subtitle">Recent sessions</ThemedText>
        {domainSessions.length > 0 ? (
          <View style={styles.rows}>
            {domainSessions.slice(0, 10).map((s) => (
              <Link key={s.id} href={`/results?id=${s.id}`} asChild>
                <Pressable style={styles.row} testID={`progress-domain-session-${s.id}`}>
                  <ThemedText type="small">
                    {getGameDefinition(s.gameId)?.name ?? s.gameId} · {formatDayLabel(s.completedAt)}
                  </ThemedText>
                  <ThemedText type="smallBold">{formatPercent(s.normalizedResult)}</ThemedText>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No sessions yet.
          </ThemedText>
        )}
      </ThemedView>
    </ScreenShell>
  );
}

/** Small labeled stat used in the domain summary row. */
function DomainStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="smallBold">{value}</ThemedText>
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
  windowRow: {
    marginTop: Spacing.one,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
  heatmap: {
    flexDirection: 'row',
    gap: Spacing.half,
    flexWrap: 'wrap',
  },
});
