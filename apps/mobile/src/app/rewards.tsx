/**
 * Rewards — engagement hub (engagement V2, campaign 010 / W12).
 *
 * One coherent surface over the whole engagement layer:
 * - balance card (append-only ledger derived);
 * - CLAIMABLE INBOX: unlocked achievements / completed quests / reached
 *   streak milestones with per-item claims and an idempotent Claim-all
 *   (each underlying claim is once-only, so retries can never double-grant);
 * - COLLECTION PROGRESS: owned/total cosmetic coverage per slot;
 * - the full cosmetic registry with earn/unlock/equip/buy (unchanged model:
 *   earned ownership is derived, purchases spend normal earned currency only);
 * - RECENT REWARDS: newest-first projection of xp_awards + currency ledger.
 *
 * Reward moments emit a non-blocking celebration; nothing here blocks play.
 */
import { Link } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { StateCard } from "@/components/shell";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";
import type { AppDatabase } from "@/db";
import { getDb } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import {
  COSMETIC_DEFINITIONS,
  COSMETIC_SLOTS,
  collectionProgress,
  equipCosmeticPersisted,
  isCosmeticOwned,
  purchaseCosmetic,
  resolveEquipped,
  type CosmeticDef,
  type CosmeticProgression,
  type CosmeticSlot,
} from "@/cosmetics";
import {
  claimAllRewards,
  claimReward,
  collectClaimableRewards,
  type RewardInboxItem,
} from "@/rewards/inbox";
import {
  loadRewardHistory,
  type RewardHistoryEntry,
} from "@/rewards/history";
import { celebrateReward, RewardCelebrationHost } from "@/rewards/celebration";
import { reconstructStreak, readCoveredDates } from "@/streaks";
import { QUEST_DEFINITIONS_V1 } from "@/quests";
import { localDateString } from "@/workout/today";

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  avatarFrame: "Avatar Frames",
  accent: "Accents",
  celebration: "Celebrations",
};

interface RewardsData {
  balance: number;
  profileSettings: Record<string, unknown>;
  cosmeticProgression: CosmeticProgression;
  equippedIds: Partial<Record<CosmeticSlot, string>>;
  inbox: RewardInboxItem[];
  history: RewardHistoryEntry[];
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
  inbox: [],
  history: [],
};

