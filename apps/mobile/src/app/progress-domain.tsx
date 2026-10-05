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
 *
 * V2 (campaign 010) additions: a statistical trend summary of the in-window
 * rating series (spread/consistency/slope), plus accuracy, reaction-time and
 * difficulty-progression views over the domain's own sessions — each shown
 * only when the underlying games actually stored the metric.
 */

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  buildAccuracyTrend,
  buildActivityCalendar,
  buildDifficultyProgression,
  buildDomainInsights,
  buildReactionTrend,
  explainMetric,
  filterByWindow,
  isWithinWindow,
  loadProgressSnapshot,
  summarizePointTrend,
  trendImproved,
  type ProgressSnapshot,
  type TimeWindowKey,
  WINDOW_LABELS,
  WINDOW_ORDER,
  WINDOW_DAYS,
} from '@/analytics';
import { ScreenShell } from '@/components/screen-shell';
import { StateCard } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { MiniBarChart, HeatmapRow } from '@/components/progress-charts';
import {
  BackLink,
  Badge,
  Card,
  EmptyState,
 
  ListRow,
  SectionGrid,
  SegmentedControl,
  Skeleton,
  SkeletonText,
  Spark,
  StatBlock,
  Tappable,
  useSafeBack,
} from '@/components/ui';
import { DomainColors, Radii, Spacing, type ColorFamily, type DomainName } from '@/constants/theme';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import type { AppDatabase, GameSessionRecord, RatingHistoryEntry } from '@/db';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDbData } from '@/hooks/use-db-data';
import { useTheme } from '@/hooks/use-theme';
import { getGameDefinition } from '@/registry/registry';
import { parseCanonicalDomain } from '@/routing/route-params';
import {
  directionArrow,
  formatDayLabel,
  formatMs,
  formatPercent,
  formatSigned,
  plural,
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
  return loadProgressSnapshot(db, Date.now());
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
  const theme = useTheme();
  // 058: cold deep links land with an empty stack — fall back to /progress.
  const goBack = useSafeBack('/progress');
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const params = useLocalSearchParams<{ domain?: string }>();
  // App-owned input envelope (Campaign 053): malformed/oversized domains
  // render the empty-domain state instead of being queried.
  const domain = parseCanonicalDomain(params.domain) ?? '';

  const [refreshKey, setRefreshKey] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data, loaded, error } = useDbData(load, [refreshKey, domain], EMPTY);
  // Recovery action for the error state: bumping the key reruns the load.
  const retry = useCallback(() => setRefreshKey((k) => k + 1), []);
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

  const historyPoints = useMemo(
    () =>
      data.ratingHistory
        .filter((h: RatingHistoryEntry) => h.domain === domain)
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((h) => ({ t: h.createdAt, value: h.ratingAfter })),
    [data.ratingHistory, domain],
  );

  // Prefer the in-window slice for the trend; fall back to all-time when the
  // window holds fewer than two updates (a single point has no shape).
  const windowHistoryPoints = useMemo(
    () => historyPoints.filter((p) => isWithinWindow(p.t, nowMs, windowKey)),
    [historyPoints, nowMs, windowKey],
  );
  const chartPoints = windowHistoryPoints.length >= 2 ? windowHistoryPoints : historyPoints;
  const chartValues = chartPoints.map((p) => p.value);
  const chartLabels = sparsePointLabels(chartPoints);
  const chartCaption =
    windowHistoryPoints.length >= 2
      ? `${windowHistoryPoints.length} rating updates in this window.`
      : `${historyPoints.length} recorded updates — all-time shown (fewer than 2 in this window).`;

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

  // V2: statistical summary of the domain's rating series — in-window when the
  // window holds at least two updates, all-time otherwise (same fallback the
  // chart above uses).
  const trendSummary = useMemo(() => {
    const inWindow = historyPoints.filter((p) => isWithinWindow(p.t, nowMs, windowKey));
    return summarizePointTrend(inWindow.length >= 2 ? inWindow : historyPoints);
  }, [historyPoints, nowMs, windowKey]);

  // V2: metric trends over this domain's own sessions (only when stored).
  const accuracyTrend = useMemo(() => buildAccuracyTrend(domainSessions), [domainSessions]);
  const reactionTrend = useMemo(() => buildReactionTrend(domainSessions), [domainSessions]);
  const difficultyTrend = useMemo(
    () => buildDifficultyProgression(domainSessions),
    [domainSessions],
  );
  const domainTrendImproved = trendImproved(trendSummary, 'higher-better');

  if (!domain) {
    return (
      <ScreenShell>
        <ThemedText type="title">Domain</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" testID="progress-domain-missing">
          No domain selected.
        </ThemedText>
        <Tappable
          testID="progress-domain-back-link"
          onPress={() => router.replace('/progress')}
          style={styles.textLinkRow}
          accessibilityLabel="Back to Progress">
          <ThemedText type="smallBold" themeColor="accent">
            ‹ Back to Progress
          </ThemedText>
        </Tappable>
      </ScreenShell>
    );
  }

  const unseen = insight?.status === 'unseen';
  const key = domainKeyFor(domain);
  const family = key ? DomainColors[scheme][key] : null;

  return (
    <ScreenShell>
      <BackLink testID="progress-domain-back" onPress={goBack} />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View
            style={[styles.domainDot, { backgroundColor: family ? family.base : theme.accent }]}
          />
          <ThemedText type="title" testID="progress-domain-title">
            {domain}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Rating history and contributing games.
        </ThemedText>
      </View>

      {/* Quiet window row (lock §5/§8): tracked kicker + segmented control
          between hairline rules — the same grammar as the Progress tab. */}
      <View
        style={[styles.windowRow, { borderTopColor: theme.border, borderBottomColor: theme.border }]}
        testID="progress-domain-window-row">
        <ThemedText type="eyebrow" themeColor="textMuted">
          WINDOW
        </ThemedText>
        <SegmentedControl
          testID="progress-domain-window"
          value={windowKey}
          onChange={(next) => setWindowKey(next as TimeWindowKey)}
          compact
          options={WINDOW_ORDER.map((k) => ({
            value: k,
            label: WINDOW_LABELS[k],
            testID: `progress-domain-window-${k}`,
          }))}
        />
      </View>

      {!loaded ? (
        <>
          <Skeleton height={160} testID="progress-domain-loading" />
          <SkeletonText lines={3} testID="progress-domain-loading-text" />
        </>
      ) : error ? (
        <StateCard
          variant="error"
          title="Couldn't load domain"
          message="This domain's data is unavailable right now."
          testID="progress-domain-error"
          action={{ label: 'Try again', onPress: retry }}
        />
      ) : (
        <>
      {unseen ? (
        <Card variant="outlined">
          <EmptyState
            icon={
              <Spark
                size={36}
                color={family ? family.base : theme.accent}
                coreColor={theme.surface}
              />
            }
            title="Not trained yet"
            message={`No ${domain} sessions yet.`}
            actionLabel={`Find a ${domain} game`}
            onAction={() => router.replace('/games')}
            actionVariant="primary"
            testID="progress-domain-unseen"
          />
          <ThemedText type="caption" themeColor="textSecondary">
            This domain contributes the starting rating ({insight?.rating ?? 1000}) to
            your overall composite until you train it.
          </ThemedText>
        </Card>
      ) : (
        <Card testID="progress-domain-summary" variant="outlined">
          <View style={styles.cardHeader}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Current rating
            </ThemedText>
            <Badge
              label={insight?.status === 'stale' ? 'Stale' : 'Fresh'}
              tone={insight?.status === 'stale' ? 'warning' : 'success'}
              size="sm"
            />
          </View>
          <View style={styles.ratingRow}>
            <ThemedText type="numeralXl">
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
          <View testID="progress-domain-stats">
            <FactRow
              marker="01"
              label={`Sessions (${WINDOW_LABELS[windowKey]})`}
              value={String(windowedDomainSessions.length)}
            />
            <FactRow
              marker="02"
              label={`Avg (${WINDOW_LABELS[windowKey]})`}
              value={windowAvg === null ? '—' : formatPercent(windowAvg)}
            />
            <FactRow
              marker="03"
              label="Best ever"
              value={lifetimeBest === null ? '—' : formatPercent(lifetimeBest)}
              divider={false}
            />
          </View>
        </Card>
      )}

      <SectionGrid>
      <Card testID="progress-domain-history">
        <DomainHeading label="Rating over time" family={family} />
        <MiniBarChart
          values={chartValues}
          testID="progress-domain-history-chart"
          labels={chartLabels}
          emptyLabel="No rating updates in this window"
          summary={
            chartValues.length === 0
              ? 'No rating updates in this window'
              : `Rating history with ${chartValues.length} updates, latest ${chartValues[chartValues.length - 1]}. ${chartCaption}`
          }
        />
        <ThemedText type="caption" themeColor="textSecondary">
          {chartCaption}
        </ThemedText>
      </Card>

      {trendSummary.count >= 2 ? (
        <Card testID="progress-domain-trend">
          <View style={styles.cardHeader}>
            <DomainHeading label="Trend summary" family={family} />
            {domainTrendImproved !== null ? (
              <ThemedText
                type="smallBold"
                themeColor={domainTrendImproved ? 'success' : 'danger'}
                testID="progress-domain-trend-direction">
                {directionArrow(trendSummary.direction)}{' '}
                {formatSigned(Math.round(trendSummary.delta ?? 0))}
              </ThemedText>
            ) : null}
          </View>
          <View>
            <FactRow
              marker="01"
              label="Updates in series"
              value={String(trendSummary.count)}
            />
            <FactRow
              marker="02"
              label="Consistency"
              value={
                trendSummary.consistency === null
                  ? '—'
                  : formatPercent(trendSummary.consistency)
              }
            />
            <FactRow
              marker="03"
              label="Slope / day"
              value={
                trendSummary.slopePerDay === null
                  ? '—'
                  : `${formatSigned(Math.round(trendSummary.slopePerDay * 1000) / 10)}`
              }
              divider={false}
            />
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('trend-summary')}
          </ThemedText>
        </Card>
      ) : null}
      </SectionGrid>

      <SectionGrid>
      {accuracyTrend.available ? (
        <Card testID="progress-domain-accuracy">
          <View style={styles.cardHeader}>
            <DomainHeading label="Accuracy over time" family={family} />
            <ThemedText type="smallBold">
              {accuracyTrend.recentMean === null
                ? '—'
                : formatPercent(accuracyTrend.recentMean)}{' '}
              recent
            </ThemedText>
          </View>
          <MiniBarChart
            values={accuracyTrend.series.map((p) => p.value)}
            testID="progress-domain-accuracy-chart"
            tone="success"
            labels={sparsePointLabels(accuracyTrend.series)}
            summary={
              accuracyTrend.recentMean === null
                ? 'Accuracy trend with no recent average yet.'
                : `Accuracy trend across ${plural(accuracyTrend.series.length, 'session')}, recent average ${formatPercent(accuracyTrend.recentMean)}.`
            }
          />
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('accuracy-trend')}
          </ThemedText>
        </Card>
      ) : null}

      {reactionTrend.available ? (
        <Card testID="progress-domain-reaction">
          <View style={styles.cardHeader}>
            <DomainHeading label="Reaction time (lower is better)" family={family} />
            <ThemedText type="smallBold">
              {reactionTrend.recentMean === null ? '—' : formatMs(reactionTrend.recentMean)} recent
            </ThemedText>
          </View>
          <MiniBarChart
            values={reactionTrend.series.map((p) => p.value)}
            testID="progress-domain-reaction-chart"
            tone="info"
            labels={sparsePointLabels(reactionTrend.series)}
            summary={
              reactionTrend.recentMean === null
                ? 'Reaction trend with no recent average yet.'
                : `Reaction-time trend across ${plural(reactionTrend.series.length, 'session')}, recent average ${formatMs(reactionTrend.recentMean)}. Lower is better.`
            }
          />
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('reaction-trend')}
          </ThemedText>
        </Card>
      ) : null}
      </SectionGrid>

      {difficultyTrend.available ? (
        <Card testID="progress-domain-difficulty">
          <DomainHeading label="Difficulty attempted" family={family} />
          <MiniBarChart
            values={difficultyTrend.series.map((p) => p.value)}
            testID="progress-domain-difficulty-chart"
            labels={sparsePointLabels(difficultyTrend.series)}
            summary={`Difficulty attempted across ${plural(difficultyTrend.series.length, 'session')}, first ${formatPercent(difficultyTrend.first ?? 0)}, latest ${formatPercent(difficultyTrend.latest ?? 0)}, peak ${formatPercent(difficultyTrend.peak ?? 0)}.`}
          />
          <ThemedText type="caption" themeColor="textSecondary">
            First {formatPercent(difficultyTrend.first ?? 0)} → latest{' '}
            {formatPercent(difficultyTrend.latest ?? 0)} · peak{' '}
            {formatPercent(difficultyTrend.peak ?? 0)}.{' '}
            {explainMetric('difficulty-progression')}
          </ThemedText>
        </Card>
      ) : null}

      <Card testID="progress-domain-activity">
        <DomainHeading label="Activity" family={family} />
        <ThemedText type="caption" themeColor="textSecondary">
          {calendar.days.length > 0
            ? `${formatDayLabel(Date.parse(`${calendar.days[0].dateKey}T00:00:00Z`))} – ${formatDayLabel(Date.parse(`${calendar.days[calendar.days.length - 1].dateKey}T00:00:00Z`))}`
            : 'No activity in this view yet'}
        </ThemedText>
        <View style={styles.heatmap}>
          {(() => {
            const max = calendar.busiest?.count ?? 0;
            const weeks: typeof calendar.days[] = [];
            for (let i = 0; i < calendar.days.length; i += 7) {
              weeks.push(calendar.days.slice(i, i + 7));
            }
            return weeks.map((week, wi) => {
              const weekSessions = week.reduce((sum, day) => sum + day.count, 0);
              const weekActive = week.filter((day) => day.count > 0).length;
              return (
                <HeatmapRow
                  key={wi}
                  testID={`progress-domain-heatmap-w${wi}`}
                  intensities={week.map((d) => (max > 0 ? d.count / max : 0))}
                  weekLabel={`Week of ${formatDayLabel(Date.parse(`${week[0].dateKey}T00:00:00Z`))}: ${weekSessions} session${weekSessions === 1 ? '' : 's'} over ${weekActive} active day${weekActive === 1 ? '' : 's'}`}
                />
              );
            });
          })()}
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {calendar.activeDays} active days · {calendar.totalSessions} sessions in this view.
        </ThemedText>
      </Card>

      <Card testID="progress-domain-games">
        <DomainHeading label="Games in this domain" family={family} />
        {byGame.length > 0 ? (
          <View style={styles.rows}>
            {byGame.map(([gameId, count]) => {
              const aggregate = data.aggregates.find((a) => a.gameId === gameId);
              return (
                <ListRow
                  key={gameId}
                  title={getGameDefinition(gameId)?.name ?? gameId}
                  meta={`${count}×${aggregate ? ` · best ${Math.round(aggregate.bestNormalized * 100)}%` : ''}`}
                  onPress={() => router.push(`/progress-game?gameId=${encodeURIComponent(gameId)}`)}
                  accessibilityHint={`Open ${getGameDefinition(gameId)?.name ?? gameId} analytics`}
                  testID={`progress-domain-game-${gameId}`}
                />
              );
            })}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No sessions recorded for this domain.
          </ThemedText>
        )}
      </Card>

      <Card testID="progress-domain-recent">
        <DomainHeading label="Recent sessions" family={family} />
        {domainSessions.length > 0 ? (
          <View style={styles.rows}>
            {domainSessions.slice(0, 10).map((s) => (
              <ListRow
                key={s.id}
                title={`${getGameDefinition(s.gameId)?.name ?? s.gameId} · ${formatDayLabel(s.completedAt)}`}
                meta={formatPercent(s.normalizedResult)}
                onPress={() => router.push(`/results?id=${s.id}`)}
                accessibilityHint="Open session results"
                testID={`progress-domain-session-${s.id}`}
              />
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No sessions yet.
          </ThemedText>
        )}
      </Card>
        </>
      )}
    </ScreenShell>
  );
}

