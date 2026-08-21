/**
 * Home — dashboard (Wave 1 shell + WP-2H + campaign 003 personalization).
 *
 * Static slots per PROJECT_CONSTITUTION §13, in first-viewport order:
 * Today's Workout CTA, streak/XP/level stats, recent games. The workout is a
 * deterministic daily 4-game selection personalized with weak-domain
 * balancing + recency avoidance (src/workout/personalize.ts); rerolls follow
 * §14 economics — first free, then escalating coin costs (ledger-debited).
 * Streak/XP/level read real persisted data when the db is available and
 * degrade to placeholders otherwise. Slot testIDs are the stable QA contract.
 *
 * W13 UX wave: focus-refresh so returning from a game updates every slot,
 * an explicit Continue-workout CTA at the resume position, a workout
 * completion bar, quick-action drills (games/progress/rewards), coin balance
 * surfacing, relative-day recency labels on recent sessions, and explicit
 * loading/error states. The first-run/empty-state render tree is kept stable
 * for the visual-baseline canary snapshots.
 */

import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ProgressTrack, SectionHeader, StateCard, StatTile } from "@/components/shell";
import { formatRelativeDay } from "@/components/shell/format";
import { ScreenShell } from "@/components/screen-shell";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MinTouchTarget } from "@/components/a11y";
import { Radii, Spacing } from "@/constants/theme";
import type { AppDatabase, DomainRating } from "@/db";
import type { GameDefinition } from "@/sdk";
import { useDbData } from "@/hooks/use-db-data";
import { levelForXp } from "@/rating";
import { getAllGameDefinitions } from "@/registry/registry";
import { effectiveCurrent, reconstructStreak } from "@/streaks";
import { localDateString } from "@/workout/today";
import { canAffordReroll, MAX_REROLLS_PER_DAY } from "@/workout/reroll";
import { useWorkout } from "@/workout/use-workout";

interface HomeData {
  domainRatings: DomainRating[];
  recentGameIds: string[];
  /** Local YYYY-MM-DD of each recent session (for streak reconstruction). */
  activityDates: string[];
  balance: number;
  totalXp: number;
  /** Task 9.6: Recent sessions with game details for display */
  recentSessions: readonly {
    id: string;
    gameId: string;
    gameName: string;
    normalizedResult: number;
    xp: number;
    completedAt: number;
  }[];
}

const EMPTY_HOME: HomeData = {
  domainRatings: [],
  recentGameIds: [],
  activityDates: [],
  balance: 0,
  totalXp: 0,
  recentSessions: [],
};

async function loadHome(db: AppDatabase): Promise<HomeData> {
  const [domainRatings, recent, balance, sessionXp, awardsXp, activityDates] =
    await Promise.all([
      db.ratings.getRatings(),
      db.sessions.listRecent(30),
      db.ledger.getBalance(),
      db.sessions.getTotalXp(),
      db.xpAwards.getTotalAwardedXp(),
      // Task 9.3: Use distinct activity dates for streak calculation
      db.sessions.getDistinctActivityDates(),
    ]);

  // Task 9.6: Build recent sessions with game names
  const { getGameDefinition } = await import("@/registry/registry");
  const recentSessions = recent.slice(0, 5).map((session) => ({
    id: session.id,
    gameId: session.gameId,
    gameName: getGameDefinition(session.gameId)?.name ?? session.gameId,
    normalizedResult: session.normalizedResult,
    xp: session.xp,
    completedAt: session.completedAt,
  }));

  return {
    domainRatings,
    recentGameIds: recent.map((session) => session.gameId),
    activityDates,
    balance,
    totalXp: sessionXp + awardsXp,
    recentSessions,
  };
}

