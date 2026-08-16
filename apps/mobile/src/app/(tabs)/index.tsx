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

import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase, DomainRating } from '@/db';
import { getDb } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { levelForXp } from '@/rating';
import { getAllGameDefinitions } from '@/registry/registry';
import { effectiveCurrent, reconstructStreak } from '@/streaks';
import { localDateString } from '@/workout/today';
import { personalizedWorkout } from '@/workout/personalize';
import { canAffordReroll, MAX_REROLLS_PER_DAY, rerollCost } from '@/workout/reroll';

interface HomeData {
  domainRatings: DomainRating[];
  recentGameIds: string[];
  /** Local YYYY-MM-DD of each recent session (for streak reconstruction). */
  activityDates: string[];
  balance: number;
  totalXp: number;
}

const EMPTY_HOME: HomeData = {
  domainRatings: [],
  recentGameIds: [],
  activityDates: [],
  balance: 0,
  totalXp: 0,
};

async function loadHome(db: AppDatabase): Promise<HomeData> {
  const [domainRatings, recent, balance, sessionXp, awardsXp] = await Promise.all([
    db.ratings.getRatings(),
    db.sessions.listRecent(30),
    db.ledger.getBalance(),
    db.sessions.getTotalXp(),
    db.xpAwards.getTotalAwardedXp(),
  ]);
  return {
    domainRatings,
    recentGameIds: recent.map((session) => session.gameId),
    activityDates: recent.map((session) => localDateString(new Date(session.completedAt))),
    balance,
    totalXp: sessionXp + awardsXp,
  };
}

export default function HomeScreen() {
  const games = getAllGameDefinitions();
  const today = localDateString();
  const [rerollAttempt, setRerollAttempt] = useState(0);
  const { data, loaded } = useDbData(loadHome, [rerollAttempt], EMPTY_HOME);

  const workout = personalizedWorkout(
    games,
    today,
    data.domainRatings,
    data.recentGameIds,
    rerollAttempt,
  );
  const nextRerollCost = rerollCost(rerollAttempt);
  const rerollAffordable = canAffordReroll(data.balance, rerollAttempt);
  const rerollUsed = rerollAttempt >= 1;
  const rerollExhausted = rerollAttempt >= MAX_REROLLS_PER_DAY;

  const streak = reconstructStreak(data.activityDates, today);
  const currentStreak = effectiveCurrent(streak, today);
  const level = levelForXp(data.totalXp);

  const onReroll = async () => {
    if (!rerollAffordable || rerollExhausted) {
      return;
    }
    try {
      // First reroll per day is free; later rerolls debit the coin ledger
      // (constitution §14 economics).
      if (nextRerollCost > 0) {
        await getDb().ledger.append({ amount: -nextRerollCost, reason: 'workout-reroll' });
      }
      setRerollAttempt((attempt) => attempt + 1);
    } catch (error) {
      // Persistence unavailable: surface nothing and stay put rather than
      // granting a paid reroll that was never debited.
      console.error('[home] reroll failed', error);
    }
  };

  const rerollLabel = rerollExhausted
    ? 'No rerolls left'
    : nextRerollCost === 0
      ? 'Reroll workout (free)'
      : rerollAffordable
        ? `Reroll workout (${nextRerollCost} coins)`
        : `Need ${nextRerollCost} coins`;

  return (
    <ScreenShell>
      <ThemedText type="caption" themeColor="accent" testID="home-brand">
        BRAIN TRAINING
      </ThemedText>
      <ThemedText type="title" testID="home-title">
        Home
      </ThemedText>

      {/* Today's Workout CTA slot (constitution §13: primary CTA). */}
      <ThemedView type="surface" style={styles.ctaCard} testID="home-workout-cta">
        <ThemedText type="subtitle">Today's Workout</ThemedText>
        {workout.length > 0 ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Your daily {workout.length}-game training plan, balanced toward
              your weakest domains. Play any game to earn XP and train your
              ratings.
            </ThemedText>
            <View style={styles.workoutList} testID="home-workout-list">
              {workout.map((game, index) => (
                <Link key={game.id} href={`/game/${game.id}`} asChild>
                  <Pressable
                    testID={`home-workout-game-${game.id}`}
                    accessibilityRole="button"
                    style={styles.workoutRow}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {index + 1}.
                    </ThemedText>
                    <ThemedText type="small">{game.name}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {game.primaryCategory}
                    </ThemedText>
                  </Pressable>
                </Link>
              ))}
            </View>
            <Pressable
              testID="home-workout-reroll"
              accessibilityRole="button"
              disabled={!rerollAffordable || rerollExhausted}
              onPress={onReroll}>
              <ThemedView
                type={rerollExhausted || !rerollAffordable ? 'surface' : 'accentSoft'}
                style={styles.ctaPill}>
                <ThemedText type="smallBold" themeColor="accent">
                  {rerollLabel}
                </ThemedText>
              </ThemedView>
            </Pressable>
            {rerollUsed && !rerollExhausted && (
              <ThemedText type="caption" themeColor="textSecondary" testID="home-reroll-hint">
                {rerollAffordable
                  ? `${MAX_REROLLS_PER_DAY - rerollAttempt} reroll${MAX_REROLLS_PER_DAY - rerollAttempt === 1 ? '' : 's'} left today`
                  : 'Not enough coins for another reroll'}
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
        <StatCard testID="home-stat-streak" label="Streak" value={`${currentStreak} days`} />
        <StatCard testID="home-stat-xp" label="XP" value={`${data.totalXp}`} />
        <StatCard testID="home-stat-level" label="Level" value={`${level}`} />
      </View>
      {loaded && streak.atRisk && (
        <ThemedText type="caption" themeColor="warning" testID="home-streak-at-risk">
          Play today to keep your streak alive.
        </ThemedText>
      )}

      {/* Recent games slot — empty until sessions are persisted. */}
      <ThemedView type="surface" style={styles.recentCard} testID="home-recent-games">
        <ThemedText type="subtitle">Recent games</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your latest sessions will show up here after your first workout.
        </ThemedText>
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
    alignSelf: 'flex-start',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statsRow: {
    flexDirection: 'row',
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
});
