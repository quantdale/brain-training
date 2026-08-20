/**
 * Rewards — cosmetics hub (engagement-cosmetics wave).
 *
 * A standalone Expo Router route (no central navigation change needed): the
 * Profile links here. Surfaces the expanded cosmetic registry with an
 * earn/unlock/equip model:
 * - defaults are always owned;
 * - achievement/quest/streak-milestone cosmetics unlock when their condition
 *   is met (ownership is DERIVED, never stored, so it can't desync);
 * - purchase cosmetics are bought with normal earned currency only — never
 *   real money, never pay-to-win — through the idempotent economy.
 *
 * Equipping is free and persists to profile settings. Reward moments emit a
 * non-blocking celebration.
 */
import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import {
  COSMETIC_DEFINITIONS,
  COSMETIC_SLOTS,
  equipCosmeticPersisted,
  isCosmeticOwned,
  purchaseCosmetic,
  resolveEquipped,
  type CosmeticDef,
  type CosmeticProgression,
  type CosmeticSlot,
} from '@/cosmetics';
import { celebrateReward, RewardCelebrationHost } from '@/rewards/celebration';
import {
  reconstructStreak,
  readCoveredDates,
} from '@/streaks';
import {
  currentPeriodKey,
  QUEST_DEFINITIONS_V1,
  selectActiveQuests,
} from '@/quests';
import { localDateString } from '@/workout/today';

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  avatarFrame: 'Avatar Frames',
  accent: 'Accents',
  celebration: 'Celebrations',
};

interface RewardsData {
  balance: number;
  profileSettings: Record<string, unknown>;
  cosmeticProgression: CosmeticProgression;
  equippedIds: Partial<Record<CosmeticSlot, string>>;
}

const EMPTY_REWARDS: RewardsData = {
  balance: 0,
  profileSettings: {},
  cosmeticProgression: {
    claimedAchievements: new Set(),
    claimedQuests: new Set(),
    longestStreak: 0,
  },
  equippedIds: {},
};

async function loadRewards(db: AppDatabase, now = new Date()): Promise<RewardsData> {
  const [balance, profile, unlockRows, questProgressAll, sessions] = await Promise.all([
    db.ledger.getBalance(),
    db.profile.get(),
    db.achievements.listUnlocks(),
    Promise.all(
      selectActiveQuests(QUEST_DEFINITIONS_V1, now).map((def) =>
        db.quests.listProgressForPeriod(currentPeriodKey(def.kind, now)),
      ),
    ),
    db.sessions.listRecent(5000),
  ]);

  const profileSettings = profile?.settings ?? {};

  const claimedAchievements = new Set<string>();
  for (const row of unlockRows) {
    if (row.claimedAt != null) {
      claimedAchievements.add(row.achievementId);
    }
  }
  const claimedQuests = new Set<string>();
  for (const rows of questProgressAll) {
    for (const row of rows) {
      if (row.claimedAt != null) {
        claimedQuests.add(row.questId);
      }
    }
  }

  const today = localDateString(now);
  const activityDates = sessions.map((s) => localDateString(new Date(s.completedAt)));
  const longestStreak = reconstructStreak(
    activityDates,
    today,
    readCoveredDates(profileSettings),
  ).longest;

  const cosmeticProgression: CosmeticProgression = {
    claimedAchievements,
    claimedQuests,
    longestStreak,
  };

  const equipped = resolveEquipped(COSMETIC_DEFINITIONS, profileSettings, cosmeticProgression);
  const equippedIds: Partial<Record<CosmeticSlot, string>> = {};
  for (const slot of COSMETIC_SLOTS) {
    if (equipped[slot]) {
      equippedIds[slot] = equipped[slot]!.id;
    }
  }

  return { balance, profileSettings, cosmeticProgression, equippedIds };
}

function unlockHint(def: CosmeticDef): string {
  switch (def.unlock.type) {
    case 'default':
      return 'Default';
    case 'purchase':
      return `Buy for ${def.price ?? 0} coins`;
    case 'achievement':
      return `Win achievement ${def.unlock.achievementId}`;
    case 'quest':
      return `Complete quest ${def.unlock.questId}`;
    case 'streakMilestone':
      return `Reach a ${def.unlock.days}-day streak`;
  }
}

