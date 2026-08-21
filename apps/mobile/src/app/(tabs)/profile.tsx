/**
 * Profile / More — identity, progression (streaks + quests + achievements +
 * milestones), cosmetics, theme selection and global settings toggles.
 *
 * Engagement-cosmetics wave: streak item purchases now flow through the
 * idempotent economy (`purchaseStreakItem`); owned Freeze/Shield/Recovery can
 * be APPLIED (persisting covered dates); streak milestones show progress and
 * a one-time claim; cosmetics are surfaced (earn/unlock/equip) on the
 * dedicated `/rewards` route and summarized here. Reward claims/purchases
 * emit a non-blocking celebration. Everything degrades gracefully when the db
 * is unavailable.
 */
import { Link } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { MinTouchTarget } from "@/components/a11y";
import { ScreenShell } from "@/components/screen-shell";
import { useSettings } from "@/components/settings/settings-provider";
import { SensorySettingsCard } from "@/components/sensory/sensory-settings-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";
import type { AppDatabase, QuestProgress } from "@/db";
import { getDb, InsufficientFundsError, purchaseStreakItem } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import {
  ACHIEVEMENT_DEFINITIONS_V1,
  claimAchievementReward,
  evaluateAchievementProgress,
  type AchievementDef,
} from "@/achievements";
import {
  buildAchievementSnapshot,
  syncAchievements,
  syncQuestProgress,
} from "@/progression";
import { getGameDefinition } from "@/registry/registry";
import {
  evaluateQuests,
  currentPeriodKey,
  applyQuestReward,
  selectActiveQuests,
  QUEST_DEFINITIONS_V1,
  type QuestDefinition,
  type QuestEvaluation,
  type QuestSessionSample,
} from "@/quests";
import {
  canApplyFreeze,
  canApplyRecovery,
  canApplyShield,
  effectiveCurrent,
  ITEM_COSTS,
  canPurchase,
  milestoneProgress,
  reconstructStreak,
  readCoveredDates,
  type StreakInventory,
  type StreakItemKind,
  type StreakState,
  applyOwnedStreakItem,
  claimStreakMilestoneReward,
  type StreakMilestone,
} from "@/streaks";
import { readInventory } from "@/streaks/inventory";
import {
  COSMETIC_DEFINITIONS,
  resolveEquipped,
  type CosmeticProgression,
} from "@/cosmetics";
import { RewardCelebrationHost, celebrateReward } from "@/rewards/celebration";
import {
  THEME_OPTIONS,
  THEME_SETTINGS_KEY,
  type ThemeOption,
} from "@/theme/registry";
import { localDateString } from "@/workout/today";

const STREAK_ITEMS: { kind: StreakItemKind; label: string; caption: string }[] =
  [
    {
      kind: "freeze",
      label: "Freeze",
      caption: "Protects your streak for one missed day",
    },
    {
      kind: "shield",
      label: "Shield",
      caption: "Proactive streak protection (freeze or recovery)",
    },
    {
      kind: "recovery",
      label: "Recovery",
      caption: "Restores up to 3 lost streak days",
    },
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
  streakState: StreakState;
  milestoneRows: {
    milestone: StreakMilestone;
    reached: boolean;
    claimed: boolean;
  }[];
  cosmeticProgression: CosmeticProgression;
  achievementRatios: Map<string, number>;
  equippedFrameEmoji: string;
  equippedAccentName: string;
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
  streakState: {
    current: 0,
    longest: 0,
    lastActiveDate: null,
    atRisk: false,
    frozenDays: 0,
  },
  milestoneRows: [],
  cosmeticProgression: {
    claimedAchievements: new Set(),
    claimedQuests: new Set(),
    longestStreak: 0,
  },
  achievementRatios: new Map(),
  equippedFrameEmoji: "🟦",
  equippedAccentName: "Indigo",
};