async function loadRewards(
  db: AppDatabase,
  now = new Date(),
): Promise<RewardsData> {
  const [balance, profile, unlockRows, questProgressAll, activityDates, inbox, history] =
    await Promise.all([
      db.ledger.getBalance(),
      db.profile.get(),
      db.achievements.listUnlocks(),
      Promise.all(
        QUEST_DEFINITIONS_V1.map((def) =>
          db.quests.listProgressForQuest(def.id),
        ),
      ),
      // Distinct dates are an unbounded, indexed projection. A capped session
      // sample made the displayed longest streak regress after long histories.
      db.sessions.getDistinctActivityDates(),
      collectClaimableRewards(db, now),
      loadRewardHistory(db, 8),
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

  const equipped = resolveEquipped(
    COSMETIC_DEFINITIONS,
    profileSettings,
    cosmeticProgression,
  );
  const equippedIds: Partial<Record<CosmeticSlot, string>> = {};
  for (const slot of COSMETIC_SLOTS) {
    if (equipped[slot]) {
      equippedIds[slot] = equipped[slot]!.id;
    }
  }

  return {
    balance,
    profileSettings,
    cosmeticProgression,
    equippedIds,
    inbox,
    history,
  };
}

function unlockHint(def: CosmeticDef): string {
  switch (def.unlock.type) {
    case "default":
      return "Default";
    case "purchase":
      return `Buy for ${def.price ?? 0} coins`;
    case "achievement":
      return `Win achievement ${def.unlock.achievementId}`;
    case "quest":
      return `Complete quest ${def.unlock.questId}`;
    case "streakMilestone":
      return `Reach a ${def.unlock.days}-day streak`;
  }
}

/** Stable testID fragment for an inbox item (keys contain `:`/period text). */
function inboxTestId(item: RewardInboxItem): string {
  return item.key.replace(/[^a-zA-Z0-9]+/g, "-");
}

/** How long a purchase stays armed (awaiting its confirming second tap). */
const PURCHASE_CONFIRM_MS = 4000;

export default function RewardsScreen() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loaded, error } = useDbData(loadRewards, [refreshKey], EMPTY_REWARDS);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  // In-flight guard: a double tap must not fire a second purchase/equip/claim
  // while the first is still running. The economy layer is idempotent
  // regardless; this keeps the UI from spamming duplicate celebrations.
  const busyRef = useRef(false);

  // Destructive-action safety: a purchase spends earned currency, so the
  // price pill requires a confirming second tap; the arm expires quickly so
  // a stray tap can never spend coins minutes later.
  const [armedBuyId, setArmedBuyId] = useState<string | null>(null);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disarmBuy = useCallback(() => {
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    setArmedBuyId(null);
  }, []);
  useEffect(() => disarmBuy, [disarmBuy]);

  const onBuyPress = (def: CosmeticDef) => {
    if (armedBuyId !== def.id) {
      if (armTimerRef.current) {
        clearTimeout(armTimerRef.current);
      }
      setArmedBuyId(def.id);
      armTimerRef.current = setTimeout(disarmBuy, PURCHASE_CONFIRM_MS);
      return;
    }
    disarmBuy();
    void onBuy(def);
  };

  const onBuy = async (def: CosmeticDef) => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    try {
      const result = await purchaseCosmetic(
        getDb(),
        def,
        data.cosmeticProgression,
      );
      if (result === "purchased") {
        refresh();
        celebrateReward({
          title: `Unlocked ${def.name}`,
          cosmeticName: def.name,
          coins: -(def.price ?? 0),
          emoji: def.preview.emoji ?? "✨",
        });
      } else if (result === "insufficient") {
        celebrateReward({ title: "Not enough coins", emoji: "⚠️" });
      } else if (result === "already-owned") {
        celebrateReward({
          title: "Already owned",
          emoji: def.preview.emoji ?? "✨",
        });
      }
    } catch (error) {
      console.error("[rewards] purchase failed", error);
    } finally {
      busyRef.current = false;
    }
  };

  const onEquip = async (def: CosmeticDef) => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    try {
      const ok = await equipCosmeticPersisted(
        getDb(),
        def,
        data.cosmeticProgression,
      );
      if (ok) {
        refresh();
        celebrateReward({
          title: `Equipped ${def.name}`,
          emoji: def.preview.emoji ?? "🎽",
        });
      }
    } catch (error) {
      console.error("[rewards] equip failed", error);
    } finally {
      busyRef.current = false;
    }
  };

  const onClaim = async (item: RewardInboxItem) => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    try {
      const outcome = await claimReward(getDb(), item, new Date());
      if (outcome.status === "claimed") {
        refresh();
        celebrateReward({
          title: item.title,
          xp: outcome.xp,
          coins: outcome.coins,
          emoji: item.kind === "milestone" ? "🔥" : "🏆",
        });
      } else if (outcome.status === "unavailable") {
        // Stale inbox entry (e.g. the period rolled over) — drop it from view.
        refresh();
      }
    } catch (error) {
      console.error("[rewards] claim failed", error);
    } finally {
      busyRef.current = false;
    }
  };

  const onClaimAll = async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    try {
      const result = await claimAllRewards(getDb(), new Date());
      if (result.claimedCount > 0) {
        refresh();
        celebrateReward({
          title: `Claimed ${result.claimedCount} reward${
            result.claimedCount === 1 ? "" : "s"
          }`,
          xp: result.totalXp,
          coins: result.totalCoins,
          emoji: "🎁",
        });
      } else {
        // Nothing left (or everything was already claimed by a concurrent
        // pass) — resync so stale rows disappear.
        refresh();
      }
    } catch (error) {
      console.error("[rewards] claim-all failed", error);
    } finally {
      busyRef.current = false;
    }
  };

  const collection = collectionProgress(
    COSMETIC_DEFINITIONS,
    data.cosmeticProgression,
    data.profileSettings,
  );

  return (
    <ScreenShell>
      <ThemedText type="title" testID="rewards-title">
        Rewards
      </ThemedText>

      {!loaded ? (
        <StateCard
          variant="loading"
          title="Loading…"
          message="Fetching your rewards."
          testID="rewards-loading"
        />
      ) : error ? (
        <StateCard
          variant="error"
          title="Couldn't load rewards"
          message="Your rewards data is unavailable right now."
          testID="rewards-error"
          action={{ label: "Try again", onPress: refresh }}
        />
      ) : (
        <>
      <ThemedView
        type="surface"
        style={styles.balanceCard}
        testID="rewards-balance"
      >
        <ThemedText type="smallBold" themeColor="accent">
          {data.balance} coins
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Earn coins from play, quests and achievements. Spend only on safe
          cosmetics.
        </ThemedText>
      </ThemedView>

      {/* Claimable inbox: achievements + quests + milestones, one tap each or all at once. */}
      <ThemedView type="surface" style={styles.card} testID="rewards-inbox">
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle">Ready to claim</ThemedText>
          {data.inbox.length > 1 && (
            <Pressable
              testID="rewards-claim-all"
              accessibilityRole="button"
              accessibilityLabel="Claim all available rewards"
              onPress={() => void onClaimAll()}
            >
              <ThemedView type="accentSoft" style={styles.pill}>
                <ThemedText type="smallBold" themeColor="accent">
                  Claim all
                </ThemedText>
              </ThemedView>
            </Pressable>
          )}
        </View>
        {data.inbox.length === 0 ? (
          <ThemedText
            type="caption"
            themeColor="textSecondary"
            testID="rewards-inbox-empty"
          >
            You&apos;re all caught up — earn more rewards by playing, completing
            quests and keeping your streak alive.
          </ThemedText>
        ) : (
          data.inbox.map((item) => (
            <View key={item.key} style={styles.itemRow}>
              <View style={styles.itemText}>
                <ThemedText type="smallBold">{item.title}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {item.description} · +{item.rewardXp} XP / +
                  {item.rewardCurrency} coins
                </ThemedText>
              </View>
              <Pressable
                testID={`reward-claim-${inboxTestId(item)}`}
                accessibilityRole="button"
                accessibilityLabel={`Claim ${item.title} reward`}
                onPress={() => void onClaim(item)}
              >
                <ThemedView type="accentSoft" style={styles.pill}>
                  <ThemedText type="smallBold" themeColor="accent">
                    Claim
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </View>
          ))
        )}
      </ThemedView>

      {/* Collection progress across the cosmetic catalog. */}
      <ThemedView
        type="surface"
        style={styles.card}
        testID="rewards-collection"
      >
        <ThemedText type="subtitle">Collection</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {collection.ownedTotal}/{collection.total} cosmetics collected (
          {Math.round(collection.ratio * 100)}%)
        </ThemedText>
        {collection.slots.map((slot) => (
          <View
            key={slot.slot}
            style={styles.collectionRow}
            testID={`rewards-collection-slot-${slot.slot}`}
          >
            <ThemedText type="small">{SLOT_LABELS[slot.slot]}</ThemedText>
            <View style={styles.collectionMeta}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(slot.ratio * 100)}%` },
                  ]}
                />
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                {slot.owned}/{slot.total}
              </ThemedText>
            </View>
          </View>
        ))}
      </ThemedView>

      {COSMETIC_SLOTS.map((slot) => {
        const defs = COSMETIC_DEFINITIONS.filter((d) => d.slot === slot);
        return (
          <ThemedView
            key={slot}
            type="surface"
            style={styles.card}
            testID={`rewards-slot-${slot}`}
          >
            <ThemedText type="subtitle">{SLOT_LABELS[slot]}</ThemedText>
            {defs.map((def) => {
              const owned = isCosmeticOwned(
                def,
                data.cosmeticProgression,
                data.profileSettings,
              );
              const equipped = data.equippedIds[slot] === def.id;
              return (
                <View key={def.id} style={styles.itemRow}>
                  <View style={styles.itemText}>
                    <ThemedText type="smallBold">
                      {def.preview.emoji ? `${def.preview.emoji} ` : ""}
                      {def.name}
                      {equipped ? "  (equipped)" : ""}
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
                        accessibilityLabel={`Equip ${def.name}`}
                        onPress={() => onEquip(def)}
                      >
                        <ThemedView type="accentSoft" style={styles.pill}>
                          <ThemedText type="smallBold" themeColor="accent">
                            Equip
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    )}
                    {!owned && def.unlock.type === "purchase" && (
                      <Pressable
                        testID={`cosmetic-buy-${def.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={
                          armedBuyId === def.id
                            ? `Confirm purchase of ${def.name} for ${def.price ?? 0} coins`
                            : `Buy ${def.name} for ${def.price ?? 0} coins`
                        }
                        disabled={data.balance < (def.price ?? 0)}
                        onPress={() => onBuyPress(def)}
                      >
                        <ThemedView type="accentSoft" style={styles.pill}>
                          <ThemedText type="smallBold" themeColor="accent">
                            {armedBuyId === def.id
                              ? "Tap to confirm"
                              : `${def.price ?? 0} coins`}
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

      {/* Recent rewards: unified xp_awards + ledger feed (newest first). */}
      <ThemedView type="surface" style={styles.card} testID="rewards-history">
        <ThemedText type="subtitle">Recent rewards</ThemedText>
        {data.history.length === 0 ? (
          <ThemedText
            type="caption"
            themeColor="textSecondary"
            testID="rewards-history-empty"
          >
            No rewards yet — complete a session to earn your first XP and
            coins.
          </ThemedText>
        ) : (
          data.history.map((entry) => (
            <View key={entry.id} style={styles.itemRow}>
              <View style={styles.itemText}>
                <ThemedText type="smallBold">{entry.label}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatHistoryDate(entry.at)}
                  {entry.detail ? ` · ${entry.detail}` : ""}
                </ThemedText>
              </View>
              <ThemedText
                type="smallBold"
                themeColor={(entry.xp ?? 0) > 0 || (entry.coins ?? 0) >= 0 ? "accent" : "text"}
              >
                {formatHistoryAmount(entry)}
              </ThemedText>
            </View>
          ))
        )}
      </ThemedView>

      <Link href={"/(tabs)/profile" as any} asChild>
        <Pressable
          testID="rewards-done"
          accessibilityRole="button"
          accessibilityLabel="Back to profile"
        >
          <ThemedView type="accentSoft" style={styles.donePill}>
            <ThemedText type="smallBold" themeColor="accent">
              Done
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>
        </>
      )}

      <RewardCelebrationHost />
    </ScreenShell>
  );
}

/** Short local date for history rows (display only). */
function formatHistoryDate(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/** "+10 XP" / "+25 coins" / "-150 coins" summary for one history row. */
function formatHistoryAmount(entry: RewardHistoryEntry): string {
  if (entry.xp != null && entry.xp !== 0) {
    return `+${entry.xp} XP`;
  }
  if (entry.coins != null) {
    return `${entry.coins >= 0 ? "+" : ""}${entry.coins} coins`;
  }
  return "";
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  itemText: {
    flex: 1,
    gap: Spacing.half,
  },
  itemActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  collectionRow: {
    gap: Spacing.half,
  },
  collectionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(120,120,140,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: "#4F6BFF",
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  donePill: {
    alignSelf: "center",
    borderRadius: Radii.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    marginTop: Spacing.two,
  },
});
