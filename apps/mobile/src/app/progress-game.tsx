/**
 * Per-game analytics drill-down — `/progress-game?gameId=...`.
 *
 * Builds its view from the canonical session rows for one game only (via
 * `buildGameInsight`). It surfaces personal records (including a "last 5"
 * recent-form average), trend series for whatever metrics that game actually
 * persisted (score / accuracy / reaction time / difficulty), and an extended
 * recent-vs-lifetime comparison. Trends omit any metric whose data is not
 * present — no metrics are invented. Reaction-time trends treat lower as
 * better when coloring movement; difficulty is shown neutrally. Neutral,
 * non-clinical language throughout.
 *
 * V2 (campaign 010) additions: a statistical trend summary (spread/consistency
 * and per-day slope of the normalized series), the personal-best history chain
 * for normalized results and raw score, a rolling-average view that smooths
 * single-session spikes, and a neutral difficulty-progression block.
 */

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  buildDifficultyProgression,
  buildGameInsight,
  buildNormalizedBestHistory,
  buildRollingAverageSeries,
  buildScoreBestHistory,
  compareRecentVsLifetime,
  explainMetric,
  loadGameSessions,
  summarizePointTrend,
  trendImproved,
  type TimeWindowKey,
  WINDOW_LABELS,
  WINDOW_ORDER,
} from '@/analytics';
import { ScreenShell } from '@/components/screen-shell';
import { StateCard } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { MiniBarChart } from '@/components/progress-charts';
import {
  BackLink,
  Badge,
  Card,
  EmptyState,
  Entrance,
  ListRow,
  SectionGrid,
  SegmentedControl,
  Skeleton,
  SkeletonText,
  Spark,
} from '@/components/ui';
import { DomainColors, Radii, Spacing, type DomainName, type ThemeColor } from '@/constants/theme';
import type { AppDatabase, GameSessionRecord } from '@/db';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDbData } from '@/hooks/use-db-data';
import { useTheme } from '@/hooks/use-theme';
import { getGameDefinition } from '@/registry/registry';
import { directionArrow, formatDayLabel, formatMs, formatPercent, formatSigned, plural } from '@/analytics/format';

const EMPTY: GameSessionRecord[] = [];

/** Rolling-average width (sessions) for the per-game smoothing view. */
const ROLLING_AVERAGE_SESSIONS = 5;

/**
 * Domain identity key for a display domain name (folds display casing and the
 * long logic label — same lookup the Progress overview uses).
 */
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

