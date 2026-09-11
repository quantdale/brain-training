/**
 * Results — `/results`.
 *
 * Session result surface (WP-2H + W13 UX wave; constitution §16: headline
 * plus meaningful metrics — score, accuracy, reaction, difficulty, rating
 * movement, XP, personal records). Shows one session (by `?id=` search param,
 * else the most recent) plus rating movement from the append-only history,
 * and a list of recent sessions to switch between. Adds an explicit loading
 * state and a performance-band headline over the raw percentage.
 *
 * Presentation (campaign 024, design-language v2): the reference anatomy —
 * score hero (ProgressRing with the normalized score as the hero numeral),
 * headline, a metric row of StatBlocks with metric identity colours, rating
 * movement, then ONE primary CTA (play again) with the next-game action
 * demoted to ghost. A personal-best session renders the celebration
 * treatment exactly once (sensory-gated success feedback + badge, never
 * blocking); routine completions stay quiet.
 */

import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MinTouchTarget } from "@/components/a11y";
import { ScreenShell } from "@/components/screen-shell";
import { StateCard } from "@/components/shell";
import { formatRelativeDay, performanceBand } from "@/components/shell/format";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  Entrance,
  ProgressRing,
  StatBlock,
} from '@/components/ui';
import { Radii, Spacing } from "@/constants/theme";
import type { AppDatabase, GameSessionRecord } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { getGameDefinition } from "@/registry/registry";
import { liveAudioHaptics } from "@/sdk";
import { useWorkoutResultAdvance } from "@/workout/use-workout-result-advance";
import { gameHref } from "@/workout/routing";

interface ResultsData {
  session: GameSessionRecord | null;
  recent: GameSessionRecord[];
  ratingHistory: readonly {
    sessionId: string;
    domain: string;
    delta: number;
    ratingAfter: number;
  }[];
  /**
   * True when no earlier-or-equal same-game session reaches this session's
   * normalized result — i.e. this session raised (or set) the personal best.
   * Ties keep the earliest holder, matching the analytics best-chain
   * convention. Degrades to false when the store cannot answer.
   */
  isPersonalBest: boolean;
}

/**
 * Personal-best check via the sessions COUNT pushdown: sessions matching
 * `{ gameIds, toMs: completedAt, minNormalized }` include the session
 * itself, so a count of ≤1 means nothing earlier beat or tied it. Uses an
 * aggregate instead of paging rows, so long histories stay cheap.
 */
async function loadPersonalBest(
  db: AppDatabase,
  session: GameSessionRecord,
): Promise<boolean> {
  try {
    // Partial test doubles only implement the reads the old screen used;
    // a missing pushdown degrades to the quiet (non-PB) treatment.
    if (typeof db.sessions.countSessions !== "function") {
      return false;
    }
    const atOrAbove = await db.sessions.countSessions({
      gameIds: [session.gameId],
      toMs: session.completedAt,
      minNormalized: session.normalizedResult,
    });
    return atOrAbove <= 1;
  } catch {
    return false;
  }
}

function loadResults(
  db: AppDatabase,
  id: string | undefined,
): Promise<ResultsData> {
  return (async () => {
    const throughMs = Date.now();
    const session = id
      ? await db.sessions.getById(id)
      : ((await db.sessions.listRecent(1, throughMs))[0] ?? null);
    const recent = await db.sessions.listRecent(20, throughMs);
    // Task 9.4: Load exact rating history for selected session
    const ratingHistory = session
      ? await db.ratings.getHistoryForSession(session.id, throughMs)
      : [];
    const isPersonalBest = session
      ? await loadPersonalBest(db, session)
      : false;
    return { session, recent, ratingHistory, isPersonalBest };
  })();
}

const EMPTY: ResultsData = {
  session: null,
  recent: [],
  ratingHistory: [],
  isPersonalBest: false,
};

