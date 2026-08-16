/**
 * Progress detail — `/progress-detail` (WP-3F; constitution §21).
 *
 * Deeper Progress dashboard one tap away from the Progress tab: per-domain
 * rating history (the last 20 append-only `rating_history` entries, grouped
 * by domain as a chronological mini-trend), per-game records (best normalized
 * score, session count, last played, linked to `/game-detail/[id]`) and the
 * most recent sessions (linked to `/results`).
 *
 * Mirrors the Progress tab's data-loading pattern (`useFocusEffect` +
 * `useDbData`), its card/row styling, and its graceful empty states when the
 * db is unavailable or empty (no crashes; stable `progress-detail-*` testIDs).
 */

import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase, GameAggregate, GameSessionRecord, RatingHistoryEntry } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { getGameDefinition } from '@/registry/registry';

/** How many rating-history entries (newest first) feed the per-domain trends. */
const HISTORY_LIMIT = 20;
/** How many recent sessions to list. */
const RECENT_LIMIT = 10;

interface ProgressDetailData {
  history: RatingHistoryEntry[];
  aggregates: GameAggregate[];
  recent: GameSessionRecord[];
}

async function loadProgressDetail(db: AppDatabase): Promise<ProgressDetailData> {
  const [history, aggregates, recent] = await Promise.all([
    db.ratings.getHistory(HISTORY_LIMIT),
    db.sessions.getAggregates(),
    db.sessions.listRecent(RECENT_LIMIT),
  ]);
  return { history, aggregates, recent };
}

const EMPTY: ProgressDetailData = { history: [], aggregates: [], recent: [] };

export default function ProgressDetailScreen() {
  // Reload whenever the screen regains focus (a session may have just landed).
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data } = useDbData(loadProgressDetail, [refreshKey], EMPTY);

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
                  <ThemedText type="smallBold">
                    {a.count}× · best {Math.round(a.bestNormalized * 100)}% ·{' '}
                    {new Date(a.lastCompletedAt).toLocaleDateString()}
                  </ThemedText>
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
            {data.recent.map((session) => (
              <Link key={session.id} href={`/results?id=${session.id}`} asChild>
                <Pressable
                  style={styles.row}
                  accessibilityRole="button"
                  testID={`progress-detail-session-${session.id}`}>
                  <ThemedText type="small">
                    {getGameDefinition(session.gameId)?.name ?? session.gameId} ·{' '}
                    {new Date(session.completedAt).toLocaleDateString()}
                  </ThemedText>
                  <ThemedText type="smallBold">
                    {Math.round(session.normalizedResult * 100)}%
                  </ThemedText>
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
    </ScreenShell>
  );
}

/**
 * One domain's rating trend: name header + chronological entries (rating
 * after each movement, signed delta, date). `entries` arrive newest first
 * from the repo and are reversed for the chronological read.
 */
function DomainHistory({
  domain,
  entries,
}: {
  domain: string;
  entries: readonly RatingHistoryEntry[];
}) {
  const slug = domain.replace(/[^a-z]/gi, '').toLowerCase();
  return (
    <View style={styles.rows} testID={`progress-detail-domain-${slug}`}>
      <ThemedText type="smallBold">{domain}</ThemedText>
      {[...entries].reverse().map((entry) => (
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
});