export default function ProgressGameScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const params = useLocalSearchParams<{ gameId?: string }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : '';

  const [refreshKey, setRefreshKey] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data, loaded, error } = useDbData(
    useCallback((db: AppDatabase) => loadGameSessions(db, gameId, Date.now()), [gameId]),
    [refreshKey, gameId],
    EMPTY,
  );
  // Recovery action for the error state: bumping the key reruns the load.
  const retry = useCallback(() => setRefreshKey((k) => k + 1), []);
  const [windowKey, setWindowKey] = useState<TimeWindowKey>('30d');

  const insight = useMemo(() => buildGameInsight(gameId, data), [gameId, data]);

  const rvlWindow: '7d' | '30d' | '90d' = windowKey === 'all' ? '90d' : windowKey;
  const rvl = useMemo(
    () => compareRecentVsLifetime(data, rvlWindow, nowMs),
    [data, rvlWindow, nowMs],
  );

  // V2: statistical summary of the normalized series + smoothed rolling view.
  const normalizedSummary = useMemo(
    () => summarizePointTrend(insight?.series.normalized ?? []),
    [insight],
  );
  const normalizedImproved = trendImproved(normalizedSummary, 'higher-better');
  const rollingSeries = useMemo(
    () => buildRollingAverageSeries(insight?.series.normalized ?? [], ROLLING_AVERAGE_SESSIONS),
    [insight],
  );

  // V2: personal-best chains (normalized always; score only when persisted).
  const bestHistory = useMemo(
    () => buildNormalizedBestHistory(data, nowMs),
    [data, nowMs],
  );
  const scoreBestHistory = useMemo(
    () => buildScoreBestHistory(data, nowMs),
    [data, nowMs],
  );

  // V2: neutral difficulty progression over whatever the game stored.
  const difficultyProgression = useMemo(
    () => buildDifficultyProgression(data),
    [data],
  );

  const def = gameId ? getGameDefinition(gameId) : undefined;

  if (!gameId || !insight) {
    return (
      <ScreenShell>
        <BackLink testID="progress-game-back" onPress={() => router.back()} />
        <ThemedText type="title" testID="progress-game-title">
          {def?.name ?? gameId ?? 'Game'}
        </ThemedText>
        {!loaded ? (
          <>
            <Skeleton height={120} testID="progress-game-loading" />
            <SkeletonText lines={2} testID="progress-game-loading-text" />
          </>
        ) : error ? (
          <StateCard
            variant="error"
            title="Couldn't load game history"
            message="This game's data is unavailable right now."
            testID="progress-game-error"
            action={{ label: 'Try again', onPress: retry }}
          />
        ) : (
          <Card tone="accentSoft">
            <EmptyState
              icon={<Spark size={32} color={theme.accent} coreColor={theme.accentOn} />}
              title="No sessions yet"
              message="Play it to start tracking scores here."
              actionLabel={gameId ? 'View game details' : undefined}
              onAction={gameId ? () => router.push(`/game-detail/${gameId}`) : undefined}
              actionVariant="primary"
              testID="progress-game-empty"
            />
          </Card>
        )}
      </ScreenShell>
    );
  }

  const { available } = insight;
  const identityKey = def ? domainKeyFor(def.primaryCategory) : null;
  const family = identityKey ? DomainColors[scheme][identityKey] : null;

  return (
    <ScreenShell>
      <BackLink testID="progress-game-back" onPress={() => router.back()} />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View
            style={[styles.domainDot, { backgroundColor: family ? family.base : theme.accent }]}
          />
          <ThemedText type="title" testID="progress-game-title">
            {def?.name ?? gameId}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {insight.count} sessions · last played {formatDayLabel(insight.lastCompletedAt)} · since{' '}
          {formatDayLabel(insight.firstCompletedAt)}
        </ThemedText>
      </View>

      <SegmentedControl
        testID="progress-game-window"
        value={windowKey}
        onChange={(next) => setWindowKey(next as TimeWindowKey)}
        options={WINDOW_ORDER.map((k) => ({
          value: k,
          label: WINDOW_LABELS[k],
          testID: `progress-game-window-${k}`,
        }))}
      />

      <Entrance index={0}>
      <Card
        testID="progress-game-records"
        variant="hero"
        style={
          family
            ? { backgroundColor: family.soft, borderColor: family.base, borderWidth: 2 }
            : undefined
        }>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <View
              style={[styles.domainDot, { backgroundColor: family ? family.base : theme.accent }]}
            />
            <ThemedText type="eyebrow" style={family ? { color: family.softText } : undefined}>
              {def?.primaryCategory ?? 'Game'}
            </ThemedText>
          </View>
          <Badge label={`${insight.count} sessions`} tone="info" size="sm" />
        </View>
        <View style={styles.heroMetric}>
          <ThemedText type="eyebrow" style={family ? { color: family.softText } : undefined}>
            Best performance
          </ThemedText>
          <ThemedText
            type="numeralXl"
            style={{ color: family ? family.softText : theme.accent }}>
            {formatPercent(insight.bestNormalized)}
          </ThemedText>
        </View>
        <View style={styles.recordGrid}>
          <Record
            label="Best score"
            value={available.score ? String(insight.bestScore) : '—'}
            color={family ? family.softText : undefined}
          />
          <Record
            label="Best accuracy"
            value={available.accuracy ? formatPercent(insight.bestAccuracy ?? 0) : '—'}
            color={family ? family.softText : undefined}
          />
          <Record
            label="Fastest session"
            value={insight.fastestMs === null ? '—' : formatMs(insight.fastestMs)}
            color={family ? family.softText : undefined}
          />
          <Record
            label="Best reaction"
            value={available.reaction && insight.bestReactionMs !== null ? formatMs(insight.bestReactionMs) : '—'}
            color={family ? family.softText : undefined}
          />
          <Record
            label="Avg performance"
            value={formatPercent(insight.avgNormalized)}
            color={family ? family.softText : undefined}
          />
          {insight.recentFormNormalized !== null ? (
            <Record
              label={`Last ${insight.recentFormCount} avg`}
              value={formatPercent(insight.recentFormNormalized)}
              color={family ? family.softText : undefined}
            />
          ) : null}
        </View>
      </Card>
      </Entrance>

      <Card testID="progress-game-trend-summary">
        <ThemedText type="subtitle">Trend summary</ThemedText>
        <View style={styles.recordGrid}>
          <Record
            label="Sessions in series"
            value={String(normalizedSummary.count)}
          />
          <Record
            label="Consistency"
            value={
              normalizedSummary.consistency === null ? '—' : formatPercent(normalizedSummary.consistency)
            }
          />
          <Record
            label="Swing (±1σ)"
            value={normalizedSummary.stdDev === null ? '—' : formatPercent(normalizedSummary.stdDev)}
          />
          <Record
            label={`Slope / day (${WINDOW_LABELS[windowKey]})`}
            value={
              normalizedSummary.slopePerDay === null
                ? '—'
                : `${formatSigned(Math.round(normalizedSummary.slopePerDay * 1000) / 10)}%/d`
            }
          />
        </View>
        {normalizedImproved !== null ? (
          <ThemedText
            type="caption"
            themeColor={normalizedImproved ? 'success' : 'danger'}
            testID="progress-game-trend-direction">
            {directionArrow(normalizedSummary.direction)}{' '}
            {normalizedSummary.delta === null
              ? ''
              : `${formatSigned(Math.round(normalizedSummary.delta * 100))}% first → last`}
          </ThemedText>
        ) : (
          <ThemedText type="caption" themeColor="textSecondary">
            Not enough movement to describe a direction yet.
          </ThemedText>
        )}
        <ThemedText type="caption" themeColor="textSecondary">
          {explainMetric('trend-summary')}
        </ThemedText>
      </Card>

      <SectionGrid>
      {rollingSeries.length > 0 ? (
        <Card testID="progress-game-rolling">
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle">Rolling average</ThemedText>
            <ThemedText type="smallBold">
              {formatPercent(rollingSeries[rollingSeries.length - 1].value)}
            </ThemedText>
          </View>
          <MiniBarChart
            values={rollingSeries.map((p) => p.value)}
            testID="progress-game-rolling-chart"
            labels={sparsePointLabels(rollingSeries)}
            emptyLabel="Not enough sessions yet"
            summary={`Rolling last-${ROLLING_AVERAGE_SESSIONS}-session average across ${rollingSeries.length} points, latest ${formatPercent(rollingSeries[rollingSeries.length - 1].value)}.`}
          />
          <ThemedText type="caption" themeColor="textSecondary">
            Mean of the last {ROLLING_AVERAGE_SESSIONS} sessions at each point.{' '}
            {explainMetric('rolling-average')}
          </ThemedText>
        </Card>
      ) : null}

      {bestHistory.current !== null ? (
        <Card testID="progress-game-pb">
          <ThemedText type="subtitle">Best-result history</ThemedText>
          <View style={styles.rows}>
            {bestHistory.events.slice(-5).map((event) => (
              <View
                key={`${event.t}-${event.value}`}
                style={styles.row}
                testID={`progress-game-pb-${event.t}`}>
                <ThemedText type="small">{formatDayLabel(event.t)}</ThemedText>
                <ThemedText type="smallBold">{formatPercent(event.value)}</ThemedText>
              </View>
            ))}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            Current best has stood{' '}
            {bestHistory.standingDays === 0 ? 'less than a day' : `${bestHistory.standingDays ?? 0}d`} ·
            raised {bestHistory.timesBeaten} time{bestHistory.timesBeaten === 1 ? '' : 's'}.{' '}
            {explainMetric('personal-best-history')}
          </ThemedText>
        </Card>
      ) : null}
      </SectionGrid>

      {scoreBestHistory !== null && scoreBestHistory.events.length >= 2 ? (
        <Card testID="progress-game-pb-score">
          <ThemedText type="subtitle">Score-record history</ThemedText>
          <View style={styles.rows}>
            {scoreBestHistory.events.slice(-5).map((event) => (
              <View
                key={`${event.t}-${event.value}`}
                style={styles.row}
                testID={`progress-game-pb-score-${event.t}`}>
                <ThemedText type="small">{formatDayLabel(event.t)}</ThemedText>
                <ThemedText type="smallBold">{Math.round(event.value)}</ThemedText>
              </View>
            ))}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('personal-best-history')}
          </ThemedText>
        </Card>
      ) : null}
      <SectionGrid>
      <TrendBlock
        testID="progress-game-trend-normalized"
        label="Performance (normalized)"
        points={insight.series.normalized}
      />
      {available.score ? (
        <TrendBlock
          testID="progress-game-trend-score"
          label="Score"
          points={insight.series.score}
          format={(v) => String(Math.round(v))}
        />
      ) : null}
      {available.accuracy ? (
        <TrendBlock
          testID="progress-game-trend-accuracy"
          label="Accuracy"
          points={insight.series.accuracy}
          format={(v) => formatPercent(v)}
          chartTone="success"
        />
      ) : null}
      {available.reaction ? (
        <TrendBlock
          testID="progress-game-trend-reaction"
          label="Reaction time (lower is better)"
          points={insight.series.reaction}
          format={(v) => formatMs(v)}
          tone="lower-better"
          chartTone="info"
        />
      ) : null}
      {available.difficulty ? (
        <TrendBlock
          testID="progress-game-trend-difficulty"
          label="Difficulty (challenge rating)"
          points={insight.series.difficulty}
          format={(v) => formatPercent(v)}
          tone="neutral"
        />
      ) : null}
      </SectionGrid>
      {difficultyProgression.available ? (
        <Card testID="progress-game-difficulty-progression">
          <ThemedText type="subtitle">Difficulty progression</ThemedText>
          <View style={styles.recordGrid}>
            <Record
              label="First challenge"
              value={formatPercent(difficultyProgression.first ?? 0)}
            />
            <Record
              label="Latest challenge"
              value={formatPercent(difficultyProgression.latest ?? 0)}
            />
            <Record
              label="Peak challenge"
              value={formatPercent(difficultyProgression.peak ?? 0)}
            />
            <Record
              label="At/above your median"
              value={
                difficultyProgression.atOrAboveMedianShare === null
                  ? '—'
                  : formatPercent(difficultyProgression.atOrAboveMedianShare)
              }
            />
          </View>
          {difficultyProgression.delta !== null && difficultyProgression.delta !== 0 ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {directionArrow(difficultyProgression.direction)}{' '}
              {formatSigned(Math.round(difficultyProgression.delta * 100))}% first → latest.
            </ThemedText>
          ) : null}
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('difficulty-progression')}
          </ThemedText>
        </Card>
      ) : null}

      <Card testID="progress-game-rvl">
        <ThemedText type="subtitle">Recent vs lifetime</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Avg performance over {WINDOW_LABELS[windowKey]} versus all-time.
        </ThemedText>
        <View style={styles.summaryRow}>
          <Record
            label={`Avg (${WINDOW_LABELS[windowKey]})`}
            value={rvl.recentAvgNormalized === null ? '—' : formatPercent(rvl.recentAvgNormalized)}
          />
          <Record label="Avg (all)" value={formatPercent(rvl.lifetimeAvgNormalized)} />
          <Record
            label="Δ avg"
            value={
              rvl.deltaAvgNormalized === null
                ? '—'
                : formatSigned(Math.round((rvl.deltaAvgNormalized ?? 0) * 100)) + '%'
            }
          />
        </View>
        {rvl.lifetimeAvgAccuracy !== null ? (
          <View style={styles.summaryRow}>
            <Record
              label={`Acc (${WINDOW_LABELS[windowKey]})`}
              value={rvl.recentAvgAccuracy === null ? '—' : formatPercent(rvl.recentAvgAccuracy)}
            />
            <Record label="Acc (all)" value={formatPercent(rvl.lifetimeAvgAccuracy)} />
            <Record
              label="Δ acc"
              value={
                rvl.deltaAvgAccuracy === null
                  ? '—'
                  : formatSigned(Math.round((rvl.deltaAvgAccuracy ?? 0) * 100)) + '%'
              }
            />
          </View>
        ) : null}
        {rvl.lifetimeAvgReactionMs !== null ? (
          <View style={styles.summaryRow}>
            <Record
              label={`React (${WINDOW_LABELS[windowKey]})`}
              value={rvl.recentAvgReactionMs === null ? '—' : formatMs(rvl.recentAvgReactionMs)}
            />
            <Record label="React (all)" value={formatMs(rvl.lifetimeAvgReactionMs)} />
            <Record
              label="Δ react (− is better)"
              value={
                rvl.deltaAvgReactionMs === null
                  ? '—'
                  : formatSigned(Math.round(rvl.deltaAvgReactionMs)) + 'ms'
              }
            />
          </View>
        ) : null}
        {rvl.lifetimeAvgDifficulty !== null ? (
          <View style={styles.summaryRow}>
            <Record
              label={`Difficulty (${WINDOW_LABELS[windowKey]})`}
              value={rvl.recentAvgDifficulty === null ? '—' : formatPercent(rvl.recentAvgDifficulty)}
            />
            <Record label="Difficulty (all)" value={formatPercent(rvl.lifetimeAvgDifficulty)} />
            <Record
              label="Δ difficulty"
              value={
                rvl.deltaAvgDifficulty === null
                  ? '—'
                  : formatSigned(Math.round((rvl.deltaAvgDifficulty ?? 0) * 100)) + '%'
              }
            />
          </View>
        ) : null}
      </Card>

      <Card testID="progress-game-recent">
        <ThemedText type="subtitle">Recent sessions</ThemedText>
        <View style={styles.rows}>
          {data.slice(0, 10).map((session) => (
            <ListRow
              key={session.id}
              title={formatDayLabel(session.completedAt)}
              meta={formatPercent(session.normalizedResult)}
              accessibilityLabel={`${formatDayLabel(session.completedAt)} session, ${Math.round(session.normalizedResult * 100)} percent`}
              accessibilityHint="Open session results"
              onPress={() => router.push(`/results?id=${session.id}`)}
              testID={`progress-game-session-${session.id}`}
            />
          ))}
        </View>
      </Card>
    </ScreenShell>
  );
}

