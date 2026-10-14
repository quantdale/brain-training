/**
 * Results — `/results` (change 076 UI/UX reboot, task 4.5).
 *
 * Session result surface (WP-2H + W13 UX wave; constitution §16: headline
 * plus meaningful metrics — score, accuracy, reaction, difficulty, rating
 * movement, XP, personal records). Shows one session (by `?id=` search param,
 * else the most recent) plus rating movement from the append-only history,
 * and a list of recent sessions to switch between.
 *
 * Campaign 077: concise earned outcome, saved reward and continuation first.
 * Detailed facts use the shared responsive report rows. Personal-best feedback
 * stays once per qualifying session; workout ownership and persistence remain
 * authoritative even when this screen is reopened from history.
 */

import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { ScreenShell } from "@/components/screen-shell";
import { parseCanonicalSessionId } from "@/routing/route-params";
import { StateCard } from "@/components/shell";
import { formatRelativeDay, performanceBand } from "@/components/shell/format";
import { formatDayLabel } from "@/analytics/format";
import { ThemedText } from "@/components/themed-text";
import { GameWorldArt } from "@/components/discovery/game-identity";
import {
  AnimatedNumber,
  BackLink,
  Badge,
  Button,
  Card,
  Confetti,
  Entrance,
  Report,
  ReportRow,
  Spark,
  showToast,
  useSafeBack,
} from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase, GameSessionRecord } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { useTheme } from "@/hooks/use-theme";
import { getGameDefinition } from "@/registry/registry";
import { DIFFICULTY_LABELS, liveAudioHaptics } from "@/sdk";
import { useWorkoutResultAdvance } from "@/workout/use-workout-result-advance";
import { gameHref } from "@/workout/routing";
import { MIN_TOUCH_TARGET } from '@/components/a11y';

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
 * itself, so exactly one match means nothing earlier beat or tied it. Uses an
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
    // 057/065: a session cannot claim a personal best unless it is inside
    // its own comparison universe. A future-dated (clock-skewed/imported)
    // completion would otherwise be excluded by the `toMs` clamp and any
    // single earlier at-or-above session would take the badge on its behalf.
    // R1 residual: read the clock once — a completion timestamp falling
    // between two reads could flip the future-dated verdict vs the `toMs`
    // clamp and lose (or grant) the badge on a microsecond boundary.
    const now = Date.now();
    if (session.completedAt > now) {
      return false;
    }
    // 057: clamp the comparison universe to the same `now` the recent list
    // uses — a clock-skewed future-dated session must not judge itself
    // against sessions that have not happened yet from the UI's perspective.
    const atOrAbove = await db.sessions.countSessions({
      gameIds: [session.gameId],
      toMs: Math.min(session.completedAt, now),
      minNormalized: session.normalizedResult,
    });
    // 065: exactly one eligible session — the session itself — is required.
    // A count of 0 means this session fell outside its own comparison
    // universe (e.g. a future-dated completion clamped by `toMs`), and an
    // empty universe must not claim a personal best.
    return atOrAbove === 1;
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
  // App-owned input envelope (Campaign 053): a malformed or oversized session
  // id is treated as absent, so the route renders the recoverable empty state
  // instead of querying for it.
  const sessionId = parseCanonicalSessionId(id) ?? undefined;
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const showArtwork = width >= 360 && fontScale < 1.5;
  // Reload whenever the screen regains focus (a session may have just landed).
  const [refreshKey, setRefreshKey] = useState(0);
  // Captured once at mount: the relative-day label must not drift between
  // renders, and reading the clock during render is impure.
  const [mountedAt] = useState(() => Date.now());
  // 058: cold deep links land with an empty stack — fall back to home.
  const goBack = useSafeBack('/');
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data, loaded, error } = useDbData(
    (db) => loadResults(db, sessionId),
    [sessionId, refreshKey],
    EMPTY,
  );
  const { session, recent, ratingHistory, isPersonalBest } = data;

  // Campaign 055 honesty gate: a first-ever session is technically a best, but
  // presenting "New personal best" (or the success beat) on a weak result
  // implies success. Only a mid-band-or-better personal best earns it.
  const showPersonalBest =
    session !== null && isPersonalBest && session.normalizedResult >= 0.5;

  // Cross-feature wiring (006R hardening): advance the durable workout when this
  // session finished the current game, and surface the next game / completion.
  const {
    instance: workoutInstance,
    nextGameId,
    nextProvenance,
    completed: workoutCompleted,
    advanceError: workoutAdvanceError,
  } = useWorkoutResultAdvance(session);

  // Celebration discipline (micro-interactions R5): a personal best earns one
  // bounded, non-blocking success beat; routine completions stay quiet. The
  // sensory service honours the global toggles, so a muted device stays
  // silent while the badge still shows.
  useEffect(() => {
    if (!showPersonalBest || session === null) {
      return;
    }
    if (celebratedResults.has(session.id)) {
      return;
    }
    celebratedResults.add(session.id);
    liveAudioHaptics.feedback("success");
  }, [showPersonalBest, session]);

  // Workout-advance failure (Campaign 027): the session is saved, but the
  // leg transition did not land. Surface it once per distinct message; the
  // screen otherwise has no way to tell the player the workout is stuck.
  const advanceErrorShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (workoutAdvanceError === null || advanceErrorShownRef.current === workoutAdvanceError) {
      return;
    }
    advanceErrorShownRef.current = workoutAdvanceError;
    showToast({
      title: workoutAdvanceError,
      detail: "Your session is safe — reopen the workout to continue.",
      tone: "danger",
    });
  }, [workoutAdvanceError]);

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
  // Celebration beat: a perfect score or a real personal best earns the
  // confetti margins; routine completions stay quiet. `Confetti` collapses to
  // nothing under reduced motion and is non-interactive (`pointerEvents="none"`).
  const celebrate = session !== null && (showPersonalBest || session.normalizedResult >= 1);

  return (
    <ScreenShell>
      <BackLink testID="results-back" onPress={goBack} />

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
          <Entrance index={0}>
            <Card variant="outlined" testID="results-summary" accessibilityLiveRegion="polite">
              {celebrate ? <Confetti seed={`results-${session.id}`} count={isPersonalBest ? 22 : 16} height={180} /> : null}
              <View style={styles.summaryRow}>
                {game && showArtwork ? <View style={styles.summaryArt} pointerEvents="none"><GameWorldArt game={game} size="thumbnail" testID="results-world" /></View> : null}
                <View style={styles.scoreMeta}>
                  <ThemedText type="bodySmall" themeColor="textSecondary" testID="results-game">{game?.name ?? session.gameId}</ThemedText>
                  <ThemedText type="resultHeadline" testID="results-band">{band.label}</ThemedText>
                  {/* Retain the external metric anchor; a direct labeled
                      value now replaces the old decorative score ring. */}
                  <View testID="results-ring">
                    <AnimatedNumber value={scorePercent} format={(n) => `${Math.round(n)}%`} type="numeral" testID="results-score" />
                    <ThemedText type="caption" themeColor="textSecondary">Session performance</ThemedText>
                  </View>
                </View>
              </View>
              {showPersonalBest ? <Badge label="New personal best" tone="streak" icon={<Spark size={14} color={theme.streakSoftText} />} testID="results-personal-best" /> : null}
              <ThemedText type="caption" themeColor="textSecondary" testID="results-timestamp">Played {formatRelativeDay(session.completedAt, mountedAt)}</ThemedText>
            </Card>
          </Entrance>

          {/* The outcome is understood before the progression reward: the
              reward is its own quiet outlined card, not a competing panel. */}
          <Entrance index={1}>
            <Card
              variant="outlined"
              testID="results-reward"
              accessibilityLiveRegion="polite">
              <ThemedText type="eyebrow" themeColor="textMuted">
                REWARD
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
                <ThemedText type="caption" themeColor="textMuted">
                  Saved on this device
                </ThemedText>
              </View>
            </Card>
          </Entrance>

          {/* Workout progress (006R hardening): completion is explicit and the
              next leg is a single, clear handoff. */}
          {workoutCompleted ? (
            <Card
              variant="outlined"
              tone="successSoft"
              testID="results-workout-complete"
              accessibilityLiveRegion="polite">
              <View style={styles.completeRow}>
                <Spark size={20} color={theme.successSoftText} />
                <View style={styles.completeText}>
                  <ThemedText type="label" themeColor="successSoftText">
                    Workout complete
                  </ThemedText>
                  <ThemedText type="bodySmall" themeColor="successSoftText">
                    {workoutInstance?.gameIds.length
                      ? (workoutInstance.skippedIndices?.length ?? 0) > 0
                        ? `${workoutInstance.gameIds.length - workoutInstance.skippedIndices.length} games played · ${workoutInstance.skippedIndices.length} skipped`
                        : `${workoutInstance.gameIds.length}/${workoutInstance.gameIds.length} games complete`
                      : "You finished today's workout. Nice work!"}
                  </ThemedText>
                  {workoutInstance?.gameIds.length ? (
                    <ThemedText type="caption" themeColor="successSoftText">
                      {(workoutInstance.skippedIndices?.length ?? 0) > 0
                        ? 'Your played games and workout progress are saved.'
                        : `You finished all ${workoutInstance.gameIds.length} games today. Nice work!`}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            </Card>
          ) : null}

          {nextGameId && !workoutCompleted ? (
            <Card variant="outlined" testID="results-next-context">
              <ThemedText type="eyebrow" themeColor="textMuted">
                UP NEXT
              </ThemedText>
              <ThemedText type="headline" testID="results-next-title">
                {nextGame?.name ?? nextGameId}
              </ThemedText>
              <ThemedText type="bodySmall" themeColor="textSecondary">
                {workoutInstance?.gameIds.length && nextProvenance
                  ? `Game ${nextProvenance.legIndex + 1} of ${workoutInstance.gameIds.length} · progress saved`
                  : "Your workout progress is saved."}
              </ThemedText>
            </Card>
          ) : null}

              {/* Persistence honesty: the only write this route can
              observe failing is the durable workout advance (the session
              itself is already saved when it appears here). Beside the danger
              toast, the failure stays visible as an errorSoft band — error is
              text + shape on `errorSoft`, never a red fill (lock §1). */}
          {workoutAdvanceError ? (
            <Card
              variant="outlined"
              tone="dangerSoft"
              testID="results-persist-error"
              accessibilityLiveRegion="polite">
              <ThemedText type="label" themeColor="dangerSoftText">
                {workoutAdvanceError}
              </ThemedText>
              <ThemedText type="caption" themeColor="dangerSoftText">
                Your session is safe — reopen the workout to continue.
              </ThemedText>
            </Card>
          ) : null}

          {/* One primary CTA: continue the workout when a next leg exists,
              finish the workout when complete, otherwise replay standalone. */}
          <Entrance index={2}>
            <View style={styles.ctaBlock}>
              {!workoutCompleted && nextGameId ? (
                <Button
                  variant="primary"
                  size="lg"
                  label="Next game"
                  sublabel={nextGame?.name ?? nextGameId}
                  testID="results-next-game"
                  accessibilityHint={`Continue the workout with ${nextGame?.name ?? nextGameId}`}
                  onPress={() => router.push(gameHref(nextGameId, nextProvenance))}
                />
              ) : null}
              {workoutCompleted ? (
                <Button
                  variant="primary"
                  size="lg"
                  label="Finish workout"
                  sublabel="Back to Today"
                  testID="results-finish-workout"
                  accessibilityHint="Return to Today after finishing the workout"
                  onPress={() => router.replace("/")}
                />
              ) : null}
              <Button
                variant={!workoutCompleted && nextGameId ? "secondary" : workoutCompleted ? "secondary" : "primary"}
                label="Play again"
                sublabel={game?.name ?? session.gameId}
                testID="results-play-again"
                accessibilityHint={`Start a new session of ${game?.name ?? session.gameId}`}
                onPress={() => router.push(gameHref(session.gameId))}
              />
            </View>
          </Entrance>

          <Entrance index={3}>
            <Report title="Session details">
              <ReportRow
                label="Score"
                value={rawScore !== null ? String(Math.round(rawScore)) : "—"}
                testID="results-metric-score"
                valueTestID="results-metric-score-value"
              />
              <ReportRow
                label="Accuracy"
                value={
                  rawAccuracy !== null
                    ? `${Math.round(rawAccuracy * 100)}%`
                    : "—"
                }
                testID="results-metric-accuracy"
                valueTestID="results-metric-accuracy-value"
              />
              <ReportRow
                label="Time"
                value={`${Math.round(session.durationMs / 1000)}s`}
                testID="results-metric-time"
                valueTestID="results-metric-time-value"
              />
              <ReportRow
                label="Difficulty"
                value={difficultyLevel}
                testID="results-metric-difficulty"
                valueTestID="results-metric-difficulty-value"
                divider={false}
              />
            </Report>
          </Entrance>

          <Entrance index={4}>
            <Report title="Rating movement" testID="results-rating">
              {ratingHistory.length > 0 ? (
                ratingHistory.map((h, index) => (
                  <ReportRow
                    key={h.domain}
                    label={h.domain}
                    value={`${h.delta >= 0 ? "+" : ""}${h.delta} → ${h.ratingAfter}`}
                    valueTone={h.delta > 0 ? "success" : h.delta < 0 ? "danger" : "textSecondary"}
                    divider={index < ratingHistory.length - 1}
                    testID={`results-rating-delta-${h.domain
                      .replace(/[^a-z]/gi, "")
                      .toLowerCase()}`}
                  />
                ))
              ) : (
                <ReportRow
                  label="No rating movement recorded for this session"
                  hint="Ratings update as you play more sessions"
                  divider={false}
                />
              )}
            </Report>
          </Entrance>

          <Entrance index={5}>
            <Report title="Recent sessions" testID="results-recent-sessions">
              {recent.slice(0, 10).map((s, index) => {
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
                        index < recent.slice(0, 10).length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.border,
                        },
                        active && { backgroundColor: theme.backgroundSelected },
                      ])}
                    >
                      <View style={styles.recentText}>
                        <ThemedText type="body">
                          {getGameDefinition(s.gameId)?.name ?? s.gameId}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {formatDayLabel(s.completedAt)}
                        </ThemedText>
                      </View>
                      <ThemedText type="numeral" themeColor="textSecondary">
                        {Math.round(s.normalizedResult * 100)}%
                      </ThemedText>
                    </Pressable>
                  </Link>
                );
              })}
            </Report>
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
            onPress: () => router.replace("/games"),
            accessibilityLabel: "Browse the game library",
          }}
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  summaryArt: { width: 64, height: 64, overflow: "hidden", borderRadius: Radii.medium },
  scoreMeta: { flex: 1, minWidth: 0, gap: Spacing.one },
  rewardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.two,
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
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: Spacing.two,
    borderRadius: Radii.small,
  },
  recentText: {
    flex: 1,
    flexShrink: 1,
    gap: Spacing.half,
  },
});