async function loadProfile(
  db: AppDatabase,
  now = new Date(),
): Promise<ProfileData> {
  // Re-evaluate quests/achievements from persisted sessions first so the
  // screen reflects sessions completed since the last visit.
  await syncQuestProgress(db, now);
  await syncAchievements(db, now);

  const [balance, profile, achievements, unlockRows, progressRows] =
    await Promise.all([
      db.ledger.getBalance(),
      db.profile.get(),
      db.achievements.listDefinitions(),
      db.achievements.listUnlocks(),
      Promise.all(
        selectActiveQuests(QUEST_DEFINITIONS_V1, now).map((def) =>
          db.quests.listProgressForPeriod(currentPeriodKey(def.kind, now)),
        ),
      ),
    ]);

  const profileSettings = profile?.settings ?? {};
  const inventory = readInventory(profileSettings);

  // Lightweight projection only: quest evaluation needs (gameId, xp,
  // completedAt) — no JSON blobs. Full-row listRecent here was a per-focus
  // scalability hazard on large histories.
  const sessions = await db.sessions.listLightweight(5000);
  const samples: QuestSessionSample[] = sessions.map((session) => ({
    completedAt: session.completedAt,
    gameId: session.gameId,
    domain: getGameDefinition(session.gameId)?.primaryCategory ?? "Unknown",
    xp: session.xp,
  }));
  const questEvals = evaluateQuests(
    selectActiveQuests(QUEST_DEFINITIONS_V1, now),
    { sessions: samples },
    now,
  );

  const questRows = new Map<string, QuestProgress>();
  for (const rows of progressRows) {
    for (const row of rows) {
      questRows.set(row.questId, row);
    }
  }

  const unlocks = new Map<
    string,
    { unlockedAt: number; claimedAt: number | null }
  >();
  for (const row of unlockRows) {
    unlocks.set(row.achievementId, {
      unlockedAt: row.unlockedAt,
      claimedAt: row.claimedAt,
    });
  }

  const today = localDateString(now);
  // Distinct LOCAL activity days straight from SQL (uncapped; the repository
  // uses the 'localtime' modifier matching localDateString semantics).
  // reconstructStreak dedupes internally, so distinct input is equivalent.
  const activityDates = await db.sessions.getDistinctActivityDates();
  const coveredDates = readCoveredDates(profileSettings);
  const streakState = reconstructStreak(activityDates, today, coveredDates);
  const longestStreak = streakState.longest;

  const claimedMilestones = new Set<string>(
    Array.isArray(
      (profileSettings.streaks as Record<string, unknown> | undefined)
        ?.claimedMilestones,
    )
      ? (
          (profileSettings.streaks as Record<string, unknown>)
            .claimedMilestones as unknown[]
        ).filter((v): v is string => typeof v === "string")
      : [],
  );

  const claimedAchievements = new Set<string>();
  for (const [id, value] of unlocks) {
    if (value.claimedAt != null) {
      claimedAchievements.add(id);
    }
  }
  const claimedQuests = new Set<string>();
  for (const row of questRows.values()) {
    if (row.claimedAt != null) {
      claimedQuests.add(row.questId);
    }
  }
  const cosmeticProgression: CosmeticProgression = {
    claimedAchievements,
    claimedQuests,
    longestStreak,
  };

  // Achievement progress bars: reuse the authoritative aggregation snapshot
  // (uncapped SQL counts) instead of deriving ratios from the capped 5000-row
  // session list — the two paths previously diverged on large histories.
  const achievementSnapshot = await buildAchievementSnapshot(db, now);
  const achievementRatios = new Map<string, number>(
    ACHIEVEMENT_DEFINITIONS_V1.map((definition) => [
      definition.id,
      evaluateAchievementProgress(definition, achievementSnapshot).ratio,
    ]),
  );

  const equipped = resolveEquipped(
    COSMETIC_DEFINITIONS,
    profileSettings,
    cosmeticProgression,
  );

  return {
    balance,
    inventory,
    profileSettings,
    questRows,
    questEvals,
    unlocks,
    currentStreak: effectiveCurrent(streakState, today),
    longestStreak,
    atRisk: streakState.atRisk,
    streakState,
    milestoneRows: milestoneProgress(streakState).map((m) => ({
      milestone: m.milestone,
      reached: m.reached,
      claimed: claimedMilestones.has(m.milestone.id),
    })),
    cosmeticProgression,
    achievementRatios,
    equippedFrameEmoji: equipped.avatarFrame?.preview.emoji ?? "🟦",
    equippedAccentName: equipped.accent?.name ?? "Indigo",
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

  // In-flight guard per item kind: a fast double tap must not pass the
  // canPurchase balance gate twice and double-charge (the repository also
  // validates balance inside its transaction; this keeps the UX single-shot).
  const buyInFlightRef = useRef<Set<StreakItemKind>>(new Set());

  const onBuyStreakItem = async (kind: StreakItemKind) => {
    if (buyInFlightRef.current.has(kind)) {
      return;
    }
    const cost = ITEM_COSTS[kind];
    if (!canPurchase(data.balance, kind, data.profileSettings, new Date())) {
      return;
    }
    buyInFlightRef.current.add(kind);
    try {
      await purchaseStreakItem(getDb(), {
        kind,
        cost,
        operationId: `streak-item:${kind}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        reason: `streak-item-${kind}`,
      });
      refresh();
      celebrateReward({ title: `${kind} purchased`, coins: -cost, emoji: "🛡️" });
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        celebrateReward({ title: "Not enough coins", emoji: "⚠️" });
      } else {
        console.error("[profile] streak item purchase failed", error);
      }
    } finally {
      buyInFlightRef.current.delete(kind);
    }
  };

  const onApplyStreakItem = async (kind: StreakItemKind) => {
    try {
      const result = await applyOwnedStreakItem(
        getDb(),
        kind,
        data.streakState,
        new Date(),
      );
      if (result === "applied") {
        refresh();
        celebrateReward({ title: "Streak protected!", emoji: "🛡️" });
      } else if (result === "no-item") {
        celebrateReward({ title: "No item to apply", emoji: "⚠️" });
      }
    } catch (error) {
      console.error("[profile] streak item apply failed", error);
    }
  };

  const onClaimMilestone = async (milestone: StreakMilestone) => {
    try {
      const result = await claimStreakMilestoneReward(
        getDb(),
        milestone,
        data.longestStreak,
        new Date(),
      );
      if (result === "claimed") {
        refresh();
        celebrateReward({
          title: `${milestone.label} reached!`,
          xp: milestone.rewardXp,
          coins: milestone.rewardCurrency,
          emoji: "🔥",
        });
      }
    } catch (error) {
      console.error("[profile] milestone claim failed", error);
    }
  };

  const onClaimQuest = async (definition: QuestDefinition) => {
    try {
      const result = await applyQuestReward(
        getDb(),
        definition,
        currentPeriodKey(definition.kind, new Date()),
      );
      if (result.status === "claimed") {
        refresh();
        celebrateReward({
          title: "Quest reward",
          xp: definition.reward.xp,
          coins: definition.reward.coins,
          emoji: "🏆",
        });
      }
    } catch (error) {
      console.error("[profile] quest claim failed", error);
    }
  };

  const onClaimAchievement = async (definition: AchievementDef) => {
    try {
      const result = await claimAchievementReward(getDb(), definition);
      if (result.status === "claimed") {
        refresh();
        celebrateReward({
          title: "Achievement reward",
          xp: definition.rewardXp,
          coins: definition.rewardCurrency,
          emoji: "🏅",
        });
      }
    } catch (error) {
      console.error("[profile] achievement claim failed", error);
    }
  };

  const onSelectTheme = (option: ThemeOption) => {
    setThemeId(option.id);
    try {
      void getDb()
        .profile.update({ settings: { [THEME_SETTINGS_KEY]: option.id } })
        .catch((error: unknown) => {
          console.error("[profile] theme persist failed", error);
        });
    } catch (error) {
      console.error("[profile] theme persist failed", error);
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
            {data.equippedFrameEmoji}
          </ThemedText>
        </ThemedView>
        <View style={styles.identityText}>
          <ThemedText type="bodyLarge">Local player</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Profile name and avatar customization arrive in a later wave.
          </ThemedText>
        </View>
      </ThemedView>

      {/* Streak + recovery inventory + apply (constitution §18). */}
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
          <ThemedText
            type="caption"
            themeColor="warning"
            testID="profile-streak-at-risk"
            accessibilityLiveRegion="polite"
          >
            Your streak is at risk — play today to keep it alive.
          </ThemedText>
        )}
        <View style={styles.itemList}>
          {STREAK_ITEMS.map((item) => {
            const canApply =
              item.kind === "freeze"
                ? canApplyFreeze(
                    data.streakState,
                    data.profileSettings,
                    new Date(),
                  )
                : item.kind === "recovery"
                  ? canApplyRecovery(
                      data.streakState,
                      data.profileSettings,
                      new Date(),
                    )
                  : canApplyShield(
                      data.streakState,
                      data.profileSettings,
                      new Date(),
                    );
            return (
              <View key={item.kind} style={styles.itemRow}>
                <View style={styles.itemText}>
                  <ThemedText type="smallBold">
                    {item.label} × {data.inventory[item.kind]}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {item.caption}
                  </ThemedText>
                </View>
                <View style={styles.itemActions}>
                  {canApply && (
                    <Pressable
                      testID={`streak-apply-${item.kind}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Apply ${item.label}`}
                      onPress={() => onApplyStreakItem(item.kind)}
                    >
                      <ThemedView type="accentSoft" style={styles.buyPill}>
                        <ThemedText type="smallBold" themeColor="accent">
                          Apply
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  )}
                  <Pressable
                    testID={`streak-buy-${item.kind}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Buy ${item.label} for ${ITEM_COSTS[item.kind]} coins`}
                    disabled={
                      !canPurchase(
                        data.balance,
                        item.kind,
                        data.profileSettings,
                        new Date(),
                      )
                    }
                    onPress={() => onBuyStreakItem(item.kind)}
                  >
                    <ThemedView type="accentSoft" style={styles.buyPill}>
                      <ThemedText type="smallBold" themeColor="accent">
                        {ITEM_COSTS[item.kind]} coins
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ThemedView>

      {/* Streak milestones: progress + one-time claim. */}
      <ThemedView
        type="surface"
        style={styles.card}
        testID="profile-milestones"
      >
        <ThemedText type="subtitle">Streak Milestones</ThemedText>
        {data.milestoneRows.map(({ milestone, reached, claimed }) => (
          <View key={milestone.id} style={styles.itemRow}>
            <View style={styles.itemText}>
              <ThemedText type="smallBold">
                {milestone.label}
                {reached ? " ✓" : ""}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {milestone.description}
                {milestone.rewardXp || milestone.rewardCurrency
                  ? ` · +${milestone.rewardXp ?? 0} XP / +${milestone.rewardCurrency ?? 0} coins`
                  : ""}
              </ThemedText>
            </View>
            {reached && !claimed && (
              <Pressable
                testID={`milestone-claim-${milestone.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Claim ${milestone.label} reward`}
                onPress={() => onClaimMilestone(milestone)}
              >
                <ThemedView type="accentSoft" style={styles.buyPill}>
                  <ThemedText type="smallBold" themeColor="accent">
                    Claim
                  </ThemedText>
                </ThemedView>
              </Pressable>
            )}
          </View>
        ))}
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
            const definition = QUEST_DEFINITIONS_V1.find(
              (d) => d.id === evaluation.questId,
            );
            const progress =
              evaluation.goal <= 0
                ? evaluation.completed
                  ? 1
                  : 0
                : Math.min(evaluation.progress / evaluation.goal, 1);
            return (
              <View key={evaluation.questId} style={styles.questRow}>
                <View style={styles.itemText}>
                  <ThemedText type="smallBold">
                    {definition?.title ?? evaluation.questId}
                  </ThemedText>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.round(progress * 100)}%` },
                      ]}
                    />
                  </View>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {Math.min(evaluation.progress, evaluation.goal)}/
                    {evaluation.goal} ·{" "}
                    {claimed
                      ? "Claimed"
                      : completed
                        ? "Complete — claim your reward"
                        : "In progress"}
                  </ThemedText>
                </View>
                {completed && !claimed && definition && (
                  <Pressable
                    testID={`quest-claim-${evaluation.questId}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Claim ${definition.title} reward`}
                    onPress={() => onClaimQuest(definition)}
                  >
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

      {/* Achievements — unlocks + once-only claims, grouped by progress. */}
      <ThemedView
        type="surface"
        style={styles.card}
        testID="profile-achievements"
      >
        <ThemedText type="subtitle">Achievements</ThemedText>
        {ACHIEVEMENT_DEFINITIONS_V1.map((definition) => {
          const unlock = data.unlocks.get(definition.id);
          const claimed = unlock?.claimedAt != null;
          const unlocked = unlock != null;
          const progress =
            data.achievementRatios.get(definition.id) ?? (unlocked ? 1 : 0);
          return (
            <View key={definition.id} style={styles.questRow}>
              <View style={styles.itemText}>
                <ThemedText type="smallBold">{definition.title}</ThemedText>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progress * 100)}%` },
                    ]}
                  />
                </View>
                <ThemedText type="caption" themeColor="textSecondary">
                  {definition.description} ·{" "}
                  {claimed
                    ? "Claimed"
                    : unlocked
                      ? "Unlocked — claim"
                      : "Locked"}
                </ThemedText>
              </View>
              {unlocked && !claimed && (
                <Pressable
                  testID={`achievement-claim-${definition.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Claim ${definition.title} reward`}
                  onPress={() => onClaimAchievement(definition)}
                >
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

      {/* Cosmetics summary + link to the full Rewards hub. */}
      <Link href={"/rewards" as any} asChild>
        <Pressable
          testID="profile-cosmetics"
          accessibilityRole="button"
          accessibilityLabel="Cosmetics. Manage your cosmetics"
        >
          <ThemedView type="surface" style={styles.card}>
            <ThemedText type="subtitle">Cosmetics</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Frame: {data.equippedFrameEmoji} · Accent:{" "}
              {data.equippedAccentName} — manage your cosmetics →
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>

      {/* Data portability — export / import / wipe (Session 05). */}
      <Link href={"/data-management" as any} asChild>
        <Pressable
          testID="profile-data-management"
          accessibilityRole="button"
          accessibilityLabel="Data Management. Backup, restore, and delete your local training data"
        >
          <ThemedView type="surface" style={styles.card}>
            <ThemedText type="subtitle">Data Management</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Backup, restore, and delete your local training data →
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Link>

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
              accessibilityLabel={`Theme ${option.label}`}
              accessibilityState={{ selected }}
              onPress={() => onSelectTheme(option)}
            >
              <ThemedView
                type={selected ? "accentSoft" : "surface"}
                style={styles.themeRow}
              >
                <ThemedText
                  type="smallBold"
                  themeColor={selected ? "accent" : "text"}
                >
                  {option.label}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {selected ? "Active" : option.mode}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </ThemedView>

      <SensorySettingsCard />

      <RewardCelebrationHost />
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
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  streakRow: {
    flexDirection: "row",
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
  buyPill: {
    alignSelf: "flex-start",
    ...MinTouchTarget,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(120,120,140,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: "#4F6BFF",
  },
  questRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  themeRow: {
    borderRadius: Radii.medium,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  settingText: {
    flex: 1,
    gap: Spacing.half,
  },
});
