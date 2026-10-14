/**
 * Progress detail — `/progress-detail` (WP-3F; constitution §21).
 *
 * Deeper Progress dashboard one tap away from the Progress tab: per-domain
 * rating history (the append-only `rating_history` tail, grouped by domain as
 * a chronological mini-trend), per-game records (best normalized score,
 * session count, last played, linked to `/game-detail/[id]`) and the most
 * recent sessions (linked to `/results`).
 *
 * V2 (campaign 010) additions computed over a wider recent-session window:
 * the personal-best history chain on the normalized scale, a rolling-average
 * smoothing view, and cross-game accuracy / reaction-time trends (each shown
 * only when games actually stored those metrics).
 *
 * Mirrors the Progress tab's data-loading pattern (`useFocusEffect` +
 * `useDbData`), its card/row styling, and its graceful empty states when the
 * db is unavailable or empty (no crashes; stable `progress-detail-*` testIDs).
 */

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import {
  buildAccuracyTrend,
  buildNormalizedBestHistory,
  buildReactionTrend,
  buildRollingAverageSeries,
  explainMetric,
} from '@/analytics';
import { ScreenShell } from '@/components/screen-shell';
import { StateCard } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { MiniBarChart } from '@/components/progress-charts';
import {
  BackLink,
  Badge,
  Card,
  Entrance,
  HAIRLINE,
  Report,
  ReportRow,
  Button,
  SectionGrid,
  Skeleton,
  SkeletonText,
  useSafeBack,
} from '@/components/ui';
import { DomainColors, Radii, Spacing, type DomainName } from '@/constants/theme';
import type { AppDatabase, GameAggregate, GameSessionRecord, RatingHistoryEntry } from '@/db';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDbData } from '@/hooks/use-db-data';
import { useTheme } from '@/hooks/use-theme';
import { getGameDefinition } from '@/registry/registry';
import { formatDayLabel, formatMs, formatPercent, plural } from '@/analytics/format';

/** How many rating-history entries (newest first) feed the per-domain trends.
 *  Bounded well above the old value of 20 so 8-domain histories stay visible
 *  for a while, while still never loading the whole append-only table. */
const HISTORY_LIMIT = 120;
/** How many entries per domain to render before collapsing into "+N earlier". */
const PER_DOMAIN_SHOWN = 12;
/** How many recent sessions to list. */
const RECENT_LIMIT = 10;
/** Wider recent-session window feeding the V2 aggregates. */
const ANALYTICS_WINDOW = 120;
/** Rolling-average width (sessions) for the smoothing view. */
const ROLLING_AVERAGE_SESSIONS = 5;

interface ProgressDetailData {
  history: RatingHistoryEntry[];
  aggregates: GameAggregate[];
  recent: GameSessionRecord[];
}

async function loadProgressDetail(db: AppDatabase): Promise<ProgressDetailData> {
  const throughMs = Date.now();
  const [history, aggregates, recent] = await Promise.all([
    db.ratings.getHistory(HISTORY_LIMIT, throughMs),
    db.sessions.getAggregates(throughMs),
    db.sessions.listRecent(ANALYTICS_WINDOW, throughMs),
  ]);
  return { history, aggregates, recent };
}

const EMPTY: ProgressDetailData = { history: [], aggregates: [], recent: [] };

