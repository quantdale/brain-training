/**
 * Results — `/results` (change 076 UI/UX reboot, task 4.5).
 *
 * Session result surface (WP-2H + W13 UX wave; constitution §16: headline
 * plus meaningful metrics — score, accuracy, reaction, difficulty, rating
 * movement, XP, personal records). Shows one session (by `?id=` search param,
 * else the most recent) plus rating movement from the append-only history,
 * and a list of recent sessions to switch between.
 *
 * Presentation (change 076, REFERENCE_LOCK): the result is a staged artifact —
 * the played game's board still and the band headline in `stageInk` on the
 * charcoal stage card, with the score ring as its instrument. Metrics render
 * as numbered hairline fact rows (lock §8), the reward is its own quiet
 * outlined card, and UP NEXT / workout completion stay quiet context cards.
 * Exactly ONE red primary action per viewport, chosen by workout state:
 * Next game → Finish workout → Play again. A failed workout-advance write
 * (the only persistence failure this route can observe — the session itself
 * is already saved when it appears here) is surfaced inline as an errorSoft
 * band beside the danger toast. Empty/loading/error states keep the lock's
 * recoverable-state cards. A personal-best session still renders the
 * celebration treatment exactly once (sensory-gated success feedback + badge,
 * never blocking); weak outcomes stay honest and quiet.
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
  HAIRLINE,
  ProgressRing,
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

/**
 * Translucent white on the charcoal stage (REFERENCE_LOCK §7: the stage is
 * charcoal in BOTH schemes, so these do not need theme variants).
 */
