/**
 * Results — `/results`.
 *
 * Session result surface (WP-2H; constitution §16: headline + meaningful
 * metrics — score, accuracy, reaction, difficulty, rating movement, XP,
 * personal records). Shows one session (by `?id=` search param, else the most
 * recent) plus rating movement from the append-only history, and a list of
 * recent sessions to switch between.
 */

import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase, GameSessionRecord } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { getGameDefinition } from '@/registry/registry';
import { useWorkoutResultAdvance } from '@/workout/use-workout-result-advance';

interface ResultsData {
  session: GameSessionRecord | null;
  recent: GameSessionRecord[];
  ratingHistory: readonly {
    sessionId: string;
    domain: string;
    delta: number;
    ratingAfter: number;
  }[];
}

function loadResults(db: AppDatabase, id: string | undefined): Promise<ResultsData> {
  return (async () => {
    const session = id ? await db.sessions.getById(id) : (await db.sessions.listRecent(1))[0] ?? null;
    const recent = await db.sessions.listRecent(20);
    // Task 9.4: Load exact rating history for selected session
    const ratingHistory = session
      ? await db.ratings.getHistoryForSession(session.id)
      : [];
    return { session, recent, ratingHistory };
  })();
}

const EMPTY: ResultsData = { session: null, recent: [], ratingHistory: [] };

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  // Reload whenever the screen regains focus (a session may have just landed).
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data } = useDbData((db) => loadResults(db, id), [id, refreshKey], EMPTY);
  const { session, recent, ratingHistory } = data;

  // Cross-feature wiring (006R hardening): advance the durable workout when this
  // session finished the current game, and surface the next game / completion.
  const { nextGameId, completed: workoutCompleted } = useWorkoutResultAdvance(session);

  const game = session ? getGameDefinition(session.gameId) : undefined;
  // Task 9.4: ratingHistory is already filtered to the selected session

  return (
    <ScreenShell>
      <Pressable
        testID="results-back"
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}>
        <ThemedText type="smallBold" themeColor="accent">
          ‹ Back
        </ThemedText>
      </Pressable>

      <ThemedText type="title" testID="results-title">
        Results
      </ThemedText>

      {session ? (
        <>
          <ThemedView type="surface" style={styles.card} testID="results-summary">
            <ThemedText type="headline" themeColor="accent" testID="results-score">
              {Math.round(session.normalizedResult * 100)}%
            </ThemedText>
            <ThemedText type="subtitle" testID="results-game">
              {game?.name ?? session.gameId}
            </ThemedText>
            <View style={styles.rows}>
              <ResultRow label="Difficulty" value={String((session.difficulty as { level?: string } | null)?.level ?? '—')} />
              <ResultRow label="XP earned" value={`+${session.xp}`} />
              <ResultRow label="Duration" value={`${Math.round(session.durationMs / 1000)}s`} />
              <ResultRow label="Date" value={new Date(session.completedAt).toLocaleDateString()} />
            </View>
          </ThemedView>

          {/* Workout progress (006R hardening): after finishing the current
              workout game, surface the next game or the completion state. */}
          {workoutCompleted ? (
            <ThemedView type="accentSoft" style={styles.card} testID="results-workout-complete">
              <ThemedText type="subtitle" themeColor="accent">
                Workout complete
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You finished all four games today. Nice work!
              </ThemedText>
            </ThemedView>
          ) : nextGameId ? (
            <Link href={`/game/${nextGameId}`} asChild>
              <Pressable testID="results-next-game" accessibilityRole="button" style={styles.nextGame}>
                <ThemedText type="smallBold" themeColor="accent">
                  Next Game →
                </ThemedText>
              </Pressable>
            </Link>
          ) : null}

          <ThemedView type="surface" style={styles.card} testID="results-rating">
            <ThemedText type="subtitle">Rating movement</ThemedText>
            {ratingHistory.length > 0 ? (
              <View style={styles.rows}>
                {ratingHistory.map((h) => (
                  <ResultRow
                    key={h.domain}
                    label={h.domain}
                    value={`${h.delta >= 0 ? '+' : ''}${h.delta} → ${h.ratingAfter}`}
                  />
                ))}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No rating movement recorded for this session.
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView type="surface" style={styles.card} testID="results-recent">
            <ThemedText type="subtitle">Recent sessions</ThemedText>
            <View style={styles.rows}>
              {recent.slice(0, 10).map((s) => (
                <Link key={s.id} href={`/results?id=${s.id}`} asChild>
                  <Pressable
                    testID={`results-session-${s.id}`}
                    accessibilityRole="button"
                    style={[styles.row, s.id === session.id && styles.rowActive]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {getGameDefinition(s.gameId)?.name ?? s.gameId} · {new Date(s.completedAt).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText type="smallBold">{Math.round(s.normalizedResult * 100)}%</ThemedText>
                  </Pressable>
                </Link>
              ))}
            </View>
          </ThemedView>
        </>
      ) : (
        <ThemedView type="surface" style={styles.card} testID="results-empty">
          <ThemedText type="subtitle">No sessions yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Play a game to see your results here.
          </ThemedText>
        </ThemedView>
      )}
    </ScreenShell>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
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
  rowActive: {
    opacity: 0.6,
  },
  nextGame: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
});
