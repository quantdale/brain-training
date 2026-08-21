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
 */

import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
  const { data, loaded } = useDbData(loadHome, [], EMPTY_HOME);

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
  const workout: GameDefinition[] = workoutFlow.instance
    ? workoutFlow.instance.gameIds
        .map((id) => getAllGameDefinitions().find((g) => g.id === id))
        .filter((g): g is GameDefinition => g !== undefined)
    : [];

  const streak = reconstructStreak(data.activityDates, today);
  const currentStreak = effectiveCurrent(streak, today);
  const level = levelForXp(data.totalXp);

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

  return (
    <ScreenShell>
      <ThemedText type="caption" themeColor="accent" testID="home-brand">
        BRAIN TRAINING
      </ThemedText>
      <ThemedText type="title" testID="home-title">
        Home
      </ThemedText>

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
                      <ThemedText type="small">{game.name}</ThemedText>
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
                style={styles.ctaPill}
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

      {/* Streak / XP / level slot — real values when the db is available. */}
      <View style={styles.statsRow}>
        <StatCard
          testID="home-stat-streak"
          label="Streak"
          value={`${currentStreak} days`}
        />
        <StatCard testID="home-stat-xp" label="XP" value={`${data.totalXp}`} />
        <StatCard testID="home-stat-level" label="Level" value={`${level}`} />
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

      {/* Recent games slot — task 9.6: real recent session/game data */}
      <ThemedView
        type="surface"
        style={styles.recentCard}
        testID="home-recent-games"
      >
        <ThemedText type="subtitle">Recent games</ThemedText>
        {data.recentSessions.length > 0 ? (
          <View style={styles.recentList}>
            {data.recentSessions.map((session) => (
              <Link key={session.id} href={`/results?id=${session.id}`} asChild>
                <Pressable
                  testID={`home-recent-game-${session.id}`}
                  accessibilityRole="button"
                  style={styles.recentRow}
                >
                  <ThemedText type="small" themeColor="textSecondary">
                    {session.gameName}
                  </ThemedText>
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

function StatCard({
  testID,
  label,
  value,
}: {
  testID: string;
  label: string;
  value: string;
}) {
  return (
    <ThemedView type="surface" style={styles.statCard} testID={testID}>
      <ThemedText type="headline" themeColor="accent">
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
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
  workoutList: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
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
  statCard: {
    flex: 1,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: Spacing.half,
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
  },
});