const STAGE_INK_MUTED = "rgba(255, 255, 255, 0.72)";

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
  const { fontScale } = useWindowDimensions();
  // At the OS 2x text setting, the results artifact legitimately grows with
  // the user's copy, but its original desktop-density rhythm pushed the
  // primary replay action into the initial viewport edge. Keep the same
  // hierarchy and content while tightening only this local artifact's
  // padding/gap at large text sizes so the first actionable handoff remains
  // fully visible.
  const largeTextHero = fontScale >= 1.5;

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
          {/* The staged artifact (change 076, REFERENCE_LOCK §1/§4): the played
              game's board still and the band headline on the charcoal stage —
              continuity of artifact from the play session. The score ring is
              its instrument. 065: the artifact is a polite live region so the
              headline is announced when the results appear. */}
          <Entrance index={0}>
            <Card
              variant="stage"
              padding="none"
              testID="results-summary"
              accessibilityLiveRegion="polite">
              {celebrate ? (
                <Confetti
                  seed={`results-${session.id}`}
                  count={isPersonalBest ? 22 : 16}
                  height={300}
                />
              ) : null}
              {game ? <GameWorldArt game={game} size="hero" testID="results-world" /> : null}
              <View style={[styles.stageBody, largeTextHero && styles.stageBodyLargeText]}>
                {showPersonalBest ? (
                  <Badge
                    label="New personal best"
                    tone="streak"
                    icon={<Spark size={14} color={theme.streakSoftText} />}
                    testID="results-personal-best"
                  />
                ) : null}
                {/* Performance band headline (constitution §16): an encouraging,
                    non-clinical read of the normalized score. On the stage it
                    reads in `stageInk` — a weak outcome stays honest through
                    the band language, never through borrowed success colour. */}
                <ThemedText
                  type="resultHeadline"
                  themeColor="stageInk"
                  testID="results-band"
                  style={styles.headline}
                >
                  {band.label}
                </ThemedText>
                <View style={styles.scoreRow}>
                  <ProgressRing
                    value={session.normalizedResult}
                    tone="accent"
                    testID="results-ring"
                  >
                    <AnimatedNumber
                      value={scorePercent}
                      format={(n) => `${Math.round(n)}%`}
                      type="numeralXl"
                      themeColor="stageInk"
                      testID="results-score"
                    />
                  </ProgressRing>
                  <View style={styles.scoreMeta}>
                    <ThemedText
                      type="eyebrow"
                      style={styles.stageMuted}
                      testID="results-game"
                    >
                      {game?.name ?? session.gameId}
                    </ThemedText>
                    {/* The session date is metadata, not part of the reward: glued
                        to the XP it read as "+50 XP Yesterday" (Campaign 026
                        visual-QA). Its own caption row keeps both facts legible. */}
                    <ThemedText
                      type="caption"
                      style={styles.stageMuted}
                      testID="results-timestamp"
                    >
                      Played {formatRelativeDay(session.completedAt, mountedAt)}
                    </ThemedText>
                  </View>
                </View>
              </View>
            </Card>
          </Entrance>

          {/* Metrics as numbered hairline fact rows (REFERENCE_LOCK §8) —
              instrument-like evidence, never competing cards. Each row keeps
              its legacy `-value` testID on the value node. */}
          <Entrance index={1}>
            <View>
              <FactRow
                marker="01"
                label="Score"
                value={rawScore !== null ? String(Math.round(rawScore)) : "—"}
                testID="results-metric-score"
                valueTestID="results-metric-score-value"
              />
              <FactRow
                marker="02"
                label="Accuracy"
                value={
                  rawAccuracy !== null
                    ? `${Math.round(rawAccuracy * 100)}%`
                    : "—"
                }
                testID="results-metric-accuracy"
                valueTestID="results-metric-accuracy-value"
              />
              <FactRow
                marker="03"
                label="Time"
                value={`${Math.round(session.durationMs / 1000)}s`}
                testID="results-metric-time"
                valueTestID="results-metric-time-value"
              />
              <FactRow
                marker="04"
                label="Difficulty"
                value={difficultyLevel}
                testID="results-metric-difficulty"
                valueTestID="results-metric-difficulty-value"
                divider={false}
              />
            </View>
          </Entrance>

          {/* The outcome is understood before the progression reward: the
              reward is its own quiet outlined card, not a competing panel. */}
          <Entrance index={2}>
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
                      ? `${workoutInstance.gameIds.length}/${workoutInstance.gameIds.length} games complete`
                      : "You finished today's workout. Nice work!"}
                  </ThemedText>
                  {workoutInstance?.gameIds.length ? (
                    <ThemedText type="caption" themeColor="successSoftText">
                      {`You finished all ${workoutInstance.gameIds.length} games today. Nice work!`}
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

          {/* Persistence honesty (change 076): the only write this route can
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
                ✕ {workoutAdvanceError}
              </ThemedText>
              <ThemedText type="caption" themeColor="dangerSoftText">
                Your session is safe — reopen the workout to continue.
              </ThemedText>
            </Card>
          ) : null}

          {/* One primary CTA: continue the workout when a next leg exists,
              finish the workout when complete, otherwise replay standalone. */}
          <Entrance index={3}>
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

          <Entrance index={4}>
            <FactSection title="Rating movement" testID="results-rating">
              {ratingHistory.length > 0 ? (
                ratingHistory.map((h, index) => (
                  <FactRow
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
                <FactRow
                  label="No rating movement recorded for this session"
                  hint="Ratings update as you play more sessions"
                  divider={false}
                />
              )}
            </FactSection>
          </Entrance>

          <Entrance index={5}>
            <FactSection title="Recent sessions" testID="results-recent-sessions">
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
                        <ThemedText type="body" numberOfLines={1}>
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
            </FactSection>
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

/**
 * Numbered secondary section (REFERENCE_LOCK §8): an uppercase tracked title
 * over hairline fact rows — quiet, credible, never competing with the staged
 * artifact above.
 */
function FactSection({
  title,
  testID,
  children,
}: {
  title: string;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <View testID={testID}>
      <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View>{children}</View>
    </View>
  );
}

/**
 * One hairline fact row (REFERENCE_LOCK §8): tracked uppercase muted label
 * left, medium value right, hairline separator below.
 */
function FactRow({
  marker,
  label,
  value,
  hint,
  valueTone = "text",
  valueTestID,
  testID,
  divider = true,
}: {
  marker?: string;
  label: string;
  value?: string;
  hint?: string;
  valueTone?: "text" | "success" | "danger" | "textSecondary";
  valueTestID?: string;
  testID?: string;
  divider?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.factRow,
        divider ? { borderBottomWidth: HAIRLINE, borderBottomColor: theme.border } : null,
      ]}>
      {marker ? (
        <ThemedText type="label" themeColor="textMuted" style={styles.factMarker}>
          {marker}
        </ThemedText>
      ) : null}
      <View style={styles.factLabels}>
        <ThemedText type="eyebrow" themeColor="textMuted" style={styles.factLabel}>
          {label.toUpperCase()}
        </ThemedText>
        {hint ? (
          <ThemedText type="caption" themeColor="textMuted" numberOfLines={2}>
            {hint}
          </ThemedText>
        ) : null}
      </View>
      {value !== undefined ? (
        <ThemedText
          type="bodySmall"
          themeColor={valueTone}
          style={styles.factValue}
          testID={valueTestID}
          numberOfLines={1}>
          {value}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The staged artifact owns the world still; its body stacks the band
  // headline and the score ring on one instrument row.
  stageBody: {
    padding: Spacing.four,
    gap: Spacing.three,
    alignSelf: "stretch",
  },
  // At OS 2x text the artifact tightens its own rhythm so the first
  // actionable handoff stays in the initial viewport (unchanged intent from
  // the pre-reboot hero).
  stageBodyLargeText: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headline: {
    textAlign: "center",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.four,
  },
  scoreMeta: {
    flexShrink: 1,
    gap: Spacing.one,
  },
  stageMuted: {
    color: STAGE_INK_MUTED,
  },
  rewardRow: {
    flexDirection: "row",
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
  sectionTitle: {
    marginBottom: Spacing.one,
  },
  factRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  factMarker: {
    minWidth: Spacing.three,
    fontVariant: ["tabular-nums"],
  },
  factLabels: {
    flex: 1,
    gap: Spacing.half,
  },
  // Fact labels use the tracked uppercase eyebrow at emphasis weight — a
  // label, not a shout (lock §2 reserves 800 for headers/CTA).
  factLabel: {
    fontWeight: "600",
  },
  factValue: {
    flexShrink: 0,
    fontWeight: "500",
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
