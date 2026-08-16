/**
 * Home — dashboard (Wave 1 shell + WP-2H Today's Workout).
 *
 * Static slots per PROJECT_CONSTITUTION §13, in first-viewport order:
 * Today's Workout CTA, streak/XP/level stats, recent games. The workout is a
 * deterministic daily 4-game selection (src/workout/today.ts) with one free
 * reroll; streak/XP stats stay placeholders until Phase 3. Slot testIDs are
 * the stable QA contract.
 */

import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { getAllGameDefinitions } from '@/registry/registry';
import { dailyWorkout, localDateString } from '@/workout/today';

export default function HomeScreen() {
  const games = getAllGameDefinitions();
  const [rerollAttempt, setRerollAttempt] = useState(0);
  const workout = dailyWorkout(games, localDateString(), rerollAttempt);
  const rerollUsed = rerollAttempt >= 1;

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
              Your daily {workout.length}-game training plan. Play any game to
              earn XP and train your ratings.
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
              disabled={rerollUsed}
              onPress={() => setRerollAttempt(rerollAttempt + 1)}>
              <ThemedView type={rerollUsed ? 'surface' : 'accentSoft'} style={styles.ctaPill}>
                <ThemedText type="smallBold" themeColor="accent">
                  {rerollUsed ? 'Reroll used' : 'Reroll workout (free)'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Your daily 4-game training plan will appear here once games are
            registered.
          </ThemedText>
        )}
      </ThemedView>

      {/* Streak / XP / level slot — static placeholder values. */}
      <View style={styles.statsRow}>
        <StatCard testID="home-stat-streak" label="Streak" value="0 days" />
        <StatCard testID="home-stat-xp" label="XP" value="0" />
        <StatCard testID="home-stat-level" label="Level" value="1" />
      </View>

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
