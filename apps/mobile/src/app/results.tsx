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
 * Presentation (campaign 026, design-language v3 "Neon Arcade"):
 * celebration-first — outcome headline + hero metric (ring + numeralXl)
 * first, deterministic confetti confined to the hero margins for perfect /
 * personal-best outcomes, metrics as four equal `StatBlock` columns in ONE
 * row, then exactly one primary CTA (play again). The workout next-game
 * action stays a quiet ghost beside it; rating movement and recent sessions
 * are quiet outlined sections, never stacked uniform cards. A personal-best
 * session still renders the celebration treatment exactly once
 * (sensory-gated success feedback + badge, never blocking); routine
 * completions stay quiet.
 */

import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ScreenShell } from "@/components/screen-shell";
import { SectionHeader, StateCard } from "@/components/shell";
import { formatRelativeDay, performanceBand } from "@/components/shell/format";
import { formatDayLabel } from "@/analytics/format";
import { ThemedText } from "@/components/themed-text";
import {
  AnimatedNumber,
  BackLink,
  Badge,
  Button,
  Card,
  Confetti,
  Entrance,
  ProgressRing,
  Spark,
  StatBlock,
} from '@/components/ui';
import { MinTouchTarget, Radii, Spacing } from "@/constants/theme";
import type { AppDatabase, GameSessionRecord } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { useTheme } from "@/hooks/use-theme";
import { getGameDefinition } from "@/registry/registry";
import { DIFFICULTY_LABELS, liveAudioHaptics } from "@/sdk";
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
  const theme = useTheme();

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
  // Player-facing label ("Normal"), never the stored slug ("normal") —
  // Campaign 026 visual-QA: the metric row mixed a lowercase slug in with
  // formatted values.
  const difficultyLevel =
    typeof difficultyValue === "object" &&
    difficultyValue !== null &&
    "level" in difficultyValue &&
    typeof difficultyValue.level === "string"
      ? (DIFFICULTY_LABELS[
          difficultyValue.level as keyof typeof DIFFICULTY_LABELS
        ] ?? difficultyValue.level)
      : "—";
  const nextGame = nextGameId ? getGameDefinition(nextGameId) : undefined;
  // NaN maps to the neutral "Session complete" band; only rendered with a session.
  const band = performanceBand(session?.normalizedResult ?? Number.NaN);
  // Celebration beat: a perfect score or a personal best earns the confetti
  // margins; routine completions stay quiet. `Confetti` collapses to nothing
  // under reduced motion and is non-interactive (`pointerEvents="none"`).
  const celebrate = session !== null && (isPersonalBest || session.normalizedResult >= 1);

  return (
    <ScreenShell>
      <BackLink testID="results-back" onPress={() => router.back()} />

      <ThemedText type="headline" testID="results-title">
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
          {/* Celebration-first hero: outcome headline, then the hero metric
              (ring + numeralXl). The live region announces the headline result
              when the session loads or the user switches between sessions. */}
          <Entrance index={0}>
            <Card
              variant="hero"
              padding="lg"
              testID="results-summary"
              accessibilityLiveRegion="polite"
              style={styles.hero}
            >
              {celebrate ? (
                <Confetti
                  seed={`results-${session.id}`}
                  count={isPersonalBest ? 22 : 16}
                  height={300}
                />
              ) : null}
              {isPersonalBest ? (
                <Badge
                  label="New personal best"
                  tone="streak"
                  icon={<Spark size={14} color={theme.streakSoftText} />}
                  testID="results-personal-best"
                />
              ) : null}
              <ThemedText
                type="eyebrow"
                themeColor="textSecondary"
                testID="results-game"
              >
                {game?.name ?? session.gameId}
              </ThemedText>
              {/* Performance band headline (constitution §16): an encouraging,
                  non-clinical read of the normalized score above the ring. */}
              <ThemedText
                type="display"
                themeColor={band.tone}
                testID="results-band"
                style={styles.headline}
              >
                {band.label}
              </ThemedText>
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
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Result
              </ThemedText>
              <View style={styles.rewardRow}>
                <Spark size={16} color={theme.xp} />
                <AnimatedNumber
                  value={session.xp}
                  format={(n) => `+${Math.round(n)} XP`}
                  type="numeral"
                  themeColor="xp"
                  testID="results-xp"
                />
              </View>
              {/* The session date is metadata, not part of the reward: glued
                  to the XP it read as "+50 XP Yesterday" (Campaign 026
                  visual-QA). Its own caption row keeps both facts legible. */}
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                testID="results-timestamp"
              >
                Played {formatRelativeDay(session.completedAt, mountedAt)}
              </ThemedText>
            </Card>
          </Entrance>

          {/* Metrics as four equal columns in ONE row (kit StatBlock); each
              value keeps its metric identity colour. */}
          <Entrance index={1}>
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
          </Entrance>

          {/* Workout progress (006R hardening): after finishing the current
              workout game, the completion beat lands above the CTA; the next
              game is offered as a quiet ghost beside the primary action. */}
          {workoutCompleted ? (
            <Card
              variant="outlined"
              tone="successSoft"
              testID="results-workout-complete"
            >
              <View style={styles.completeRow}>
                <Spark size={20} color={theme.successSoftText} />
                <View style={styles.completeText}>
                  <ThemedText type="label" themeColor="successSoftText">
                    Workout complete
                  </ThemedText>
                  <ThemedText type="bodySmall" themeColor="successSoftText">
                    {workoutInstance?.gameIds.length
                      ? `You finished all ${workoutInstance.gameIds.length} games today. Nice work!`
                      : "You finished today's workout. Nice work!"}
                  </ThemedText>
                </View>
              </View>
            </Card>
          ) : null}

          {/* One primary CTA (play again); the workout next-game action is a
              ghost so the viewport never carries two competing primaries. */}
          <Entrance index={2}>
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
          </Entrance>

          <Entrance index={3}>
            <Card variant="outlined" testID="results-rating" style={styles.quietCard}>
              <SectionHeader title="Rating movement" />
              {ratingHistory.length > 0 ? (
                <View style={styles.rows}>
                  {ratingHistory.map((h) => (
                    <View key={h.domain} style={styles.ratingRow}>
                      <ThemedText
                        type="body"
                        themeColor="textSecondary"
                        style={styles.ratingDomain}
                        numberOfLines={1}
                      >
                        {h.domain}
                      </ThemedText>
                      <ThemedText
                        type="label"
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
                <ThemedText type="bodySmall" themeColor="textSecondary">
                  No rating movement recorded for this session.
                </ThemedText>
              )}
              {ratingHistory.length > 0 ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  Deltas show how each domain rating changed because of this
                  session.
                </ThemedText>
              ) : null}
            </Card>
          </Entrance>

          <Entrance index={4}>
            <Card
              variant="outlined"
              testID="results-recent-sessions"
              style={styles.quietCard}
            >
              <SectionHeader title="Recent sessions" />
              <View style={styles.rows}>
                {recent.slice(0, 10).map((s) => {
                  const active = s.id === session.id;
                  return (
                    <Link key={s.id} href={`/results?id=${s.id}`} asChild>
                      <Pressable
                        testID={`results-session-${s.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${getGameDefinition(s.gameId)?.name ?? s.gameId} result from ${formatDayLabel(s.completedAt)}, ${Math.round(s.normalizedResult * 100)} percent`}
                        accessibilityHint="Shows this session's results"
                        accessibilityState={{ selected: active }}
                        // Flattened: expo-router's <Link asChild> (Radix Slot) THROWS
                        // on array styles in dev builds — this exact array crashed the
                        // /results route on device and made the durable workout
                        // journey impossible to complete (campaign 011 finding).
                        style={StyleSheet.flatten([
                          styles.recentRow,
                          active && { backgroundColor: theme.backgroundSelected },
                        ])}
                      >
                        <View style={styles.recentText}>
                          <ThemedText type="body" numberOfLines={1}>
                            {getGameDefinition(s.gameId)?.name ?? s.gameId}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="textSecondary">
                            {formatDayLabel(s.completedAt)}
                          </ThemedText>
                        </View>
                        <ThemedText type="numeral" themeColor="accent">
                          {Math.round(s.normalizedResult * 100)}%
                        </ThemedText>
                      </Pressable>
                    </Link>
                  );
                })}
              </View>
            </Card>
          </Entrance>
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
  // Hero content stacks on one centered axis (celebration frame → headline →
  // hero metric → quiet reward row).
  hero: {
    alignItems: "center",
    gap: Spacing.three,
  },
  headline: {
    textAlign: "center",
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  // Four equal columns, one row — never stacked cards.
  metricRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: Spacing.three,
  },
  metric: {
    flex: 1,
  },
  // Quiet grouped sections (outlined, not elevated) sit below the CTA.
  quietCard: {
    gap: Spacing.three,
  },
  rows: {
    gap: Spacing.two,
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
    minHeight: MinTouchTarget,
  },
  ratingDomain: {
    flexShrink: 1,
    textTransform: "capitalize",
  },
  completeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.twoHalf,
  },
  completeText: {
    flex: 1,
    gap: Spacing.half,
  },
  ctaBlock: {
    gap: Spacing.two,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.medium,
  },
  recentText: {
    flex: 1,
    flexShrink: 1,
    gap: Spacing.half,
  },
});
