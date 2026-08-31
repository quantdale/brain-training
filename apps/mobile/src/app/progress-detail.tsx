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

import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
import { ThemedView } from '@/components/themed-view';
import { MiniBarChart } from '@/components/progress-charts';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase, GameAggregate, GameSessionRecord, RatingHistoryEntry } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { getGameDefinition } from '@/registry/registry';
import { formatDayLabel, formatMs, formatPercent } from '@/analytics/format';

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
      <Pressable
        testID="progress-detail-back"
        accessibilityRole="button"
        onPress={() => router.back()}>
        <ThemedText type="smallBold" themeColor="accent">
          ‹ Back
        </ThemedText>
      </Pressable>

      <ThemedText type="title" testID="progress-detail-title">
        Progress detail
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Domain trends, per-game records and recent sessions.
      </ThemedText>

      {!loaded ? (
        <StateCard
          variant="loading"
          title="Loading…"
          message="Fetching your detailed history."
          testID="progress-detail-loading"
        />
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

      <ThemedView type="surface" style={styles.card} testID="progress-detail-domains">
        <ThemedText type="subtitle">Domain history</ThemedText>
        {domainNames.length > 0 ? (
          <View style={styles.rows}>
            {domainNames.map((domain) => (
              <DomainHistory key={domain} domain={domain} entries={byDomain.get(domain)!} />
            ))}
          </View>
        ) : (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID="progress-detail-domains-empty">
            No rating history yet — play a game to build a per-domain trend.
          </ThemedText>
        )}
      </ThemedView>

      {bestHistory.current !== null ? (
        <ThemedView type="surface" style={styles.card} testID="progress-detail-pb">
          <ThemedText type="subtitle">Recent personal bests</ThemedText>
          <View style={styles.rows}>
            {bestHistory.events.slice(-5).map((event) => (
              <View
                key={`${event.t}-${event.value}`}
                style={styles.row}
                testID={`progress-detail-pb-${event.t}`}>
                <ThemedText type="small">{formatDayLabel(event.t)}</ThemedText>
                <ThemedText type="smallBold">{formatPercent(event.value)}</ThemedText>
              </View>
            ))}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            Across your {data.recent.length} most recent sessions · current best stood{' '}
            {bestHistory.standingDays === 0
              ? 'less than a day'
              : `${bestHistory.standingDays ?? 0}d`}. {explainMetric('personal-best-history')}
          </ThemedText>
        </ThemedView>
      ) : null}

      {rollingSeries.length > 0 ? (
        <ThemedView type="surface" style={styles.card} testID="progress-detail-rolling">
          <View style={styles.row}>
            <ThemedText type="subtitle">Rolling average</ThemedText>
            <ThemedText type="smallBold">
              {formatPercent(rollingSeries[rollingSeries.length - 1].value)}
            </ThemedText>
          </View>
          <MiniBarChart
            values={rollingSeries.map((p) => p.value)}
            testID="progress-detail-rolling-chart"
            emptyLabel="Not enough sessions yet"
          />
          <ThemedText type="caption" themeColor="textSecondary">
            Mean of the last {ROLLING_AVERAGE_SESSIONS} sessions at each point.{' '}
            {explainMetric('rolling-average')}
          </ThemedText>
        </ThemedView>
      ) : null}

      {accuracyTrend.available ? (
        <ThemedView type="surface" style={styles.card} testID="progress-detail-accuracy">
          <View style={styles.row}>
            <ThemedText type="subtitle">Accuracy over time</ThemedText>
            <ThemedText type="smallBold">
              {accuracyTrend.recentMean === null
                ? '—'
                : formatPercent(accuracyTrend.recentMean)}{' '}
              recent
            </ThemedText>
          </View>
          <MiniBarChart
            values={accuracyTrend.series.map((p) => p.value)}
            testID="progress-detail-accuracy-chart"
          />
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('accuracy-trend')}
          </ThemedText>
        </ThemedView>
      ) : null}

      {reactionTrend.available ? (
        <ThemedView type="surface" style={styles.card} testID="progress-detail-reaction">
          <View style={styles.row}>
            <ThemedText type="subtitle">Reaction time (lower is better)</ThemedText>
            <ThemedText type="smallBold">
              {reactionTrend.recentMean === null ? '—' : formatMs(reactionTrend.recentMean)} recent
            </ThemedText>
          </View>
          <MiniBarChart
            values={reactionTrend.series.map((p) => p.value)}
            testID="progress-detail-reaction-chart"
          />
          <ThemedText type="caption" themeColor="textSecondary">
            {explainMetric('reaction-trend')}
          </ThemedText>
        </ThemedView>
      ) : null}

      <ThemedView type="surface" style={styles.card} testID="progress-detail-games">
        <ThemedText type="subtitle">Game records</ThemedText>
        {data.aggregates.length > 0 ? (
          <View style={styles.rows}>
            {data.aggregates.map((a) => (
              <Link key={a.gameId} href={`/game-detail/${a.gameId}`} asChild>
                <Pressable
                  style={styles.row}
                  accessibilityRole="button"
                  testID={`progress-detail-game-${a.gameId}`}>
                  <ThemedText type="small">
                    {getGameDefinition(a.gameId)?.name ?? a.gameId}
                  </ThemedText>
                  <View style={styles.rowRight}>
                    <ThemedText type="smallBold">
                      {a.count}× · best {Math.round(a.bestNormalized * 100)}% ·{' '}
                      {new Date(a.lastCompletedAt).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText type="smallBold" themeColor="accent">
                      ›
                    </ThemedText>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" testID="progress-detail-games-empty">
            No games played yet.
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-detail-sessions">
        <ThemedText type="subtitle">Recent sessions</ThemedText>
        {data.recent.length > 0 ? (
          <View style={styles.rows}>
            {data.recent.slice(0, RECENT_LIMIT).map((session) => (
              <Link key={session.id} href={`/results?id=${session.id}`} asChild>
                <Pressable
                  style={styles.row}
                  accessibilityRole="button"
                  testID={`progress-detail-session-${session.id}`}>
                  <ThemedText type="small">
                    {getGameDefinition(session.gameId)?.name ?? session.gameId} ·{' '}
                    {new Date(session.completedAt).toLocaleDateString()}
                  </ThemedText>
                  <View style={styles.rowRight}>
                    <ThemedText type="smallBold">
                      {Math.round(session.normalizedResult * 100)}%
                    </ThemedText>
                    <ThemedText type="smallBold" themeColor="accent">
                      ›
                    </ThemedText>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID="progress-detail-sessions-empty">
            Your latest sessions will show up here.
          </ThemedText>
        )}
      </ThemedView>
        </>
      )}
    </ScreenShell>
  );
}

/**
 * One domain's rating trend: name header (with the latest movement) +
 * chronological entries (rating after each movement, signed delta, date).
 * `entries` arrive newest first from the repo; only the newest
 * `PER_DOMAIN_SHOWN` are rendered, with an "+N earlier" note when truncated.
 */
function DomainHistory({
  domain,
  entries,
}: {
  domain: string;
  entries: readonly RatingHistoryEntry[];
}) {
  const slug = domain.replace(/[^a-z]/gi, '').toLowerCase();
  const chronological = [...entries].reverse();
  const hiddenCount = Math.max(0, chronological.length - PER_DOMAIN_SHOWN);
  const shown = chronological.slice(-PER_DOMAIN_SHOWN);
  const latest = entries[0];
  return (
    <View style={styles.rows} testID={`progress-detail-domain-${slug}`}>
      <View style={styles.row}>
        <ThemedText type="smallBold">{domain}</ThemedText>
        {latest ? (
          <ThemedText
            type="caption"
            themeColor={latest.delta > 0 ? 'success' : latest.delta < 0 ? 'danger' : 'textSecondary'}
            testID={`progress-detail-domain-latest-${slug}`}>
            latest {latest.delta >= 0 ? '+' : ''}
            {latest.delta}
          </ThemedText>
        ) : null}
      </View>
      {hiddenCount > 0 ? (
        <ThemedText type="caption" themeColor="textSecondary">
          +{hiddenCount} earlier update{hiddenCount === 1 ? '' : 's'} not shown.
        </ThemedText>
      ) : null}
      {shown.map((entry) => (
        <View
          key={entry.id}
          style={styles.row}
          testID={`progress-detail-domain-entry-${entry.id}`}>
          <ThemedText type="caption" themeColor="textSecondary">
            {new Date(entry.createdAt).toLocaleDateString()}
          </ThemedText>
          <ThemedText type="smallBold">
            {entry.ratingAfter} ({entry.delta >= 0 ? '+' : ''}
            {entry.delta})
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
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
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
