/**
 * Rewards — the collection surface (campaign 055).
 *
 * Campaign 052: the mechanics were real but the presentation read as
 * inventory. The refinement lock (§2.8) turns the cosmetic registry into a
 * collection: code-native `CollectibleTile` objects in one grid per slot,
 * with the exact same ownership/unlock/economy semantics as before. The claim
 * band is the hero only while rewards are actually waiting; collection
 * progress is a quiet per-slot rail plus one "n/12" caption, never the hero.
 *
 * All claim/purchase/equip flows, idempotency, the two-tap purchase confirm,
 * the toast and the celebration host are untouched.
 */
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { StateCard } from "@/components/shell";
import { ThemedText } from "@/components/themed-text";
import { CollectibleTile, type CollectibleState } from "@/components/rewards/collectible-tile";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  ArcadePanel,
  Badge,
  Button,
  EmptyState,
  Entrance,
  HAIRLINE,
  ProgressBar,
  Report,
  ReportRow,
  showToast,
  Spark,
} from "@/components/ui";
import type { AppDatabase } from "@/db";
import { getDb } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { useIsWideWidth } from "@/platform/layout";
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

/** Handle for the purchase-arm expiry timer owned by this screen. */
type PurchaseArmTimer = ReturnType<typeof setTimeout>;