/**
 * Sessions already celebrated on this JS session. The results screen reloads
 * on every focus (a session may have just landed), so the guard must outlive
 * re-renders and refetches — otherwise returning to a PB result would replay
 * the success feedback. Mirrors the workout-completion card's once-per-key
 * celebration precedent.
 */
const celebratedResults = new Set<string>();

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  // Reload whenever the screen regains focus (a session may have just landed).
  const [refreshKey, setRefreshKey] = useState(0);
  // Captured once at mount: the relative-day label must not drift between
  // renders, and reading the clock during render is impure.
  const [mountedAt] = useState(() => Date.now());
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
  const { session, recent, ratingHistory, isPersonalBest } = data;

  // Cross-feature wiring (006R hardening): advance the durable workout when this
  // session finished the current game, and surface the next game / completion.
  const {
    instance: workoutInstance,
    nextGameId,
    nextProvenance,
    completed: workoutCompleted,
  } = useWorkoutResultAdvance(session);

  // Celebration discipline (micro-interactions R5): a personal best earns one
  // bounded, non-blocking success beat; routine completions stay quiet. The
  // sensory service honours the global toggles, so a muted device stays
  // silent while the badge still shows.
  useEffect(() => {
    if (!isPersonalBest || session === null) {
      return;
    }
    if (celebratedResults.has(session.id)) {
      return;
    }
    celebratedResults.add(session.id);
    liveAudioHaptics.feedback("success");
  }, [isPersonalBest, session]);

  const game = session ? getGameDefinition(session.gameId) : undefined;
  // Task 9.4: ratingHistory is already filtered to the selected session

  const scorePercent = session ? Math.round(session.normalizedResult * 100) : 0;
  // Raw score/accuracy live in the game-owned raw result; every game builder
  // persists them as top-level `score` / `accuracy` (0..1) numbers. Sessions
  // whose game predates that convention read as "—" rather than a guess.
  const raw = session?.rawResult;
  const rawRecord =
    typeof raw === "object" && raw !== null && "score" in raw ? raw : null;
  const rawScore =
    rawRecord !== null &&
    typeof rawRecord.score === "number" &&
    Number.isFinite(rawRecord.score)
      ? rawRecord.score
      : null;
  const rawAccuracyRecord =
    typeof raw === "object" && raw !== null && "accuracy" in raw ? raw : null;
  const rawAccuracy =
    rawAccuracyRecord !== null &&
    typeof rawAccuracyRecord.accuracy === "number" &&
    Number.isFinite(rawAccuracyRecord.accuracy)
      ? rawAccuracyRecord.accuracy
      : null;
  const difficultyValue = session?.difficulty;
  const difficultyLevel =
    typeof difficultyValue === "object" &&
    difficultyValue !== null &&
    "level" in difficultyValue &&
    typeof difficultyValue.level === "string"
      ? difficultyValue.level
      : "—";
  const nextGame = nextGameId ? getGameDefinition(nextGameId) : undefined;

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
          {/* Score hero: the ring is the surface's one hero element, with the
              normalized score as its numeral. Live region: when the session
              loads (or the user switches between recent sessions) screen
              readers announce the headline result instead of silently
              re-rendering. */}
          <Entrance index={0}>
          <Card
            variant="hero"
            testID="results-summary"
            accessibilityLiveRegion="polite"
            style={styles.hero}
          >
            {isPersonalBest ? (
              <Badge
                label="New personal best"
                tone="streak"
                testID="results-personal-best"
              />
            ) : null}
            <ProgressRing
              value={session.normalizedResult}
              tone="accent"
              testID="results-ring"
            >
              <AnimatedNumber
                value={scorePercent}
                format={(n) => `${Math.round(n)}%`}
                type="numeralXl"
                themeColor="accent"
                testID="results-score"
              />
            </ProgressRing>
            {/* Performance band headline (constitution §16): an encouraging,
                non-clinical read of the normalized score above the number. */}
            <ThemedText
              type="headline"
              themeColor={performanceBand(session.normalizedResult).tone}
              testID="results-band"
            >
              {performanceBand(session.normalizedResult).label}
            </ThemedText>
            <ThemedText type="subtitle" testID="results-game">
              {game?.name ?? session.gameId}
            </ThemedText>
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <StatBlock
                  label="Score"
                  value={rawScore !== null ? String(Math.round(rawScore)) : "—"}
                  metric="score"
                  valueType="numeral"
                  testID="results-metric-score"
                />
              </View>
              <View style={styles.metric}>
                <StatBlock
                  label="Accuracy"
                  value={
                    rawAccuracy !== null
                      ? `${Math.round(rawAccuracy * 100)}%`
                      : "—"
                  }
                  metric="accuracy"
                  valueType="numeral"
                  testID="results-metric-accuracy"
                />
              </View>
              <View style={styles.metric}>
                <StatBlock
                  label="Time"
                  value={`${Math.round(session.durationMs / 1000)}s`}
                  metric="time"
                  valueType="numeral"
                  testID="results-metric-time"
                />
              </View>
              <View style={styles.metric}>
                <StatBlock
                  label="Difficulty"
                  value={difficultyLevel}
                  valueType="numeral"
                  testID="results-metric-difficulty"
                />
              </View>
            </View>
            <View style={styles.rewardRow}>
              <AnimatedNumber
                value={session.xp}
                format={(n) => `+${Math.round(n)} XP`}
                type="bodyLarge"
                themeColor="xp"
                testID="results-xp"
              />
              <ThemedText
                type="bodySmall"
                themeColor="textSecondary"
                testID="results-timestamp"
              >
                {formatRelativeDay(session.completedAt, mountedAt)}
              </ThemedText>
            </View>
          </Card>
    </Entrance>

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
                {workoutInstance?.gameIds.length
                  ? `You finished all ${workoutInstance.gameIds.length} games today. Nice work!`
                  : "You finished today's workout. Nice work!"}
              </ThemedText>
            </ThemedView>
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

          {/* One primary CTA (play again); the workout next-game action is a
              ghost so the viewport never carries two competing primaries. */}
          <View style={styles.ctaBlock}>
            <Button
              variant="primary"
              size="lg"
              label="Play again"
              sublabel={game?.name ?? session.gameId}
              testID="results-play-again"
              accessibilityHint={`Start a new session of ${game?.name ?? session.gameId}`}
              onPress={() => router.push(gameHref(session.gameId))}
            />
            {!workoutCompleted && nextGameId ? (
              <Button
                variant="ghost"
                label="Next game"
                sublabel={nextGame?.name ?? nextGameId}
                testID="results-next-game"
                accessibilityHint={`Continue the workout with ${nextGame?.name ?? nextGameId}`}
                onPress={() => router.push(gameHref(nextGameId, nextProvenance))}
              />
            ) : null}
          </View>

          <ThemedView
            type="surface"
            style={styles.card}
            testID="results-recent-sessions"
          >
            <ThemedText type="subtitle">Recent sessions</ThemedText>
            <View style={styles.rows}>
              {recent.slice(0, 10).map((s) => (
                <Link key={s.id} href={`/results?id=${s.id}`} asChild>
                  <Pressable
                    testID={`results-session-${s.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${getGameDefinition(s.gameId)?.name ?? s.gameId} result from ${new Date(s.completedAt).toLocaleDateString()}, ${Math.round(s.normalizedResult * 100)} percent`}
                    accessibilityHint="Shows this session's results"
                    accessibilityState={{ selected: s.id === session.id }}
                    // Flattened: expo-router's <Link asChild> (Radix Slot) THROWS
                    // on array styles in dev builds — this exact array crashed the
                    // /results route on device and made the durable workout
                    // journey impossible to complete (campaign 011 finding).
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
  // Hero content stacks on one centered axis (reference: celebration visual
  // → headline → metric row → single CTA).
  hero: {
    alignItems: "center",
    gap: Spacing.three,
  },
  metricRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: Spacing.two,
  },
  metric: {
    flex: 1,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
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
  ctaBlock: {
    gap: Spacing.two,
  },
});