export default function RewardsScreen() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data } = useDbData(loadRewards, [refreshKey], EMPTY_REWARDS);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const onBuy = async (def: CosmeticDef) => {
    try {
      const result = await purchaseCosmetic(getDb(), def, data.cosmeticProgression);
      if (result === 'purchased') {
        refresh();
        celebrateReward({
          title: `Unlocked ${def.name}`,
          cosmeticName: def.name,
          coins: -(def.price ?? 0),
          emoji: def.preview.emoji ?? '✨',
        });
      } else if (result === 'insufficient') {
        celebrateReward({ title: 'Not enough coins', emoji: '⚠️' });
      } else if (result === 'already-owned') {
        celebrateReward({ title: 'Already owned', emoji: def.preview.emoji ?? '✨' });
      }
    } catch (error) {
      console.error('[rewards] purchase failed', error);
    }
  };

  const onEquip = async (def: CosmeticDef) => {
    try {
      const ok = await equipCosmeticPersisted(getDb(), def, data.cosmeticProgression);
      if (ok) {
        refresh();
        celebrateReward({ title: `Equipped ${def.name}`, emoji: def.preview.emoji ?? '🎽' });
      }
    } catch (error) {
      console.error('[rewards] equip failed', error);
    }
  };

  return (
    <ScreenShell>
      <ThemedText type="title" testID="rewards-title">
        Rewards
      </ThemedText>
      <ThemedView type="surface" style={styles.balanceCard} testID="rewards-balance">
        <ThemedText type="smallBold" themeColor="accent">
          {data.balance} coins
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Earn coins from play, quests and achievements. Spend only on safe cosmetics.
        </ThemedText>
      </ThemedView>

      {COSMETIC_SLOTS.map((slot) => {
        const defs = COSMETIC_DEFINITIONS.filter((d) => d.slot === slot);
        return (
          <ThemedView key={slot} type="surface" style={styles.card} testID={`rewards-slot-${slot}`}>
            <ThemedText type="subtitle">{SLOT_LABELS[slot]}</ThemedText>
            {defs.map((def) => {
              const owned = isCosmeticOwned(def, data.cosmeticProgression, data.profileSettings);
              const equipped = data.equippedIds[slot] === def.id;
              return (
                <View key={def.id} style={styles.itemRow}>
                  <View style={styles.itemText}>
                    <ThemedText type="smallBold">
                      {def.preview.emoji ? `${def.preview.emoji} ` : ''}
                      {def.name}
                      {equipped ? '  (equipped)' : ''}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {def.description} · {unlockHint(def)}
                    </ThemedText>
                  </View>
                  <View style={styles.itemActions}>
                    {owned && !equipped && (
                      <Pressable
                        testID={`cosmetic-equip-${def.id}`}
                        accessibilityRole="button"
                        onPress={() => onEquip(def)}>
                        <ThemedView type="accentSoft" style={styles.pill}>
                          <ThemedText type="smallBold" themeColor="accent">
                            Equip
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    )}
                    {!owned && def.unlock.type === 'purchase' && (
                      <Pressable
                        testID={`cosmetic-buy-${def.id}`}
                        accessibilityRole="button"
                        disabled={data.balance < (def.price ?? 0)}
                        onPress={() => onBuy(def)}>
                        <ThemedView type="accentSoft" style={styles.pill}>
                          <ThemedText type="smallBold" themeColor="accent">
                            {def.price ?? 0} coins
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </ThemedView>
        );
      })}

      <Link href="/profile" asChild>
        <Pressable testID="rewards-done">
          <ThemedView type="accentSoft" style={styles.donePill}>
            <ThemedText type="smallBold" themeColor="accent">
              Done
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>

      <RewardCelebrationHost />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
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
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  donePill: {
    alignSelf: 'center',
    borderRadius: Radii.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    marginTop: Spacing.two,
  },
});