export default function HomeScreen() {
  const today = localDateString();
  const [refreshKey, setRefreshKey] = useState(0);
  // Reload on every focus so slots reflect sessions completed elsewhere (the
  // workout instance additionally self-refreshes via workout events).
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, []),
  );
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const { data, loaded, error } = useDbData(loadHome, [refreshKey], EMPTY_HOME);

  // Durable workout context: loads/creates today's persisted instance and owns
  // reroll (persisted attempt + transactional currency debit). The displayed
  // selection reflects the persisted reroll attempt (006R tasks 6.2/6.5).
  const workoutFlow = useWorkout({
    domainRatings: data.domainRatings,
    recentGameIds: data.recentGameIds,
    balance: data.balance,
  });
  const rerollAttempt = workoutFlow.instance?.rerollAttempt ?? 0;
  const nextRerollCost = workoutFlow.rerollCostNow;
  const rerollAffordable = canAffordReroll(data.balance, rerollAttempt);
  const rerollExhausted = rerollAttempt >= MAX_REROLLS_PER_DAY;

  // Durable workout progress markers (006R hardening): reflect the persisted
  // current index so completed/current positions are visually distinct. The
  // instance refreshes on focus (see `useWorkout`), so leaving results after a
  // game advances the workout and Home re-renders with the new index.
  const workoutIndex = workoutFlow.instance?.currentIndex ?? 0;
  const workoutStatus = workoutFlow.instance?.status ?? "active";

  // Displayed selection reflects the persisted workout instance (so rerolls and
  // resume state stay in sync with what is stored).
  const allGames = getAllGameDefinitions();
  const workout: GameDefinition[] = workoutFlow.instance
    ? workoutFlow.instance.gameIds
        .map((id) => allGames.find((g) => g.id === id))
        .filter((g): g is GameDefinition => g !== undefined)
    : [];
  const currentGame = workoutFlow.currentGameId
    ? allGames.find((g) => g.id === workoutFlow.currentGameId)
    : undefined;

  const streak = reconstructStreak(data.activityDates, today);
  const currentStreak = effectiveCurrent(streak, today);
  const level = levelForXp(data.totalXp);

  // Error surfacing: only when a real game catalog is installed. With an empty
  // registry (fresh bootstrap / bare test harness) a db failure is expected
  // and the static placeholders ARE the correct degraded state — surfacing an
  // error there would flip the visual-baseline canaries.
  const hasCatalog = allGames.length > 0;

  const onReroll = workoutFlow.reroll;

  const rerollLabel =
    workoutStatus === "completed"
      ? "Workout complete"
      : rerollExhausted
        ? "No rerolls left"
        : nextRerollCost === 0
          ? "Reroll workout (free)"
          : rerollAffordable
            ? `Reroll workout (${nextRerollCost} coins)`
            : `Need ${nextRerollCost} coins`;

  // Explanatory hint so the reroll economy is legible (Queue D).
  const rerollHint =
    workoutStatus === "completed"
      ? "You've finished today's workout."
      : rerollExhausted
        ? "You've used all rerolls for today."
        : nextRerollCost === 0
          ? "First reroll is free; later rerolls cost escalating coins."
          : rerollAffordable
            ? `Reroll costs ${nextRerollCost} coins (more each time).`
            : `Not enough coins — you need ${nextRerollCost}.`;

  const nowMs = Date.now();

  return (
    <ScreenShell>
      <ThemedText type="caption" themeColor="accent" testID="home-brand">
        BRAIN TRAINING
      </ThemedText>
      <ThemedText type="title" testID="home-title">
        Home
      </ThemedText>

      {/* Loading state: brief inline hint while the first db read settles. */}
      {!loaded && (
        <ThemedText
          type="caption"
          themeColor="textSecondary"
          testID="home-loading"
        >
          Loading your training data…
        </ThemedText>
      )}

      {/* Today's Workout CTA slot (constitution §13: primary CTA). */}
      <ThemedView
        type="surface"
        style={styles.ctaCard}
        testID="home-workout-cta"
      >
        <ThemedText type="subtitle">Today&apos;s Workout</ThemedText>
        {workoutStatus === "completed" ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID="home-workout-complete"
          >
            Workout complete — come back tomorrow to train again.
          </ThemedText>
        ) : (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID="home-workout-progress"
          >
            {workoutIndex} of {workout.length} done — keep going!
          </ThemedText>
        )}
        {workout.length > 0 ? (
          <>
            {/* Completion bar mirrors the durable resume position. */}
            <ProgressTrack
              ratio={workoutIndex / workout.length}
              testID="home-workout-progress-bar"
            />
            <ThemedText type="small" themeColor="textSecondary">
              Your daily {workout.length}-game training plan, balanced toward
              your weakest domains. Play any game to earn XP and train your
              ratings.
            </ThemedText>
            <View style={styles.workoutList} testID="home-workout-list">
              {workout.map((game, index) => {
                const isCompleted =
                  workoutStatus === "completed" || index < workoutIndex;
                const isCurrent =
                  workoutStatus === "active" && index === workoutIndex;
                return (
                  <Link key={game.id} href={`/game/${game.id}`} asChild>
                    <Pressable
                      testID={`home-workout-game-${game.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${game.name}, ${game.primaryCategory}, ${
                        isCompleted ? "done" : isCurrent ? "up now" : "up next"
                      }`}
                      style={
                        isCurrent
                          ? StyleSheet.flatten([
                              styles.workoutRow,
                              styles.workoutRowCurrent,
                            ])
                          : styles.workoutRow
                      }
                    >
                      <ThemedText type="smallBold" themeColor="accent">
                        {index + 1}.
                      </ThemedText>
                      <View style={styles.workoutItemText}>
                        <ThemedText type="small">{game.name}</ThemedText>
                        <ThemedText
                          type="caption"
                          themeColor="textSecondary"
                        >
                          {game.primaryCategory}
                        </ThemedText>
                      </View>
                      <ThemedText
                        type="caption"
                        themeColor="textSecondary"
                        testID={`home-workout-game-status-${game.id}`}
                      >
                        {isCompleted ? "Done" : isCurrent ? "Now" : "Up next"}
                      </ThemedText>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
            {/* Primary resume affordance: jumps straight to the current game. */}
            {workoutStatus === "active" && workoutFlow.currentGameId ? (
              <Link href={`/game/${workoutFlow.currentGameId}`} asChild>
                <Pressable
                  testID="home-workout-continue"
                  accessibilityRole="button"
                  accessibilityLabel={`Continue today's workout with ${
                    currentGame?.name ?? "the next game"
                  }`}
                >
                  <ThemedView type="accentSoft" style={styles.ctaPill}>
                    <ThemedText type="smallBold" themeColor="accent">
                      Continue workout →
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </Link>
            ) : null}
            <Pressable
              testID="home-workout-reroll"
              accessibilityRole="button"
              accessibilityLabel={rerollLabel}
              accessibilityHint={rerollHint}
              disabled={
                !rerollAffordable ||
                rerollExhausted ||
                workoutStatus === "completed"
              }
              onPress={onReroll}
            >
              <ThemedView
                type={
                  rerollExhausted ||
                  !rerollAffordable ||
                  workoutStatus === "completed"
                    ? "surface"
                    : "accentSoft"
                }
                style={[styles.ctaPill, styles.secondaryPill]}
              >
                <ThemedText type="smallBold" themeColor="accent">
                  {rerollLabel}
                </ThemedText>
              </ThemedView>
            </Pressable>
            {workoutStatus === "active" && (
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                testID="home-reroll-hint"
              >
                {rerollHint}
              </ThemedText>
            )}
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Your daily 4-game training plan will appear here once games are
            registered.
          </ThemedText>
        )}
      </ThemedView>

      {/* Streak / XP / level slot — real values when the db is available.
          Coins join the row once a balance exists (economy visibility). */}
      <View style={styles.statsRow}>
        <StatTile
          testID="home-stat-streak"
          label="Streak"
          value={`${currentStreak} days`}
        />
        <StatTile testID="home-stat-xp" label="XP" value={`${data.totalXp}`} />
        <StatTile testID="home-stat-level" label="Level" value={`${level}`} />
        {data.balance > 0 && (
          <StatTile
            testID="home-stat-coins"
            label="Coins"
            value={`${data.balance}`}
          />
        )}
      </View>
      {loaded && streak.atRisk && (
        <ThemedText
          type="caption"
          themeColor="warning"
          testID="home-streak-at-risk"
        >
          Play today to keep your streak alive.
        </ThemedText>
      )}

      {/* Error state: recoverable read failure with an explicit retry.
          `error != null` keeps the guard boolean so the JSX stays ReactNode. */}
      {loaded && error != null && hasCatalog ? (
        <StateCard
          variant="error"
          testID="home-data-error"
          title="Couldn't load your data"
          message="Your training data couldn't be read just now. Your progress stays safely on disk — try again."
          action={{ label: "Retry", onPress: refresh }}
        />
      ) : null}

      {/* Quick actions (constitution §13 order): drill-downs one tap away. */}
      {workout.length > 0 && (
        <View>
          <SectionHeader title="Quick actions" />
          <View style={styles.quickRow} testID="home-quick-actions">
            <Link href="/games" asChild>
              <Pressable
                testID="home-quick-games"
                accessibilityRole="button"
                accessibilityLabel="Browse all games"
              >
                <ThemedView type="surface" style={styles.quickPill}>
                  <ThemedText type="smallBold" themeColor="accent">
                    Browse games
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
            <Link href={"/progress" as any} asChild>
              <Pressable
                testID="home-quick-progress"
                accessibilityRole="button"
                accessibilityLabel="View your progress"
              >
                <ThemedView type="surface" style={styles.quickPill}>
                  <ThemedText type="smallBold" themeColor="accent">
                    Progress
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
            <Link href={"/rewards" as any} asChild>
              <Pressable
                testID="home-quick-rewards"
                accessibilityRole="button"
                accessibilityLabel="Open rewards"
              >
                <ThemedView type="surface" style={styles.quickPill}>
                  <ThemedText type="smallBold" themeColor="accent">
                    Rewards
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          </View>
        </View>
      )}

      {/* Recent games slot — task 9.6: real recent session/game data */}
      <ThemedView
        type="surface"
        style={styles.recentCard}
        testID="home-recent-games"
      >
        {data.recentSessions.length > 0 ? (
          <SectionHeader
            title="Recent games"
            actionLabel="Results"
            actionTestID="home-recent-all"
            actionAccessibilityLabel="Open full results history"
            onActionPress={() => router.push("/results")}
          />
        ) : (
          <ThemedText type="subtitle">Recent games</ThemedText>
        )}
        {data.recentSessions.length > 0 ? (
          <View style={styles.recentList}>
            {data.recentSessions.map((session) => (
              <Link key={session.id} href={`/results?id=${session.id}`} asChild>
                <Pressable
                  testID={`home-recent-game-${session.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${session.gameName} result, ${formatRelativeDay(
                    session.completedAt,
                    nowMs,
                  )}, ${Math.round(session.normalizedResult * 100)} percent`}
                  style={({ pressed }) => [
                    styles.recentRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.recentText}>
                    <ThemedText type="small">{session.gameName}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {formatRelativeDay(session.completedAt, nowMs)} · +
                      {session.xp} XP
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold">
                    {Math.round(session.normalizedResult * 100)}%
                  </ThemedText>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Your latest sessions will show up here after your first workout.
          </ThemedText>
        )}
      </ThemedView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  ctaCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  ctaPill: {
    alignSelf: "flex-start",
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  secondaryPill: {
    borderWidth: 1,
    borderColor: "rgba(120,120,140,0.2)",
  },
  workoutList: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  workoutItemText: {
    flex: 1,
    gap: Spacing.half,
  },
  workoutRowCurrent: {
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.two,
    backgroundColor: "rgba(0, 122, 255, 0.12)",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  quickPill: {
    ...MinTouchTarget,
    alignSelf: "flex-start",
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: "rgba(120,120,140,0.2)",
  },
  recentCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  recentList: {
    gap: Spacing.two,
  },
  recentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  recentText: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
