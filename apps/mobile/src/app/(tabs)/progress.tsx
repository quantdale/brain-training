/**
 * Progress — analytics dashboard (WP-2H; constitution §15, §17, §21).
 *
 * Overall summary (total sessions, lifetime XP, player level with progress,
 * currency balance), per-domain ratings with staleness marking (no decay —
 * stale is derived from the last update, see db/rating.ts), per-game
 * aggregates, and the most recent sessions (linked to `/results`).
 *
 * When the db is unavailable the screen degrades to an explanatory empty
 * state instead of crashing (testID `progress-summary` stays the stable QA
 * contract).
 */

import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase, DomainRating } from '@/db';
import { isRatingStale } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { GAME_CATEGORIES } from '@/sdk';
import { levelForXp, levelProgress, xpIntoLevel, xpForNextLevel } from '@/rating';
import { getGameDefinition } from '@/registry/registry';

interface ProgressData {
  totalXp: number;
  balance: number;
  sessionCount: number;
  domainRatings: DomainRating[];
  aggregates: readonly {
    gameId: string;
    count: number;
    avgNormalized: number;
    bestNormalized: number;
    lastCompletedAt: number;
  }[];
  recent: readonly unknown[];
}

async function loadProgress(db: AppDatabase): Promise<ProgressData> {
  const [totalXp, balance, aggregates, domainRatings, recent] = await Promise.all([
    db.sessions.getTotalXp(),
    db.ledger.getBalance(),
    db.sessions.getAggregates(),
    db.ratings.getRatings(),
    db.sessions.listRecent(10),
  ]);
  return {
    totalXp,
    balance,
    sessionCount: aggregates.reduce((sum, a) => sum + a.count, 0),
    domainRatings,
    aggregates,
    recent,
  };
}

const EMPTY: ProgressData = {
  totalXp: 0,
  balance: 0,
  sessionCount: 0,
  domainRatings: [],
  aggregates: [],
  recent: [],
};

export default function ProgressScreen() {
  // Reload whenever the tab regains focus (a session may have just landed).
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data } = useDbData(loadProgress, [refreshKey], EMPTY);
  const level = levelForXp(data.totalXp);

  const ratingsByDomain = new Map(data.domainRatings.map((r) => [r.domain, r]));

  return (
    <ScreenShell>
      <ThemedText type="title" testID="progress-title">
        Progress
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Your training history, ratings and records.
      </ThemedText>

      <ThemedView type="surface" style={styles.card} testID="progress-summary">
        <ThemedText type="subtitle">Summary</ThemedText>
        <View style={styles.summaryRow}>
          <SummaryStat label="Level" value={String(level)} />
          <SummaryStat label="XP" value={String(data.totalXp)} />
          <SummaryStat label="Sessions" value={String(data.sessionCount)} />
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
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-domains">
        <ThemedText type="subtitle">Domain ratings</ThemedText>
        <View style={styles.rows}>
          {GAME_CATEGORIES.map((domain) => {
            const rating = ratingsByDomain.get(domain);
            if (!rating) {
              return <RatingRow key={domain} domain={domain} rating={null} stale={false} />;
            }
            const stale = isRatingStale(rating.updatedAt, Date.now());
            return (
              <RatingRow key={domain} domain={domain} rating={rating.rating} stale={stale} />
            );
          })}
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          Ratings never decay from inactivity — stale ratings are marked and
          refresh when you train that domain again.
        </ThemedText>
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-game-stats">
        <ThemedText type="subtitle">Per game</ThemedText>
        {data.aggregates.length > 0 ? (
          <View style={styles.rows}>
            {data.aggregates.map((a) => (
              <View key={a.gameId} style={styles.row} testID={`progress-game-${a.gameId}`}>
                <ThemedText type="small">{getGameDefinition(a.gameId)?.name ?? a.gameId}</ThemedText>
                <ThemedText type="smallBold">
                  {a.count}× · best {Math.round(a.bestNormalized * 100)}%
                </ThemedText>
              </View>
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
        {data.recent.length > 0 ? (
          <View style={styles.rows}>
            {data.recent.map((session) => {
              const s = session as {
                id: string;
                gameId: string;
                normalizedResult: number;
                completedAt: number;
              };
              return (
                <Link key={s.id} href={`/results?id=${s.id}`} asChild>
                  <Pressable style={styles.row} testID={`progress-session-${s.id}`}>
                    <ThemedText type="small">
                      {getGameDefinition(s.gameId)?.name ?? s.gameId}
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {Math.round(s.normalizedResult * 100)}%
                    </ThemedText>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Your latest sessions will show up here.
          </ThemedText>
        )}
      </ThemedView>
    </ScreenShell>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="headline" themeColor="accent">
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function RatingRow({ domain, rating, stale }: { domain: string; rating: number | null; stale: boolean }) {
  return (
    <View style={styles.row} testID={`progress-rating-${domain.replace(/[^a-z]/gi, '').toLowerCase()}`}>
      <ThemedText type="small">{domain}</ThemedText>
      <ThemedText type="smallBold">
        {rating === null ? '—' : rating}
        {stale ? ' (stale)' : ''}
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
});
