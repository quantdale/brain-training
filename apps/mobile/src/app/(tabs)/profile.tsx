/**
 * Profile / More — identity, progression (streaks + quests + achievements),
 * theme selection and global settings toggles.
 *
 * Campaign 003 convergence: streaks reconstruct from session history with
 * Freeze/Shield/Recovery inventory purchasable for coins (constitution §18);
 * quests/achievements show live progress with once-only reward claiming;
 * the theme seam persists the selection into profile settings (applied by
 * the root layout, so it takes effect immediately). Sensory toggles stay in
 * the in-memory settings provider (persistence deferred). Everything
 * degrades gracefully when the db is unavailable.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { useSettings } from '@/components/settings/settings-provider';
import { SensorySettingsCard } from '@/components/sensory/sensory-settings-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase, QuestProgress } from '@/db';
import { getDb } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import {
  ACHIEVEMENT_DEFINITIONS_V1,
  claimAchievementReward,
  type AchievementDef,
} from '@/achievements';
import { syncAchievements, syncQuestProgress } from '@/progression';
import { getGameDefinition } from '@/registry/registry';
import {
  evaluateQuests,
  currentPeriodKey,
  applyQuestReward,
  QUEST_DEFINITIONS_V1,
  type QuestDefinition,
  type QuestEvaluation,
  type QuestSessionSample,
} from '@/quests';
import { effectiveCurrent, reconstructStreak } from '@/streaks';
import {
  ITEM_COSTS,
  canPurchase,
  type StreakItemKind,
} from '@/streaks';
import { grantItems, readInventory } from '@/streaks/inventory';
import type { StreakInventory } from '@/streaks/types';
import {
  THEME_OPTIONS,
  THEME_SETTINGS_KEY,
  type ThemeOption,
} from '@/theme/registry';
import { localDateString } from '@/workout/today';

const STREAK_ITEMS: { kind: StreakItemKind; label: string; caption: string }[] = [
  { kind: 'freeze', label: 'Freeze', caption: 'Protects your streak for one missed day' },
  { kind: 'shield', label: 'Shield', caption: 'Proactive streak protection' },
  { kind: 'recovery', label: 'Recovery', caption: 'Restores up to 3 lost streak days' },
];

interface ProfileData {
  balance: number;
  inventory: StreakInventory;
  profileSettings: Record<string, unknown>;
  questRows: Map<string, QuestProgress>;
  questEvals: QuestEvaluation[];
  unlocks: Map<string, { unlockedAt: number; claimedAt: number | null }>;
  currentStreak: number;
  longestStreak: number;
  atRisk: boolean;
}

const EMPTY_PROFILE: ProfileData = {
  balance: 0,
  inventory: { freeze: 0, shield: 0, recovery: 0 },
  profileSettings: {},
  questRows: new Map(),
  questEvals: [],
  unlocks: new Map(),
  currentStreak: 0,
  longestStreak: 0,
  atRisk: false,
};

async function loadProfile(db: AppDatabase, now = new Date()): Promise<ProfileData> {
  // Re-evaluate quests/achievements from persisted sessions first so the
  // screen reflects sessions completed since the last visit.
  await syncQuestProgress(db, now);
  await syncAchievements(db, now);

  const [balance, profile, achievements, unlockRows, progressRows] = await Promise.all([
    db.ledger.getBalance(),
    db.profile.get(),
    db.achievements.listDefinitions(),
    db.achievements.listUnlocks(),
    Promise.all(
      QUEST_DEFINITIONS_V1.map((def) =>
        db.quests.listProgressForPeriod(currentPeriodKey(def.kind, now)),
      ),
    ),
  ]);

  const profileSettings = profile?.settings ?? {};
  const inventory = readInventory(profileSettings);

  // Fresh evaluation for display: session snapshot → per-quest progress.
  const sessions = await db.sessions.listRecent(5000);
  const samples: QuestSessionSample[] = sessions.map((session) => ({
    completedAt: session.completedAt,
    gameId: session.gameId,
    domain: getGameDefinition(session.gameId)?.primaryCategory ?? 'Unknown',
    xp: session.xp,
  }));
  const questEvals = evaluateQuests(QUEST_DEFINITIONS_V1, { sessions: samples }, now);

  const questRows = new Map<string, QuestProgress>();
  for (const rows of progressRows) {
    for (const row of rows) {
      questRows.set(row.questId, row);
    }
  }

  const unlocks = new Map<string, { unlockedAt: number; claimedAt: number | null }>();
  for (const row of unlockRows) {
    unlocks.set(row.achievementId, { unlockedAt: row.unlockedAt, claimedAt: row.claimedAt });
  }

  const today = localDateString(now);
  const activityDates = sessions.map((session) => localDateString(new Date(session.completedAt)));
  const streak = reconstructStreak(activityDates, today);

  return {
    balance,
    inventory,
    profileSettings,
    questRows,
    questEvals,
    unlocks,
    currentStreak: effectiveCurrent(streak, today),
    longestStreak: streak.longest,
    atRisk: streak.atRisk,
  };
}

export default function ProfileScreen() {
  const { themeId, setThemeId } = useSettings();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data } = useDbData(loadProfile, [refreshKey], EMPTY_PROFILE);

  // Re-sync progression each time the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, []),
  );

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const onBuyStreakItem = async (kind: StreakItemKind) => {
    const cost = ITEM_COSTS[kind];
    if (!canPurchase(data.balance, kind, data.profileSettings, new Date())) {
      return;
    }
    try {
      const db = getDb();
      await db.ledger.append({ amount: -cost, reason: `streak-item-${kind}` });
      await db.profile.update({ settings: grantItems(data.profileSettings, { [kind]: 1 }) });
      refresh();
    } catch (error) {
      console.error('[profile] streak item purchase failed', error);
    }
  };

  const onClaimQuest = async (definition: QuestDefinition) => {
    try {
      await applyQuestReward(getDb(), definition, currentPeriodKey(definition.kind, new Date()));
      refresh();
    } catch (error) {
      console.error('[profile] quest claim failed', error);
    }
  };

  const onClaimAchievement = async (definition: AchievementDef) => {
    try {
      await claimAchievementReward(getDb(), definition);
      refresh();
    } catch (error) {
      console.error('[profile] achievement claim failed', error);
    }
  };

  const onSelectTheme = (option: ThemeOption) => {
    setThemeId(option.id);
    try {
      // Persist for next launch; the root layout resolves live changes via
      // the settings provider.
      void getDb()
        .profile.update({ settings: { [THEME_SETTINGS_KEY]: option.id } })
        .catch((error: unknown) => {
          console.error('[profile] theme persist failed', error);
        });
    } catch (error) {
      console.error('[profile] theme persist failed', error);
    }
  };

  return (
    <ScreenShell>
      <ThemedText type="title" testID="profile-title">
        Profile
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Identity, achievements and settings.
      </ThemedText>

      <ThemedView type="surface" style={styles.card} testID="profile-identity">
        <ThemedView type="accentSoft" style={styles.avatar}>
          <ThemedText type="headline" themeColor="accent">
            P
          </ThemedText>
        </ThemedView>
        <View style={styles.identityText}>
          <ThemedText type="bodyLarge">Local player</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Profile name and avatar customization arrive in a later wave.
          </ThemedText>
        </View>
      </ThemedView>

      {/* Streak + recovery inventory (constitution §18). */}
      <ThemedView type="surface" style={styles.card} testID="profile-streak">
        <ThemedText type="subtitle">Streak</ThemedText>
        <View style={styles.streakRow}>
          <Stat value={`${data.currentStreak}`} label="Current" />
          <Stat value={`${data.longestStreak}`} label="Longest" />
          <Stat
            value={`${data.inventory.freeze + data.inventory.shield + data.inventory.recovery}`}
            label="Items"
          />
        </View>
        {data.atRisk && (
          <ThemedText type="caption" themeColor="warning" testID="profile-streak-at-risk">
            Your streak is at risk — play today to keep it alive.
          </ThemedText>
        )}
        <View style={styles.itemList}>
          {STREAK_ITEMS.map((item) => (
            <View key={item.kind} style={styles.itemRow}>
              <View style={styles.itemText}>
                <ThemedText type="smallBold">
                  {item.label} × {data.inventory[item.kind]}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {item.caption}
                </ThemedText>
              </View>
              <Pressable
                testID={`streak-buy-${item.kind}`}
                accessibilityRole="button"
                disabled={!canPurchase(data.balance, item.kind, data.profileSettings, new Date())}
                onPress={() => onBuyStreakItem(item.kind)}>
                <ThemedView type="accentSoft" style={styles.buyPill}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {ITEM_COSTS[item.kind]} coins
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </View>
          ))}
        </View>
      </ThemedView>

      {/* Quests — live progress + once-only claims. */}
      <ThemedView type="surface" style={styles.card} testID="profile-quests">
        <ThemedText type="subtitle">Quests</ThemedText>
        {data.questEvals.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No quests yet.
          </ThemedText>
        ) : (
          data.questEvals.map((evaluation) => {
            const row = data.questRows.get(evaluation.questId);
            const claimed = row?.claimedAt != null;
            const completed = evaluation.completed || row?.completedAt != null;
            return (
              <View key={evaluation.questId} style={styles.questRow}>
                <View style={styles.itemText}>
                  <ThemedText type="smallBold">
                    {QUEST_DEFINITIONS_V1.find((d) => d.id === evaluation.questId)?.title ??
                      evaluation.questId}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {Math.min(evaluation.progress, evaluation.goal)}/{evaluation.goal} ·{' '}
                    {claimed
                      ? 'Claimed'
                      : completed
                        ? 'Complete — claim your reward'
                        : 'In progress'}
                  </ThemedText>
                </View>
                {completed && !claimed && (
                  <Pressable
                    testID={`quest-claim-${evaluation.questId}`}
                    accessibilityRole="button"
                    onPress={() =>
                      onClaimQuest(
                        QUEST_DEFINITIONS_V1.find((d) => d.id === evaluation.questId)!,
                      )
                    }>
                    <ThemedView type="accentSoft" style={styles.buyPill}>
                      <ThemedText type="smallBold" themeColor="accent">
                        Claim
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ThemedView>

      {/* Achievements — unlocks + once-only claims. */}
      <ThemedView type="surface" style={styles.card} testID="profile-achievements">
        <ThemedText type="subtitle">Achievements</ThemedText>
        {ACHIEVEMENT_DEFINITIONS_V1.map((definition) => {
          const unlock = data.unlocks.get(definition.id);
          const claimed = unlock?.claimedAt != null;
          const unlocked = unlock != null;
          return (
            <View key={definition.id} style={styles.questRow}>
              <View style={styles.itemText}>
                <ThemedText type="smallBold">{definition.title}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {definition.description} ·{' '}
                  {claimed ? 'Claimed' : unlocked ? 'Unlocked — claim' : 'Locked'}
                </ThemedText>
              </View>
              {unlocked && !claimed && (
                <Pressable
                  testID={`achievement-claim-${definition.id}`}
                  accessibilityRole="button"
                  onPress={() => onClaimAchievement(definition)}>
                  <ThemedView type="accentSoft" style={styles.buyPill}>
                    <ThemedText type="smallBold" themeColor="accent">
                      Claim
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              )}
            </View>
          );
        })}
      </ThemedView>

      {/* Theme selection (theme registry seam). */}
      <ThemedView type="surface" style={styles.card} testID="theme-card">
        <ThemedText type="subtitle">Theme</ThemedText>
        {THEME_OPTIONS.map((option) => {
          const selected = option.id === themeId;
          return (
            <Pressable
              key={option.id}
              testID={`theme-option-${option.id}`}
              accessibilityRole="button"
              onPress={() => onSelectTheme(option)}>
              <ThemedView type={selected ? 'accentSoft' : 'surface'} style={styles.themeRow}>
                <ThemedText type="smallBold" themeColor={selected ? 'accent' : 'text'}>
                  {option.label}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {selected ? 'Active' : option.mode}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </ThemedView>

      <SensorySettingsCard />
    </ScreenShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="headline" themeColor="accent">
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  streakRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
  },
  itemList: {
    gap: Spacing.two,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  itemText: {
    flex: 1,
    gap: Spacing.half,
  },
  buyPill: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  themeRow: {
    borderRadius: Radii.medium,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  settingText: {
    flex: 1,
    gap: Spacing.half,
  },
});