/**
 * One metric trend card. `tone` controls how the first→last movement is
 * colored: `higher-better` (default) greens a rise, `lower-better` (e.g.
 * reaction time) greens a fall, and `neutral` (e.g. difficulty, which is
 * neither good nor bad) never colors the movement. `chartTone` is the metric
 * identity fill for the bars.
 */
function TrendBlock({
  testID,
  label,
  points,
  format = (v) => String(Math.round(v)),
  tone = 'higher-better',
  chartTone = 'accent',
}: {
  testID: string;
  label: string;
  /** Chronological series (oldest first) — values plus their timestamps. */
  points: readonly { t: number; value: number }[];
  format?: (v: number) => string;
  tone?: 'higher-better' | 'lower-better' | 'neutral';
  chartTone?: ThemeColor;
}) {
  const values = points.map((p) => p.value);
  const last = values.length > 0 ? values[values.length - 1] : null;
  const first = values.length > 0 ? values[0] : null;
  const delta = last !== null && first !== null ? last - first : 0;
  const improved = tone === 'lower-better' ? delta < 0 : delta > 0;
  const regressed = tone === 'lower-better' ? delta > 0 : delta < 0;
  return (
    <Card testID={testID}>
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">{label}</ThemedText>
        {values.length > 0 ? (
          <ThemedText
            type="smallBold"
            themeColor={
              tone === 'neutral'
                ? 'textSecondary'
                : improved
                  ? 'success'
                  : regressed
                    ? 'danger'
                    : 'textSecondary'
            }>
            {format(last ?? 0)}
            {delta !== 0 ? ` (${delta > 0 ? '+' : ''}${format(delta)})` : ''}
          </ThemedText>
        ) : null}
      </View>
      <MiniBarChart
        values={values}
        testID={`${testID}-chart`}
        tone={chartTone}
        labels={sparsePointLabels(points)}
        summary={
          values.length === 0
            ? `${label}: no sessions yet.`
            : `${label} across ${plural(values.length, 'session')}, latest ${format(last ?? 0)}, first ${format(first ?? 0)}.`
        }
      />
      {points.length > 1 ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {formatDayLabel(points[0].t)} → {formatDayLabel(points[points.length - 1].t)} · oldest → newest.
        </ThemedText>
      ) : null}
    </Card>
  );
}

function Record({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.record}>
      <ThemedText
        type="numeral"
        themeColor={color ? undefined : 'accent'}
        style={color ? { color } : undefined}>
        {value}
      </ThemedText>
      <ThemedText
        type="caption"
        themeColor={color ? undefined : 'textSecondary'}
        style={color ? { color } : undefined}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
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
  heroMetric: {
    gap: Spacing.half,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  recordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  record: {
    width: '30%',
    gap: Spacing.half,
  },
  summaryRow: {
    flexDirection: 'row',
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
});
