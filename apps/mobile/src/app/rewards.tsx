/** Rewards separates earned claims, owned cosmetics and locked collection
 * goals while retaining the transactional claim/purchase/equip handlers. */
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from "react-native";

import { MIN_TOUCH_TARGET } from "@/components/a11y";
import { ScreenShell } from "@/components/screen-shell";
import { StateCard } from "@/components/shell";
import { formatGoalProgress } from "@/components/shell/format";
import { ThemedText } from "@/components/themed-text";
import { CollectibleTile, type CollectibleState } from "@/components/rewards/collectible-tile";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  AppIcon,
  Badge,
  Button,
  Card,
  EmptyState,
  Entrance,
  HAIRLINE,
  ProgressBar,
  ReportRow,
  showToast,
  Tappable,
} from "@/components/ui";
import type { AppDatabase } from "@/db";
import { getDb } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { useContentMaxWidth, useScreenGutter } from "@/platform/layout";
import { ACHIEVEMENT_DEFINITIONS_V1 } from "@/achievements";
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
import { refreshProgression } from "@/progression";
import {
  progressionFocusSyncDue,
  progressionInputFingerprint,
  readNewestProgressionInput,
  runProgressionSync,
} from "@/progression/focus-sync";
import {
  loadRewardHistory,
  type RewardHistoryEntry,
} from "@/rewards/history";
import { celebrateReward, RewardCelebrationHost } from "@/rewards/celebration";
import { reconstructStreak, readCoveredDates } from "@/streaks";
import { QUEST_DEFINITIONS_V1 } from "@/quests";
import { localDateString } from "@/workout/today";

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  avatarFrame: "Avatar frames",
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
  // Sync first so a quest completed by the latest persisted session appears as
  // claimable without visiting Profile (the inbox reads persisted progress).
  // Finding 1: the focus-time sync is throttled by the shared input-aware
  // gate; a newly completed session changes the fingerprint and forces an
  // immediate sync. Best-effort: if the refresh pass itself fails, the inbox
  // still reads the persisted rows and the screen's own load-error surface
  // covers primary read failures.
  const newest = await readNewestProgressionInput(db, now.getTime());
  const fingerprint = progressionInputFingerprint(newest);
  if (progressionFocusSyncDue(now.getTime(), fingerprint)) {
    try {
      await runProgressionSync((syncNow) => refreshProgression(db, syncNow), now, fingerprint);
    } catch (error) {
      console.error('[rewards] progression refresh failed', error);
    }
  }

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
  const unlock = def.unlock;
  switch (unlock.type) {
    case "default":
      return "Included";
    case "purchase":
      return `Buy for ${def.price ?? 0} coins`;
    case "achievement":
      return "Claim " + (ACHIEVEMENT_DEFINITIONS_V1.find((achievement) =>
        achievement.id === unlock.achievementId)?.title ?? "the required achievement");
    case "quest":
      return "Claim " + (QUEST_DEFINITIONS_V1.find((quest) =>
        quest.id === unlock.questId)?.title ?? "the required quest");
    case "streakMilestone":
      return `Reach a ${unlock.days}-day streak`;
  }
}

/** Stable testID fragment for an inbox item (keys contain `:`/period text). */
function inboxTestId(item: RewardInboxItem): string {
  return item.key.replace(/[^a-zA-Z0-9]+/g, "-");
}

/** How long a purchase stays armed (awaiting its confirming second tap). */
const PURCHASE_CONFIRM_MS = 4000;

/** Handle for the purchase-arm expiry timer owned by this screen. */
type PurchaseArmTimer = ReturnType<typeof setTimeout>;