/** Domain identity key for a display domain name (folds display casing and the long logic label). */
function domainKeyFor(domain: string): DomainName | null {
  const normalized = domain.trim().toLowerCase();
  if (normalized.startsWith('logic')) return 'logic';
  return normalized in DomainColors.light ? (normalized as DomainName) : null;
}

/** Sparse date labels (first/middle/last) so trend bars carry axis context without clutter. */
function sparsePointLabels(points: readonly { t: number }[]): string[] {
  const count = points.length;
  if (count === 0) return [];
  const middle = Math.floor((count - 1) / 2);
  return points.map((point, index) =>
    index === 0 || index === count - 1 || (count > 4 && index === middle)
      ? formatDayLabel(point.t)
      : '',
  );
}

/**
 * Domain section heading: a small domain-hued bar plus the title in the
 * domain text slot, so every card on this screen carries the identity of the
 * domain being drilled into (colour is never the only signal — the title
 * already names it).
 */
function DomainHeading({ label, family }: { label: string; family: ColorFamily | null }) {
  const theme = useTheme();
  return (
    <View style={styles.headingRow}>
      <View
        style={[styles.headingBar, { backgroundColor: family ? family.base : theme.accent }]}
      />
      <ThemedText type="subtitle" style={family ? { color: family.text } : undefined}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Change 076 (lock section 8): numbered hairline fact row for domain stats. */
function FactRow({
  marker,
  label,
  value,
  divider = true,
}: {
  marker: string;
  label: string;
  value: string;
  divider?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
        paddingVertical: Spacing.twoHalf,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: theme.border,
      }}>
      <ThemedText type="caption" themeColor="textMuted" style={{ minWidth: 24 }}>
        {marker}
      </ThemedText>
      <ThemedText type="bodySmall" themeColor="text" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      <ThemedText type="label" themeColor="text">
        {value}
      </ThemedText>
    </View>
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
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  domainDot: {
    width: Spacing.three,
    height: Spacing.three,
    borderRadius: Radii.pill,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headingBar: {
    width: Spacing.one,
    height: Spacing.three,
    borderRadius: Radii.pill,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
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