export default function RewardsScreen() {
  const theme = useTheme();
  const wide = useIsWideWidth();
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
    return id ? COSMETIC_DEFINITIONS.find((def) => def.id === id)?.name : undefined;
  }).filter((name): name is string => name !== undefined);

  // Grid columns: 3 on phone/compact, 4 once the content width supports it
  // (lock §2.8 asks for a dense set, not a two-column badge gallery). A fixed
  // basis with a max width keeps a short final row at cell size instead of
  // stretching one collectible across the whole grid (campaign 055 visual QA).
  const cellWidth: ViewStyle = {
    flexBasis: wide ? '22%' : '30%',
    maxWidth: wide ? '23.5%' : '31.5%',
  };

  return (
    <ScreenShell>
      <Entrance index={0}>
        <View style={styles.headerText}>
          <ThemedText type="eyebrow" themeColor="textMuted">
            CLAIM &amp; COLLECT
          </ThemedText>
          <ThemedText type="title" testID="rewards-title">
            Rewards
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Claim what you earned, then grow your collection.
          </ThemedText>
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
          {/* The screen's one focal object: the claim band while rewards are
              ready, otherwise the collection identity. */}
          <Entrance index={1}>
            <ArcadePanel
              emphasis="focal"
              tone={hasInbox ? "warningSoft" : null}
              testID="rewards-hero"
            >
              {hasInbox ? (
                <View style={styles.heroRow}>
                  <View style={styles.heroText}>
                    <ThemedText type="numeralXl" themeColor="warningSoftText">
                      {data.inbox.length}
                    </ThemedText>
                    <ThemedText type="label" themeColor="warningSoftText">
                      {data.inbox.length === 1
                        ? "reward ready to claim"
                        : "rewards ready to claim"}
                    </ThemedText>
                  </View>
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
              ) : (
                <View style={styles.heroText}>
                  <ThemedText type="eyebrow" themeColor="textSecondary">
                    COLLECTION
                  </ThemedText>
                  <ThemedText type="gameTitle">Your collection</ThemedText>
                  <ThemedText type="bodySmall" themeColor="textSecondary">
                    {equippedNames.length > 0
                      ? `Equipped: ${equippedNames.join(" · ")}`
                      : "The starter set is included."}
                  </ThemedText>
                </View>
              )}
              <ThemedText
                type="caption"
                themeColor={hasInbox ? "warningSoftText" : "textSecondary"}
                testID="rewards-balance"
              >
                {data.balance} coins · Earn coins from play, quests and
                achievements. Spend only on safe cosmetics.
              </ThemedText>
            </ArcadePanel>
          </Entrance>

          {/* Claim inbox: reward rows with an object chip, the requirement and
              one Claim key each; Claim all lives in the hero band. */}
          <Entrance index={2}>
            <Report title="Rewards to claim" testID="rewards-inbox">
              {data.inbox.length === 0 ? (
                <EmptyState
                  icon={<Spark size={22} color={theme.textMuted} />}
                  title="All caught up"
                  message="Play, complete quests and keep your streak alive."
                  testID="rewards-inbox-empty"
                />
              ) : (
                data.inbox.map((item, index) => (
                  <View
                    key={item.key}
                    style={[
                      styles.itemRow,
                      index < data.inbox.length - 1
                        ? { borderBottomWidth: HAIRLINE, borderBottomColor: theme.border }
                        : null,
                    ]}
                    testID={`rewards-item-${inboxTestId(item)}`}
                  >
                    <View
                      style={[
                        styles.itemIcon,
                        { backgroundColor: theme.surfaceSunken },
                      ]}
                    >
                      <ThemedText
                        type="headline"
                        allowFontScaling={false}
                        aria-hidden
                      >
                        {item.kind === "milestone" ? "🔥" : "🏆"}
                      </ThemedText>
                    </View>
                    <View style={styles.itemText}>
                      <ThemedText type="bodySmall">{item.title}</ThemedText>
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
            </Report>
          </Entrance>

          {/* Collection progress: quiet rails plus one "n/12" caption — the
              grid below is the content, never this. */}
          <Entrance index={3}>
            <Report
              title="Collection"
              testID="rewards-collection"
              action={
                <ThemedText
                  type="caption"
                  themeColor="textMuted"
                  testID="rewards-collection-total"
                >
                  {`${collection.ownedTotal}/${collection.total}`}
                </ThemedText>
              }
            >
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                testID="rewards-collection-intro"
                style={styles.collectionIntro}
              >
                The starter set is included. Earn more through play or spend
                earned coins on safe cosmetics.
              </ThemedText>
              {collection.slots.map((slot, index) => (
                <View
                  key={slot.slot}
                  style={[
                    styles.collectionRow,
                    { borderBottomColor: theme.border },
                    index < collection.slots.length - 1
                      ? { borderBottomWidth: HAIRLINE }
                      : null,
                  ]}
                  testID={`rewards-collection-slot-${slot.slot}`}
                >
                  <ProgressBar
                    value={slot.ratio}
                    tone="success"
                    label={SLOT_LABELS[slot.slot]}
                    valueLabel={`${slot.owned}/${slot.total}`}
                  />
                </View>
              ))}
            </Report>
          </Entrance>

          {/* The collection itself: one grid per slot, owned/equipped/locked
              tiles sharing the same set. Economy semantics are unchanged. */}
          {COSMETIC_SLOTS.map((slot, slotIndex) => {
            const defs = COSMETIC_DEFINITIONS.filter((d) => d.slot === slot);
            const ownedCount = defs.filter((d) =>
              isCosmeticOwned(d, data.cosmeticProgression, data.profileSettings),
            ).length;
            return (
              <Entrance key={slot} index={4 + slotIndex}>
                <Report
                  title={SLOT_LABELS[slot]}
                  testID={`rewards-slot-${slot}`}
                  action={
                    <ThemedText type="caption" themeColor="textMuted">
                      {`${ownedCount}/${defs.length}`}
                    </ThemedText>
                  }
                >
                  <View style={styles.tileGrid}>
                    {defs.map((def) => {
                      const owned = isCosmeticOwned(
                        def,
                        data.cosmeticProgression,
                        data.profileSettings,
                      );
                      const equipped = data.equippedIds[slot] === def.id;
                      const armed = armedBuyId === def.id;
                      const state: CollectibleState = equipped
                        ? "equipped"
                        : owned
                          ? "owned"
                          : "locked";
                      return (
                        <View
                          key={def.id}
                          testID={`rewards-cosmetic-${def.id}`}
                          accessibilityLabel={`${def.name}. ${
                            equipped ? "Equipped" : owned ? "Owned" : `Locked. ${unlockHint(def)}`
                          }`}
                          style={[styles.tileCell, cellWidth]}
                        >
                          <View style={styles.tileWrap}>
                            <CollectibleTile
                              name={def.name}
                              slot={slot}
                              preview={def.preview}
                              state={state}
                              detail={
                                equipped
                                  ? undefined
                                  : owned
                                    ? "Owned"
                                    : unlockHint(def)
                              }
                            />
                          </View>
                          <View style={styles.tileAction}>
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
                </Report>
              </Entrance>
            );
          })}

          {/* Recent rewards: unified xp_awards + ledger feed (newest first). */}
          <Entrance index={7}>
            <Report title="Recent rewards" testID="rewards-history">
              {data.history.length === 0 ? (
                <EmptyState
                  icon={<Spark size={20} color={theme.textMuted} />}
                  title="No rewards yet"
                  message="Complete a session to earn your first XP and coins."
                  testID="rewards-history-empty"
                />
              ) : (
                data.history.map((entry, index) => {
                  const xpEntry = (entry.xp ?? 0) !== 0;
                  const negativeCoins = (entry.coins ?? 0) < 0;
                  return (
                    <ReportRow
                      key={entry.id}
                      label={entry.label}
                      hint={
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
                      trailing={
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
                      }
                      testID={`rewards-history-${entry.id.replace(/[^a-zA-Z0-9]+/g, "-")}`}
                      divider={index < data.history.length - 1}
                    />
                  );
                })
              )}
            </Report>
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
  headerText: {
    gap: Spacing.half,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  heroText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    minHeight: 44,
    paddingVertical: Spacing.two,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    flex: 1,
    gap: Spacing.half,
  },
  rewardPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  collectionIntro: {
    paddingVertical: Spacing.two,
  },
  collectionRow: {
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  tileCell: {
    gap: Spacing.one,
  },
  // Row wrapper so the tile's `flex: 1` resolves its width inside the cell
  // while its height still comes from the square plate + plinth content.
  tileWrap: {
    flexDirection: "row",
  },
  tileAction: {
    minHeight: 44,
    justifyContent: "center",
  },
  doneButton: {
    alignSelf: "center",
  },
});