export default function RewardsScreen() {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const availableWidth = useContentMaxWidth() - 2 * useScreenGutter();
  const rowCollection = width < 360 || fontScale >= 1.5;
  const columns = rowCollection ? 1 : Math.max(1, Math.min(4,
    Math.floor((availableWidth + Spacing.two) / (164 + Spacing.two))));
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'owned' | 'locked'>('all');
  const [showAllClaims, setShowAllClaims] = useState(false);
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
      // Campaign 028: a failed purchase used to be console-only. The spend is
      // transactional, so a rejection means no coins moved — say so.
      showToast({
        title: "Couldn't purchase that",
        detail: "Nothing was changed — try again.",
        tone: "danger",
      });
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
      } else {
        // Campaign 028 sweep: `false` means the item stopped being owned
        // between render and tap. The silent no-op read as a dead button, so
        // surface the honest state instead (equipping never touches currency).
        showToast({
          title: "Couldn't equip that",
          detail: "This item is no longer owned — try again.",
          tone: "danger",
        });
      }
    } catch (error) {
      console.error("[rewards] equip failed", error);
      // Campaign 028: a failed equip used to be console-only. The settings
      // write is transactional, so nothing was changed on rejection.
      showToast({
        title: "Couldn't equip that",
        detail: "Nothing was changed — try again.",
        tone: "danger",
      });
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
      // Campaign 027: the failure used to be console-only. The item stays
      // claimable and the toast tells the player nothing was lost.
      showToast({
        title: "Couldn't claim that reward",
        detail: "Nothing was changed — try again.",
        tone: "danger",
      });
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
      // Campaign 027: surface the failure; already-durable claims resync on
      // the next focus, and the toast confirms nothing was silently lost.
      showToast({
        title: "Couldn't claim rewards",
        detail: "Nothing was lost — try again.",
        tone: "danger",
      });
      refresh();
    } finally {
      busyRef.current = false;
    }
  };

  const collection = collectionProgress(
    COSMETIC_DEFINITIONS,
    data.cosmeticProgression,
    data.profileSettings,
  );
  const hasInbox = data.inbox.length > 0;

  // Equipped set identity for the quiet hero state (names only; the collection
  // grid below owns the objects).
  const equippedNames = COSMETIC_SLOTS.map((slot) => {
    const id = data.equippedIds[slot];
    const name = id ? COSMETIC_DEFINITIONS.find((def) => def.id === id)?.name : undefined;
    const label = slot === 'avatarFrame' ? 'Frame' : slot === 'accent' ? 'Color' : 'Effect';
    return name ? `${label}: ${name}` : undefined;
  }).filter((name): name is string => name !== undefined);

  // Use rows for enlarged text and narrow viewports. Otherwise, derive grid
  // columns from the actual shell width with a readable minimum cell size.
  const cellWidth: ViewStyle = {
    width: columns === 1 ? '100%' : Math.floor((availableWidth - (columns - 1) * Spacing.two) / columns),
  };
  const visibleCosmetics = COSMETIC_DEFINITIONS.filter((definition) => {
    const owned = isCosmeticOwned(definition, data.cosmeticProgression, data.profileSettings);
    return collectionFilter === 'all' || (collectionFilter === 'owned' ? owned : !owned);
  });

  const shownInbox = showAllClaims ? data.inbox : data.inbox.slice(0, 1);

  return (
    <ScreenShell>
      <Entrance index={0}>
        <View style={styles.headerRow}>
          <Tappable testID="rewards-back" onPress={() => router.replace("/(tabs)/profile")}
            accessibilityLabel="Back to profile" style={styles.backButton}
            pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
            <AppIcon name="back" tone="text" />
          </Tappable>
          <View style={styles.flexText}>
            <ThemedText type="title" testID="rewards-title">Rewards</ThemedText>
            <ThemedText type="bodySmall" themeColor="textSecondary">Earn it. Collect it. Make it yours.</ThemedText>
          </View>
        </View>
      </Entrance>

      {!loaded ? (
        <StateCard variant="loading" title="Loading…" message="Fetching your rewards." testID="rewards-loading" />
      ) : error ? (
        <StateCard variant="error" title="Couldn't load rewards"
          message="Your rewards data is unavailable right now." testID="rewards-error"
          action={{ label: "Try again", onPress: refresh }} />
      ) : (
        <>
          <Card padding="md" testID="rewards-hero" style={styles.summary}>
            <View style={[styles.summaryRow, rowCollection && styles.stack]}>
              <View style={styles.summaryText}>
                <AppIcon name="coins" tone="currencyText" />
                <View style={styles.flexText}>
                  <ThemedText type="bodyLarge" themeColor="currencyText" testID="rewards-balance">
                    {data.balance + " coins"}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">Earned through play</ThemedText>
                </View>
              </View>
              {hasInbox ? (
                <View style={styles.claimSummary}>
                  <ThemedText type="bodyLarge" themeColor="warningText">
                    {data.inbox.length + (data.inbox.length === 1 ? " reward ready to claim" : " rewards ready to claim")}
                  </ThemedText>
                  {data.inbox.length > 1 ? (
                    <Button label={"Claim all " + data.inbox.length} size="md" variant="primary"
                      fullWidth={rowCollection} testID="rewards-claim-all"
                      accessibilityLabel={"Claim all " + data.inbox.length + " available rewards"}
                      onPress={() => void onClaimAll()} />
                  ) : null}
                </View>
              ) : (
                <ThemedText type="bodySmall" themeColor="textSecondary">No rewards waiting</ThemedText>
              )}
            </View>
            {equippedNames.length > 0 ? (
              <ThemedText type="caption" themeColor="textSecondary">{"Equipped · " + equippedNames.join(" · ")}</ThemedText>
            ) : null}
          </Card>

          <Section title="Ready to claim" testID="rewards-inbox">
            {data.inbox.length === 0 ? (
              <EmptyState icon={<AppIcon name="target" size={22} />} title="All caught up"
                message="Play, complete quests and keep your streak alive." testID="rewards-inbox-empty" />
            ) : shownInbox.map((item, index) => (
              <View key={item.key}
                style={[styles.itemRow, rowCollection && styles.stack,
                  index < shownInbox.length - 1 ? { borderBottomWidth: HAIRLINE, borderBottomColor: theme.border } : null]}
                testID={"rewards-item-" + inboxTestId(item)}>
                <View style={styles.itemHeading}>
                  <View style={[styles.itemIcon, { backgroundColor: theme.successSoft }]}>
                    <AppIcon name={item.kind === "milestone" ? "streak" : "award"} tone="successText" />
                  </View>
                  <View style={styles.flexText}>
                    <ThemedText type="bodyLarge">{item.title}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">{item.description}</ThemedText>
                    <View style={styles.rewardPills}>
                      <Badge tone="xp" label={"+" + item.rewardXp + " XP"} size="sm" />
                      <Badge tone="currency" label={"+" + item.rewardCurrency + " coins"} size="sm" />
                    </View>
                  </View>
                </View>
                <Button label="Claim" size="sm" variant={data.inbox.length > 1 ? 'secondary' : 'primary'} fullWidth={rowCollection}
                  testID={"reward-claim-" + inboxTestId(item)}
                  accessibilityLabel={"Claim " + item.title}
                  onPress={() => void onClaim(item)} />
              </View>
            ))}
            {data.inbox.length > 1 ? (
              <Button label={showAllClaims ? "Show fewer rewards" : "Show all " + data.inbox.length + " rewards"}
                variant="ghost" size="sm" fullWidth={false} testID="rewards-inbox-toggle"
                accessibilityLabel={showAllClaims ? "Show fewer claimable rewards" : "Show all claimable rewards"}
                onPress={() => setShowAllClaims((shown) => !shown)} />
            ) : null}
          </Section>

          <View style={styles.section} testID="rewards-collection">
            <View style={styles.collectionHeading}>
              <AppIcon name="layers" tone="accent" />
              <ThemedText type="subtitle" accessibilityRole="header">Your collection</ThemedText>
            </View>
            <ThemedText type="bodySmall" themeColor="textSecondary" testID="rewards-collection-intro">
              The starter set is included. Earn more through play or use earned coins for new looks.
            </ThemedText>
            <View style={styles.collectionProgress}>
              <ThemedText type="caption" themeColor="textSecondary" testID="rewards-collection-total">
                {formatGoalProgress(collection.ownedTotal, collection.total) + " owned"}
              </ThemedText>
              <ProgressBar value={collection.total > 0 ? collection.ownedTotal / collection.total : 0}
                accessibilityLabel={"Collection, " + formatGoalProgress(collection.ownedTotal, collection.total) + " owned"} />
            </View>
            <View style={styles.collectionFilters}>
              {(["all", "owned", "locked"] as const).map((filter) => {
                const selected = collectionFilter === filter;
                const label = filter === "all" ? "All items" : filter === "owned" ? "Owned" : "Locked";
                return (
                  <Tappable key={filter} testID={"rewards-filter-" + filter}
                    accessibilityLabel={label + " cosmetics"} accessibilityState={{ selected }}
                    onPress={() => {
                      if (collectionFilter !== filter) {
                        disarmBuy();
                        setCollectionFilter(filter);
                      }
                    }}
                    style={[styles.collectionFilter, { backgroundColor: selected ? theme.accent : theme.surface,
                      borderColor: selected ? theme.accent : theme.border }]}
                    pressedStyle={{ opacity: 0.8 }}>
                    <ThemedText type="label" themeColor={selected ? "accentOn" : "text"}>{label}</ThemedText>
                  </Tappable>
                );
              })}
            </View>
          </View>

          {visibleCosmetics.length === 0 ? (
            <EmptyState icon={<AppIcon name="layers" size={22} />}
              title={collectionFilter === "locked" ? "Collection complete" : "No items in this view"}
              message={collectionFilter === "locked" ? "You own every item in this collection." : "Choose All items to browse the collection."}
              testID="rewards-collection-empty" />
          ) : COSMETIC_SLOTS.map((slot) => {
            const allDefs = COSMETIC_DEFINITIONS.filter((definition) => definition.slot === slot);
            const defs = visibleCosmetics.filter((definition) => definition.slot === slot);
            if (defs.length === 0) return null;
            const ownedCount = allDefs.filter((definition) =>
              isCosmeticOwned(definition, data.cosmeticProgression, data.profileSettings)).length;
            const readout = formatGoalProgress(ownedCount, allDefs.length);
            return (
              <Section key={slot} title={SLOT_LABELS[slot]} testID={"rewards-slot-" + slot}>
                <View testID={"rewards-collection-slot-" + slot}>
                  <ProgressBar value={allDefs.length > 0 ? ownedCount / allDefs.length : 0}
                    valueLabel={readout + " owned"} tone="success"
                    accessibilityLabel={SLOT_LABELS[slot] + ", " + readout + " owned"} />
                </View>
                <View style={styles.tileGrid} testID={"rewards-grid-" + slot}>
                  {defs.map((def) => {
                    const owned = isCosmeticOwned(def, data.cosmeticProgression, data.profileSettings);
                    const equipped = data.equippedIds[slot] === def.id;
                    const earned = owned && def.unlock.type !== "default" && def.unlock.type !== "purchase";
                    const armed = armedBuyId === def.id;
                    const state: CollectibleState = equipped ? "equipped" : owned ? "owned" : "locked";
                    const detail = owned ? def.unlock.type === "default" ? "Included" : earned ? "Earned" : "Owned" : unlockHint(def);
                    return (
                      <View key={def.id} testID={"rewards-cosmetic-" + def.id}
                        accessibilityLabel={def.name + ". " + (equipped ? "Equipped" : owned ? earned ? "Earned and owned" : "Owned" : "Locked. " + unlockHint(def))}
                        style={[styles.tileCell, cellWidth]}>
                        <View style={styles.tileWrap}>
                          <CollectibleTile name={def.name} slot={slot} preview={def.preview} state={state}
                            detail={detail} layout={rowCollection ? "row" : "grid"} identityKey={def.id} />
                        </View>
                        <View style={styles.tileAction}>
                          {owned && !equipped ? (
                            <Button label="Equip" size="sm" variant="secondary" fullWidth={rowCollection}
                              testID={"cosmetic-equip-" + def.id} accessibilityLabel={"Equip " + def.name}
                              onPress={() => void onEquip(def)} />
                          ) : null}
                          {!owned && def.unlock.type === "purchase" ? (
                            <Button label={armed ? "Confirm" : (def.price ?? 0) + " coins"} size="sm"
                              variant={armed ? "danger" : "secondary"} fullWidth={rowCollection}
                              testID={"cosmetic-buy-" + def.id}
                              accessibilityLabel={armed ? "Confirm purchase of " + def.name + " for " + (def.price ?? 0) + " coins"
                                : "Buy " + def.name + " for " + (def.price ?? 0) + " coins"}
                              accessibilityHint={armed ? "Confirmation armed. Tap again to spend coins."
                                : "Requires a confirming second tap. Spends earned coins."}
                              disabled={data.balance < (def.price ?? 0)} onPress={() => onBuyPress(def)} />
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Section>
            );
          })}

          <Section title="Recent rewards" testID="rewards-history">
            {data.history.length === 0 ? (
              <EmptyState icon={<AppIcon name="time" size={20} />} title="No rewards yet"
                message="Complete a session to earn your first XP and coins." testID="rewards-history-empty" />
            ) : data.history.map((entry, index) => {
              const xpEntry = (entry.xp ?? 0) !== 0;
              const negativeCoins = (entry.coins ?? 0) < 0;
              const tone = xpEntry ? "xpText" : negativeCoins ? "dangerText" : "currencyText";
              return (
                <ReportRow key={entry.id} label={entry.label}
                  hint={entry.detail ? formatHistoryDate(entry.at) + " · " + entry.detail : formatHistoryDate(entry.at)}
                  icon={<AppIcon name={xpEntry ? "star" : "coins"} size={18} tone={tone} />}
                  trailing={<ThemedText type="bodyLarge" themeColor={tone}>{formatHistoryAmount(entry)}</ThemedText>}
                  testID={"rewards-history-" + entry.id.replace(/[^a-zA-Z0-9]+/g, "-")}
                  divider={index < data.history.length - 1} />
              );
            })}
          </Section>
          <Button label="Done" size="md" variant="ghost" fullWidth={false} testID="rewards-done"
            accessibilityLabel="Back to profile" onPress={() => router.replace("/(tabs)/profile")}
            style={styles.doneButton} />
        </>
      )}
      <View testID="rewards-celebration-host"><RewardCelebrationHost /></View>
    </ScreenShell>
  );
}

function Section({ title, testID, children }: { title: string; testID: string; children: ReactNode }) {
  return (
    <View style={styles.section} testID={testID}>
      <ThemedText type="subtitle" accessibilityRole="header">{title}</ThemedText>
      {children}
    </View>
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
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  backButton: { width: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  flexText: { flex: 1, minWidth: 0, gap: Spacing.half },
  summary: { gap: Spacing.two },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  summaryText: { flexDirection: "row", alignItems: "center", gap: Spacing.one, flex: 1 },
  claimSummary: { flex: 1, gap: Spacing.one },
  stack: { flexDirection: "column", alignItems: "stretch" },
  section: { gap: Spacing.two },
  itemRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two, minHeight: MIN_TOUCH_TARGET, paddingVertical: Spacing.two },
  itemHeading: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.oneHalf, flex: 1 },
  itemIcon: { width: 36, height: 36, borderRadius: Radii.medium, alignItems: "center", justifyContent: "center" },
  rewardPills: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.one },
  collectionHeading: { flexDirection: "row", alignItems: "center", gap: Spacing.oneHalf },
  collectionProgress: { gap: Spacing.one },
  collectionFilters: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.one },
  collectionFilter: { minHeight: MIN_TOUCH_TARGET, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one,
    borderRadius: Radii.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  tileCell: { gap: Spacing.one },
  // The tile's flex resolves width in this row; its native content owns height.
  tileWrap: { flexDirection: "row" },
  tileAction: { gap: Spacing.one },
  doneButton: { alignSelf: "center" },
});
