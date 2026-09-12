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
 * Presentation (campaign 026, design-language v3 "Neon Arcade"): the
 * claimable inbox leads with a success-tinted hero (count + Claim all); the
 * inbox is the action treatment, collection meters are the in-progress
 * treatment and earn-only badges stay desaturated; the cosmetic registry is a
 * 2-column badge gallery with identity marks; history rows carry metric hues.
 */
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { SectionHeader, StateCard } from "@/components/shell";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing, type ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Entrance,
  HAIRLINE,
  ListRow,
  ProgressBar,
  showToast,
  Spark,
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

/** Identity fill per cosmetic slot, so collection meters keep one hue language. */
const SLOT_TONES: Record<CosmeticSlot, ThemeColor> = {
  avatarFrame: "accent",
  accent: "xp",
  celebration: "success",
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
  const theme = useTheme();
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
      <Entrance index={0}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <ThemedText type="eyebrow" themeColor="accentText">
              CLAIM &amp; COLLECT
            </ThemedText>
            <ThemedText type="title" testID="rewards-title">
              Rewards
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Claim what you earned, then grow your collection.
            </ThemedText>
          </View>
          <Spark size={30} color={theme.currency} />
        </View>
      </Entrance>

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
          {/* Claimable hero: the ready-to-claim count is the metric and Claim
              all is the screen's single primary action. */}
          <Entrance index={1}>
            <Card
              variant="hero"
              tone={data.inbox.length > 0 ? "successSoft" : null}
              testID="rewards-hero"
            >
              <View style={styles.heroRow}>
                <StatBlock
                  label="Ready to claim"
                  value={`${data.inbox.length}`}
                  valueType="numeralXl"
                  tone={data.inbox.length > 0 ? "successSoftText" : "text"}
                />
                {data.inbox.length > 0 ? (
                  <Spark size={40} color={theme.success} />
                ) : null}
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
          </Entrance>

          {/* Claimable inbox: the action treatment — one tap each or all. */}
          <Entrance index={2}>
            <Card
              testID="rewards-inbox"
              tone={data.inbox.length > 0 ? "successSoft" : null}
            >
              <SectionHeader title="Ready to claim" />
              {data.inbox.length === 0 ? (
                <EmptyState
                  icon={<Spark size={22} color={theme.textMuted} />}
                  title="All caught up"
                  message="Play, complete quests and keep your streak alive."
                  testID="rewards-inbox-empty"
                />
              ) : (
                data.inbox.map((item) => (
                  <View
                    key={item.key}
                    style={styles.itemRow}
                    testID={`rewards-item-${inboxTestId(item)}`}
                  >
                    <View
                      style={[
                        styles.itemIcon,
                        { backgroundColor: theme.surface },
                      ]}
                    >
                      <ThemedText type="headline" allowFontScaling={false}>
                        {item.kind === "milestone" ? "🔥" : "🏆"}
                      </ThemedText>
                    </View>
                    <View style={styles.itemText}>
                      <ThemedText type="body">{item.title}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {item.description}
                      </ThemedText>
                      <View style={styles.rewardPills}>
                        <Badge
                          tone="xp"
                          label={`+${item.rewardXp} XP`}
                          size="sm"
                        />
                        <Badge
                          tone="currency"
                          label={`+${item.rewardCurrency} coins`}
                          size="sm"
                        />
                      </View>
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
          </Entrance>

          {/* Collection progress — the in-progress treatment: meters, never a
              claim action, so it reads differently at a glance. */}
          <Entrance index={3}>
            <Card testID="rewards-collection">
              <SectionHeader
                title="Collection"
                caption={`${collection.ownedTotal}/${collection.total} cosmetics collected (${Math.round(collection.ratio * 100)}%)`}
              />
              {collection.slots.map((slot) => (
                <View
                  key={slot.slot}
                  style={styles.collectionRow}
                  testID={`rewards-collection-slot-${slot.slot}`}
                >
                  <ProgressBar
                    value={slot.ratio}
                    tone={SLOT_TONES[slot.slot]}
                    label={SLOT_LABELS[slot.slot]}
                    valueLabel={`${slot.owned}/${slot.total}`}
                  />
                </View>
              ))}
            </Card>
          </Entrance>

          {/* Badge gallery: a 2-column grid. Equipped/owned badges stay
              full-colour, purchasable badges carry the coin action, and
              earn-only locked badges stay desaturated with their unlock hint. */}
          {COSMETIC_SLOTS.map((slot, slotIndex) => {
            const defs = COSMETIC_DEFINITIONS.filter((d) => d.slot === slot);
            const ownedCount = defs.filter((d) =>
              isCosmeticOwned(d, data.cosmeticProgression, data.profileSettings),
            ).length;
            return (
              <Entrance key={slot} index={4 + slotIndex}>
                <Card testID={`rewards-slot-${slot}`}>
                  <SectionHeader
                    title={SLOT_LABELS[slot]}
                    caption={`${ownedCount}/${defs.length} collected`}
                  />
                  <View style={styles.badgeGrid}>
                    {defs.map((def) => {
                      const owned = isCosmeticOwned(
                        def,
                        data.cosmeticProgression,
                        data.profileSettings,
                      );
                      const equipped = data.equippedIds[slot] === def.id;
                      const armed = armedBuyId === def.id;
                      const state = equipped
                        ? "Equipped"
                        : owned
                          ? "Owned"
                          : `Locked. ${unlockHint(def)}`;
                      return (
                        <View
                          key={def.id}
                          testID={`rewards-cosmetic-${def.id}`}
                          accessibilityLabel={`${def.name}. ${state}`}
                          style={[
                            styles.badgeCard,
                            {
                              backgroundColor: owned
                                ? theme.surface
                                : theme.surfaceSunken,
                              borderColor: theme.border,
                            },
                            !owned ? styles.badgeLocked : null,
                          ]}
                        >
                          <View
                            style={[
                              styles.badgeMark,
                              {
                                backgroundColor: owned
                                  ? theme.accentSoft
                                  : theme.surface,
                              },
                            ]}
                          >
                            <ThemedText
                              type="headline"
                              allowFontScaling={false}
                            >
                              {def.preview.emoji ?? def.name.slice(0, 1)}
                            </ThemedText>
                          </View>
                          <ThemedText
                            type="bodySmall"
                            themeColor={owned ? "text" : "textMuted"}
                            numberOfLines={1}
                          >
                            {def.name}
                          </ThemedText>
                          {equipped ? (
                            <Badge
                              tone="success"
                              label="✓ Equipped"
                              size="sm"
                            />
                          ) : owned ? (
                            <Badge tone="accent" label="Owned" size="sm" />
                          ) : (
                            <ThemedText
                              type="caption"
                              themeColor="textMuted"
                              numberOfLines={2}
                            >
                              🔒 {unlockHint(def)}
                            </ThemedText>
                          )}
                          <View style={styles.badgeAction}>
                            {owned && !equipped ? (
                              <Button
                                label="Equip"
                                size="sm"
                                variant="secondary"
                                fullWidth={false}
                                testID={`cosmetic-equip-${def.id}`}
                                accessibilityLabel={`Equip ${def.name}`}
                                onPress={() => onEquip(def)}
                              />
                            ) : null}
                            {!owned && def.unlock.type === "purchase" ? (
                              <Button
                                label={
                                  armed ? "Confirm" : `${def.price ?? 0} coins`
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
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              </Entrance>
            );
          })}

          {/* Recent rewards: unified xp_awards + ledger feed (newest first). */}
          <Entrance index={7}>
            <Card testID="rewards-history">
              <SectionHeader title="Recent rewards" />
              {data.history.length === 0 ? (
                <EmptyState
                  icon={<Spark size={20} color={theme.xp} />}
                  title="No rewards yet"
                  message="Complete a session to earn your first XP and coins."
                  testID="rewards-history-empty"
                />
              ) : (
                data.history.map((entry) => {
                  const xpEntry = (entry.xp ?? 0) !== 0;
                  const negativeCoins = (entry.coins ?? 0) < 0;
                  return (
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
                          icon={
                            <Spark
                              size={14}
                              color={
                                xpEntry
                                  ? theme.xpText
                                  : negativeCoins
                                    ? theme.dangerText
                                    : theme.currencyText
                              }
                            />
                          }
                          tone={
                            xpEntry
                              ? "xpSoft"
                              : negativeCoins
                                ? "dangerSoft"
                                : "currencySoft"
                          }
                        />
                      </View>
                      <ThemedText
                        type="numeral"
                        themeColor={
                          xpEntry
                            ? "xp"
                            : negativeCoins
                              ? "danger"
                              : "currency"
                        }
                      >
                        {formatHistoryAmount(entry)}
                      </ThemedText>
                    </View>
                  );
                })
              )}
            </Card>
          </Entrance>

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
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  heroAction: {
    alignItems: "flex-end",
    flexShrink: 0,
    marginLeft: "auto",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.medium,
    alignItems: "center",
    justifyContent: "center",
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
  rewardPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  badgeCard: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: Radii.large,
    borderWidth: HAIRLINE,
    padding: Spacing.twoHalf,
    gap: Spacing.one,
    alignItems: "center",
  },
  // Locked badges are desaturated (not just dim text) so the state reads at a
  // glance; the border/background colours are passed inline from the theme.
  badgeLocked: {
    opacity: 0.55,
  },
  badgeMark: {
    width: 48,
    height: 48,
    borderRadius: Radii.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeAction: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionRow: {
    gap: Spacing.half,
  },
  doneButton: {
    alignSelf: "center",
  },
});