export default function ProgressDetailScreen() {
  // 058: cold deep links land with an empty stack — fall back to /progress.
  const goBack = useSafeBack('/progress');
  // Reload whenever the screen regains focus (a session may have just landed).
  const [refreshKey, setRefreshKey] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data, loaded, error } = useDbData(loadProgressDetail, [refreshKey], EMPTY);
  // Recovery action for the error state: bumping the key reruns the load.
  const retry = useCallback(() => setRefreshKey((k) => k + 1), []);

  // V2 aggregates over the wider recent-session window.
  const bestHistory = useMemo(
    () => buildNormalizedBestHistory(data.recent, nowMs),
    [data.recent, nowMs],
  );
  const rollingSeries = useMemo(() => {
    const ascending = data.recent
      .slice()
      .sort((a, b) => a.completedAt - b.completedAt)
      .map((s) => ({ t: s.completedAt, value: s.normalizedResult }));
    return buildRollingAverageSeries(ascending, ROLLING_AVERAGE_SESSIONS);
  }, [data.recent]);
  const accuracyTrend = useMemo(() => buildAccuracyTrend(data.recent), [data.recent]);
  const reactionTrend = useMemo(() => buildReactionTrend(data.recent), [data.recent]);

  // Group the newest-first history into per-domain lists (entries stay newest
  // first; each domain renders them chronologically as a mini-trend).
  const byDomain = new Map<string, RatingHistoryEntry[]>();
  for (const entry of data.history) {
    const list = byDomain.get(entry.domain);
    if (list) {
      list.push(entry);
    } else {
      byDomain.set(entry.domain, [entry]);
    }
  }
  const domainNames = [...byDomain.keys()].sort();

  return (
    <ScreenShell>
      <BackLink testID="progress-detail-back" onPress={goBack} />

      <View style={styles.header}>
        <ThemedText type="title" testID="progress-detail-title">
          Training history
        </ThemedText>
        <ThemedText type="bodySmall" themeColor="textSecondary">
          Recorded results, domain updates and game records.
        </ThemedText>
      </View>

      {!loaded ? (
        <>
          <Skeleton height={160} testID="progress-detail-loading" />
          <SkeletonText lines={3} testID="progress-detail-loading-text" />
        </>
      ) : error ? (
        <StateCard
          variant="error"
          title="Couldn't load history"
          message="Your progress data is unavailable right now."
          testID="progress-detail-error"
          action={{ label: 'Try again', onPress: retry }}
        />
      ) : (
        <>

      {data.recent.length === 0 && data.history.length === 0 && data.aggregates.length === 0 ? (
        <Button variant="secondary" label="Browse games" testID="progress-detail-browse-empty"
          onPress={() => router.replace('/games')} />
      ) : null}
      <ThemedText type="caption" themeColor="textSecondary" testID="progress-detail-scope">
        Latest {data.recent.length} sessions and {data.history.length} rating updates loaded, up to {ANALYTICS_WINDOW} of each. Game records are all-time.
      </ThemedText>

      {bestHistory.current !== null ? (
        <Entrance index={0}>
          {/* The screen's one focal panel (lock §5): the personal-best numeral
              in reading ink, its raising events as numbered hairline rows. */}
          <Card style={styles.evidenceCard} variant="outlined" padding="md" testID="progress-detail-pb">
            <View style={styles.cardHeader} testID="progress-detail-pb-header">
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Recent personal best
              </ThemedText>
              <Badge
                label={`${data.recent.length} session${data.recent.length === 1 ? '' : 's'}`}
                tone="info"
                size="sm"
              />
            </View>
            <View style={styles.heroRow}>
              <ThemedText type="headline">
                {formatPercent(bestHistory.current.value)}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {formatDayLabel(bestHistory.current.t)}
              </ThemedText>
            </View>
            {/* The hero already states the best value and its date: enumerate
                the raising events only when there is actually a history to
                show (Campaign 026 visual-QA: a single event parroted the
                hero verbatim). */}
            {bestHistory.events.length > 1 ? (
              <View style={styles.rows}>
                {bestHistory.events.slice(-5).map((event, index) => (
                  <ReportRow
                    key={`${event.t}-${event.value}`}
                    label={formatDayLabel(event.t)}
                    value={formatPercent(event.value)}
                    divider={index < Math.min(bestHistory.events.length, 5) - 1}
                    testID={`progress-detail-pb-${event.t}`}
                  />
                ))}
              </View>
            ) : null}
            <ThemedText type="caption" themeColor="textSecondary">
              Best across the {data.recent.length} session{data.recent.length === 1 ? '' : 's'} loaded (up to {ANALYTICS_WINDOW}) ·
              held{' '}
              {bestHistory.standingDays === 0
                ? 'for less than a day'
                : `for ${bestHistory.standingDays ?? 0}d`}. {explainMetric('personal-best-history')}
            </ThemedText>
          </Card>
        </Entrance>
      ) : null}

      <Entrance index={1}>
        <Report testID="progress-detail-domains" title="Domain history">
          {domainNames.length > 0 ? (
            <View style={styles.rows}>
              {domainNames.map((domain) => (
                <DomainHistory key={domain} domain={domain} entries={byDomain.get(domain)!} />
              ))}
            </View>
          ) : (
            <ThemedText type="bodySmall" themeColor="textSecondary" testID="progress-detail-domains-empty">Play a game to build a per-domain trend.</ThemedText>
          )}
        </Report>
      </Entrance>

      <Entrance index={2}>
      <SectionGrid>
      {rollingSeries.length > 0 ? (
        <Card style={styles.evidenceCard} testID="progress-detail-rolling">
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle">Rolling average</ThemedText>
            <ThemedText type="smallBold">
              {formatPercent(rollingSeries[rollingSeries.length - 1].value)}
            </ThemedText>
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {formatDayLabel(rollingSeries[0].t)} to {formatDayLabel(rollingSeries[rollingSeries.length - 1].t)} · {rollingSeries.length} recorded points.
          </ThemedText>
          <MiniBarChart
            values={rollingSeries.map((p) => p.value)}
            testID="progress-detail-rolling-chart"
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

      {accuracyTrend.available ? (
        <Card style={styles.evidenceCard} testID="progress-detail-accuracy">
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle">Accuracy over time</ThemedText>
            <ThemedText type="smallBold">
              {accuracyTrend.recentMean === null
                ? '—'
                : formatPercent(accuracyTrend.recentMean)}{' '}
              recent
            </ThemedText>
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {formatDayLabel(accuracyTrend.series[0].t)} to {formatDayLabel(accuracyTrend.series[accuracyTrend.series.length - 1].t)} · {accuracyTrend.series.length} recorded points.
          </ThemedText>
          <MiniBarChart
            values={accuracyTrend.series.map((p) => p.value)}
            testID="progress-detail-accuracy-chart"
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
      </SectionGrid>
      </Entrance>

      <Entrance index={3}>
      <SectionGrid>
      {reactionTrend.available ? (
        <Card style={styles.evidenceCard} testID="progress-detail-reaction">
          <View style={styles.cardHeader}>
            <ThemedText type="subtitle">Reaction time (lower is better)</ThemedText>
            <ThemedText type="smallBold">
              {reactionTrend.recentMean === null ? '—' : formatMs(reactionTrend.recentMean)} recent
            </ThemedText>
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {formatDayLabel(reactionTrend.series[0].t)} to {formatDayLabel(reactionTrend.series[reactionTrend.series.length - 1].t)} · {reactionTrend.series.length} recorded points.
          </ThemedText>
          <MiniBarChart
            values={reactionTrend.series.map((p) => p.value)}
            testID="progress-detail-reaction-chart"
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
      </Entrance>

      <Entrance index={4}>
        <Card style={styles.evidenceCard} testID="progress-detail-games">
          <ThemedText type="subtitle">Game records</ThemedText>
          {data.aggregates.length > 0 ? (
            <View style={styles.rows}>
              {data.aggregates.map((a, index) => (
                <ReportRow
                  key={a.gameId}
                  label={getGameDefinition(a.gameId)?.name ?? a.gameId}
                  hint={`Last played ${formatDayLabel(a.lastCompletedAt)}`}
                  value={`${a.count}× · best ${Math.round(a.bestNormalized * 100)}%`}
                  onPress={() => router.push(`/game-detail/${a.gameId}`)}
                  accessibilityHint="Open game details"
                  divider={index < data.aggregates.length - 1}
                  testID={`progress-detail-game-${a.gameId}`}
                />
              ))}
            </View>
          ) : (
            <ThemedText type="bodySmall" themeColor="textSecondary" testID="progress-detail-games-empty">Your records will show up here after a session.</ThemedText>
          )}
        </Card>
      </Entrance>

      <Entrance index={5}>
        <Card style={styles.evidenceCard} testID="progress-detail-sessions">
          <ThemedText type="subtitle">Recent sessions</ThemedText>
          {data.recent.length > 0 ? (
            <View style={styles.rows}>
              {data.recent.slice(0, RECENT_LIMIT).map((session, index) => (
                <ReportRow
                  key={session.id}
                  label={`${getGameDefinition(session.gameId)?.name ?? session.gameId} · ${formatDayLabel(session.completedAt)}`}
                  value={`${Math.round(session.normalizedResult * 100)}%`}
                  onPress={() => router.push(`/results?id=${session.id}`)}
                  accessibilityHint="Open session results"
                  divider={index < Math.min(data.recent.length, RECENT_LIMIT) - 1}
                  testID={`progress-detail-session-${session.id}`}
                />
              ))}
            </View>
          ) : (
            <ThemedText type="bodySmall" themeColor="textSecondary" testID="progress-detail-sessions-empty">Your latest sessions will show up here.</ThemedText>
          )}
        </Card>
      </Entrance>
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

/** testID slug for a domain (`Logic & Problem Solving` → `logicproblemsolving`). */
function domainSlug(domain: string): string {
  return domain.replace(/[^a-z]/gi, '').toLowerCase();
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
 * One domain's rating trend as an identity block: dot + domain-hued name,
 * latest movement and chronological entries. `entries` arrive newest first
 * from the repo; only the newest `PER_DOMAIN_SHOWN` are rendered, with an
 * "+N earlier" note when truncated. testIDs stay contracted.
 */
function DomainHistory({
  domain,
  entries,
}: {
  domain: string;
  entries: readonly RatingHistoryEntry[];
}) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const key = domainKeyFor(domain);
  const family = key ? DomainColors[scheme][key] : null;
  const slug = domainSlug(domain);
  const [expanded, setExpanded] = useState(false);
  const chronological = [...entries].reverse();
  const shownLimit = expanded ? PER_DOMAIN_SHOWN : 3;
  const hiddenCount = Math.max(0, chronological.length - shownLimit);
  const shown = chronological.slice(-shownLimit);
  const latest = entries[0];
  return (
    <View style={[styles.domainBlock, { borderBottomColor: theme.border }]} testID={`progress-detail-domain-${slug}`}>
      <ReportRow label={domain} value={latest ? String(latest.ratingAfter) : '—'}
        icon={<View style={[styles.domainDot, { backgroundColor: family ? family.base : theme.borderStrong }]} />}
        hint="Open the domain's rating history and contributing games"
        onPress={() => router.push(`/progress-domain?domain=${encodeURIComponent(domain)}`)}
        accessibilityHint="Open domain details" />
      {latest ? <ThemedText type="caption" themeColor="textSecondary" testID={`progress-detail-domain-latest-${slug}`}>
        Latest update {latest.delta >= 0 ? '+' : ''}{latest.delta} · {formatDayLabel(latest.createdAt)}
      </ThemedText> : null}
      {shown.map((entry, index) => <ReportRow key={entry.id}
        label={formatDayLabel(entry.createdAt)} value={`${entry.ratingAfter} (${entry.delta >= 0 ? '+' : ''}${entry.delta})`}
        divider={index < shown.length - 1} testID={`progress-detail-domain-entry-${entry.id}`} />)}
      {entries.length > 3 ? <Button variant="ghost" size="sm"
        testID={`progress-detail-domain-toggle-${slug}`} label={expanded ? 'Show fewer updates' : `Show up to ${PER_DOMAIN_SHOWN} updates`}
        accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} /> : null}
      {hiddenCount > 0 ? <ThemedText type="caption" themeColor="textSecondary">
        {hiddenCount} earlier loaded update{hiddenCount === 1 ? '' : 's'} not shown. The loaded history is bounded to the latest {HISTORY_LIMIT} updates across domains.
      </ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  evidenceCard: { gap: Spacing.two },
  header: {
    gap: Spacing.one,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    // At 2× text the tracked heading plus count badge exceeds the card;
    // reflow the badge rather than clipping its label at the right edge.
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rows: {
    gap: Spacing.two,
  },
  domainBlock: {
    gap: Spacing.two,
    borderBottomWidth: HAIRLINE,
    paddingVertical: Spacing.two,
  },
  domainDot: {
    width: Spacing.three,
    height: Spacing.three,
    borderRadius: Radii.pill,
  },
});
