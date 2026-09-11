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
 * Reward moments emit a non-blocking celebration plus a kit toast; nothing
 * here blocks play.
 *
 * Presentation (campaign 024, design-language v2): the claimable inbox leads
 * with a claimable-count hero; cosmetic equip/purchase actions carry
 * unambiguous labels; history rows are `ListRow`s with signed, metric-hued
 * amounts.
 */
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { StateCard } from "@/components/shell";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import {
  Badge,
  Button,
  Card,
  ListRow,
  ProgressBar,
  showToast,
  StatBlock,
} from "@/components/ui";
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

/** History testIDs sanitize the entry id inline (ids contain `:`). */

/** How long a purchase stays armed (awaiting its confirming second tap). */
const PURCHASE_CONFIRM_MS = 4000;

/** Handle for the purchase-arm expiry timer owned by this screen. */
type PurchaseArmTimer = ReturnType<typeof setTimeout>;

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
  const armTimerRef = useRef<PurchaseArmTimer | null>(null);
  const disarmBuy = useCallback(() => {
    clearTimeout(armTimerRef.current ?? undefined);
    armTimerRef.current = null;
    setArmedBuyId(null);
  }, []);
  useEffect(() => disarmBuy, [disarmBuy]);

  const onBuyPress = (def: CosmeticDef) => {
    if (armedBuyId !== def.id) {
      clearTimeout(armTimerRef.current ?? undefined);
      armTimerRef.current = null;
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
        showToast({ title: `Unlocked ${def.name}`, tone: "success" });
      } else if (result === "insufficient") {
        celebrateReward({ title: "Not enough coins", emoji: "⚠️" });
        showToast({ title: "Not enough coins", tone: "warning" });
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
        showToast({ title: `Equipped ${def.name}`, tone: "success" });
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
        showToast({ title: `Claimed ${item.title}`, tone: "success" });
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
        showToast({
          title: `Claimed ${result.claimedCount} reward${
            result.claimedCount === 1 ? "" : "s"
          }`,
          tone: "success",
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
      {/* Claimable-count hero: the inbox count is the screen's metric. */}
      <Card variant="hero" tone="currencySoft" testID="rewards-hero">
        <View style={styles.heroRow}>
          <StatBlock
            label="Ready to claim"
            value={`${data.inbox.length}`}
            metric="currency"
            valueType="numeralXl"
          />
          <View style={styles.heroAction}>
            {data.inbox.length > 1 ? (
              <Button
                label={`Claim all ${data.inbox.length}`}
                size="md"
                variant="primary"
                fullWidth={false}
                testID="rewards-claim-all"
                accessibilityLabel={`Claim all ${data.inbox.length} available rewards`}
                onPress={() => void onClaimAll()}
              />
            ) : null}
          </View>
        </View>
        <ThemedText
          type="caption"
          themeColor="textSecondary"
          testID="rewards-balance"
        >
          {data.balance} coins · Earn coins from play, quests and
          achievements. Spend only on safe cosmetics.
        </ThemedText>
      </Card>

      {/* Claimable inbox: achievements + quests + milestones, one tap each or all at once. */}
      <Card testID="rewards-inbox">
        <ThemedText type="headline">Ready to claim</ThemedText>
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
            <View
              key={item.key}
              style={styles.itemRow}
              testID={`rewards-item-${inboxTestId(item)}`}
            >
              <View style={styles.itemText}>
                <ThemedText type="body">{item.title}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {item.description} · +{item.rewardXp} XP / +
                  {item.rewardCurrency} coins
                </ThemedText>
              </View>
              <Button
                label="Claim"
                size="sm"
                variant="primary"
                fullWidth={false}
                testID={`reward-claim-${inboxTestId(item)}`}
                accessibilityLabel={`Claim ${item.title} reward`}
                onPress={() => void onClaim(item)}
              />
            </View>
          ))
        )}
      </Card>

      {/* Collection progress across the cosmetic catalog. */}
      <Card testID="rewards-collection">
        <ThemedText type="headline">Collection</ThemedText>
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
            <ProgressBar
              value={slot.ratio}
              label={SLOT_LABELS[slot.slot]}
              valueLabel={`${slot.owned}/${slot.total}`}
            />
          </View>
        ))}
      </Card>

      {COSMETIC_SLOTS.map((slot) => {
        const defs = COSMETIC_DEFINITIONS.filter((d) => d.slot === slot);
        return (
          <Card key={slot} testID={`rewards-slot-${slot}`}>
            <ThemedText type="headline">{SLOT_LABELS[slot]}</ThemedText>
            {defs.map((def) => {
              const owned = isCosmeticOwned(
                def,
                data.cosmeticProgression,
                data.profileSettings,
              );
              const equipped = data.equippedIds[slot] === def.id;
              const armed = armedBuyId === def.id;
              return (
                <View
                  key={def.id}
                  style={styles.itemRow}
                  testID={`rewards-cosmetic-${def.id}`}
                >
                  <View style={styles.itemText}>
                    <ThemedText type="body">
                      {def.preview.emoji ? `${def.preview.emoji} ` : ""}
                      {def.name}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {def.description} · {unlockHint(def)}
                    </ThemedText>
                    {equipped ? (
                      <Badge tone="success" label="✓ Equipped" size="sm" />
                    ) : owned ? (
                      <Badge tone="accent" label="Owned" size="sm" />
                    ) : null}
                  </View>
                  <View style={styles.itemActions}>
                    {owned && !equipped && (
                      <Button
                        label={`Equip ${def.name}`}
                        size="sm"
                        variant="secondary"
                        fullWidth={false}
                        testID={`cosmetic-equip-${def.id}`}
                        accessibilityLabel={`Equip ${def.name}`}
                        onPress={() => onEquip(def)}
                      />
                    )}
                    {!owned && def.unlock.type === "purchase" && (
                      <Button
                        label={
                          armed
                            ? `Confirm buy · ${def.price ?? 0} coins`
                            : `Buy · ${def.price ?? 0} coins`
                        }
                        size="sm"
                        variant={armed ? "danger" : "secondary"}
                        fullWidth={false}
                        testID={`cosmetic-buy-${def.id}`}
                        accessibilityLabel={
                          armed
                            ? `Confirm purchase of ${def.name} for ${def.price ?? 0} coins`
                            : `Buy ${def.name} for ${def.price ?? 0} coins`
                        }
                        accessibilityHint={
                          armed
                            ? "Confirmation armed. Tap again to spend coins."
                            : "Requires a confirming second tap. Spends earned coins."
                        }
                        disabled={data.balance < (def.price ?? 0)}
                        onPress={() => onBuyPress(def)}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
        );
      })}

      {/* Recent rewards: unified xp_awards + ledger feed (newest first). */}
      <Card testID="rewards-history">
        <ThemedText type="headline">Recent rewards</ThemedText>
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
            <View
              key={entry.id}
              style={styles.historyRow}
              testID={`rewards-history-${entry.id.replace(/[^a-zA-Z0-9]+/g, "-")}`}
            >
              <View style={styles.itemText}>
                <ListRow
                  title={entry.label}
                  subtitle={
                    entry.detail
                      ? `${formatHistoryDate(entry.at)} · ${entry.detail}`
                      : formatHistoryDate(entry.at)
                  }
                />
              </View>
              <ThemedText
                type="numeral"
                themeColor={
                  (entry.xp ?? 0) !== 0
                    ? "xp"
                    : (entry.coins ?? 0) < 0
                      ? "danger"
                      : "currency"
                }
              >
                {formatHistoryAmount(entry)}
              </ThemedText>
            </View>
          ))
        )}
      </Card>

      <Button
        label="Done"
        size="md"
        variant="ghost"
        fullWidth={false}
        testID="rewards-done"
        accessibilityLabel="Back to profile"
        onPress={() => router.push("/(tabs)/profile")}
        style={styles.doneButton}
      />
        </>
      )}

      <View testID="rewards-celebration-host">
        <RewardCelebrationHost />
      </View>
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
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  heroAction: {
    alignItems: "flex-end",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
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
  doneButton: {
    alignSelf: "center",
  },
});
