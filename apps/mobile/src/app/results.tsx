/**
 * Results — `/results`.
 *
 * Session result surface (WP-2H + W13 UX wave; constitution §16: headline
 * plus meaningful metrics — score, accuracy, reaction, difficulty, rating
 * movement, XP, personal records). Shows one session (by `?id=` search param,
 * else the most recent) plus rating movement from the append-only history,
 * and a list of recent sessions to switch between. Adds an explicit loading
 * state and a performance-band headline over the raw percentage.
 */

import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { MinTouchTarget } from "@/components/a11y";
import { ScreenShell } from "@/components/screen-shell";
import { InfoRow, StateCard } from "@/components/shell";
import { performanceBand } from "@/components/shell/format";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";
import type { AppDatabase, GameSessionRecord } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { getGameDefinition } from "@/registry/registry";
import { useWorkoutResultAdvance } from "@/workout/use-workout-result-advance";

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

function loadResults(
  db: AppDatabase,
  id: string | undefined,
): Promise<ResultsData> {
  return (async () => {
    const session = id
      ? await db.sessions.getById(id)
      : ((await db.sessions.listRecent(1))[0] ?? null);
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

  const { data, loaded, error } = useDbData(
    (db) => loadResults(db, id),
    [id, refreshKey],
    EMPTY,
  );
  const { session, recent, ratingHistory } = data;

  // Cross-feature wiring (006R hardening): advance the durable workout when this
  // session finished the current game, and surface the next game / completion.
  const { nextGameId, completed: workoutCompleted } =
    useWorkoutResultAdvance(session);

  const game = session ? getGameDefinition(session.gameId) : undefined;
  // Task 9.4: ratingHistory is already filtered to the selected session

  return (
    <ScreenShell>
      <Pressable
        testID="results-back"
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={MinTouchTarget}
        onPress={() => router.back()}
      >
        <ThemedText type="smallBold" themeColor="accent">
          ‹ Back
        </ThemedText>
      </Pressable>

      <ThemedText type="title" testID="results-title">
        Results
      </ThemedText>

      {!loaded ? (
        <StateCard
          variant="loading"
          title="Loading…"
          message="Fetching your session results."
          testID="results-loading"
        />
      ) : error ? (
        <StateCard
          variant="error"
          title="Couldn't load results"
          message="This session's data is unavailable right now."
          testID="results-error"
          action={{ label: "Try again", onPress: () => setRefreshKey((k) => k + 1) }}
        />
      ) : session ? (
        <>
          {/* Live region: when the session loads (or the user switches between
              recent sessions) screen readers announce the headline result
              instead of silently re-rendering. */}
          <ThemedView
            type="surface"
            style={styles.card}
            testID="results-summary"
            accessibilityLiveRegion="polite"
          >
            {/* Performance band headline (constitution §16): an encouraging,
                non-clinical read of the normalized score above the number. */}
            <ThemedText
              type="subtitle"
              themeColor={performanceBand(session.normalizedResult).tone}
              testID="results-band"
            >
              {performanceBand(session.normalizedResult).label}
            </ThemedText>
            <ThemedText
              type="headline"
              themeColor="accent"
              testID="results-score"
            >
              {Math.round(session.normalizedResult * 100)}%
            </ThemedText>
            <ThemedText type="subtitle" testID="results-game">
              {game?.name ?? session.gameId}
            </ThemedText>
            <View style={styles.rows}>
              <InfoRow
                label="Difficulty"
                value={String(
                  (session.difficulty as { level?: string } | null)?.level ??
                    "—",
                )}
              />
              <InfoRow label="XP earned" value={`+${session.xp}`} />
              <InfoRow
                label="Duration"
                value={`${Math.round(session.durationMs / 1000)}s`}
              />
              <InfoRow
                label="Date"
                value={new Date(session.completedAt).toLocaleDateString()}
              />
            </View>
          </ThemedView>

          {/* Workout progress (006R hardening): after finishing the current
              workout game, surface the next game or the completion state. */}
          {workoutCompleted ? (
            <ThemedView
              type="accentSoft"
              style={styles.card}
              testID="results-workout-complete"
            >
              <ThemedText type="subtitle" themeColor="accent">
                Workout complete
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You finished all four games today. Nice work!
              </ThemedText>
            </ThemedView>
          ) : nextGameId ? (
            <Link href={`/game/${nextGameId}`} asChild>
              <Pressable
                testID="results-next-game"
                accessibilityRole="button"
                accessibilityLabel={`Play the next game`}
                // Flattened: expo-router's <Link asChild> (Radix Slot) THROWS
                // on array styles in dev builds — this exact array crashed the
                // /results route on device and made the durable workout
                // journey impossible to complete (campaign 011 finding).
                style={StyleSheet.flatten([styles.nextGame, MinTouchTarget])}
              >
                <ThemedText type="smallBold" themeColor="accent">
                  Next Game →
                </ThemedText>
              </Pressable>
            </Link>
          ) : null}

          <ThemedView
            type="surface"
            style={styles.card}
            testID="results-rating"
          >
            <ThemedText type="subtitle">Rating movement</ThemedText>
            {ratingHistory.length > 0 ? (
              <View style={styles.rows}>
                {ratingHistory.map((h) => (
                  <View key={h.domain} style={styles.row}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {h.domain}
                    </ThemedText>
                    <ThemedText
                      type="smallBold"
                      themeColor={
                        h.delta > 0 ? "success" : h.delta < 0 ? "danger" : undefined
                      }
                      testID={`results-rating-delta-${h.domain
                        .replace(/[^a-z]/gi, "")
                        .toLowerCase()}`}
                    >
                      {`${h.delta >= 0 ? "+" : ""}${h.delta} → ${h.ratingAfter}`}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No rating movement recorded for this session.
              </ThemedText>
            )}
            {ratingHistory.length > 0 ? (
              <ThemedText type="caption" themeColor="textSecondary">
                Deltas show how each domain rating changed because of this
                session.
              </ThemedText>
            ) : null}
          </ThemedView>

          <ThemedView
            type="surface"
            style={styles.card}
            testID="results-recent"
          >
            <ThemedText type="subtitle">Recent sessions</ThemedText>
            <View style={styles.rows}>
              {recent.slice(0, 10).map((s) => (
                <Link key={s.id} href={`/results?id=${s.id}`} asChild>
                  <Pressable
                    testID={`results-session-${s.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${getGameDefinition(s.gameId)?.name ?? s.gameId} result from ${new Date(s.completedAt).toLocaleDateString()}, ${Math.round(s.normalizedResult * 100)} percent`}
                    accessibilityState={{ selected: s.id === session.id }}
                    // Flatten: array styles inside asChild Links throw in
                    // expo-router's Radix Slot shim (dev builds) — see the
                    // results-next-game comment above.
                    style={StyleSheet.flatten([
                      styles.row,
                      MinTouchTarget,
                      s.id === session.id && styles.rowActive,
                    ])}
                  >
                    <ThemedText type="small" themeColor="textSecondary">
                      {getGameDefinition(s.gameId)?.name ?? s.gameId} ·{" "}
                      {new Date(s.completedAt).toLocaleDateString()}
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {Math.round(s.normalizedResult * 100)}%
                    </ThemedText>
                  </Pressable>
                </Link>
              ))}
            </View>
          </ThemedView>
        </>
      ) : (
        <StateCard
          variant="empty"
          title="No sessions yet"
          message="Play a game to see your results here."
          testID="results-empty"
          action={{
            label: "Browse games",
            onPress: () => router.push("/games"),
            accessibilityLabel: "Browse the game library",
          }}
        />
      )}
    </ScreenShell>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  // Visual-only marker for the currently shown session; screen readers get the
  // same information via accessibilityState.selected on each row.
  rowActive: {
    opacity: 0.6,
  },
  nextGame: {
    alignSelf: "flex-start",
    borderRadius: Radii.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    backgroundColor: "rgba(0, 122, 255, 0.12)",
  },
});
