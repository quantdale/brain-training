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
 *
 * Presentation (campaign 024, design-language v2): the identity hero owns the
 * screen (Avatar + level + XP meter + coin balance); the streak beat reads
 * flame → count → 7-day strip → milestone tease; quests / achievements /
 * milestones use three distinct treatments (claimable = primary action,
 * in-progress = meter + n/m, locked = desaturated + lock) so state never
 * relies on colour alone; settings navigate through `ListRow`s.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { useSettings } from "@/components/settings/settings-provider";
import { SensorySettingsCard } from "@/components/sensory/sensory-settings-card";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ListRow,
  ProgressBar,
  StatBlock,
} from "@/components/ui";
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
import { levelForXp, levelProgress, xpForNextLevel, xpIntoLevel } from "@/rating";
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
  COSMETIC_SLOTS,
  isCosmeticOwned,
  resolveEquipped,
  type CosmeticDef,
  type CosmeticProgression,
  type CosmeticSlot,
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

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  avatarFrame: "Avatar Frames",
  accent: "Accents",
  celebration: "Celebrations",
};

interface WeekDay {
  key: string;
  /** Single-letter column header (locale aware). */
  label: string;
  /** Full day name for screen readers. */
  fullLabel: string;
  active: boolean;
  isToday: boolean;
}

interface ProfileData {
  balance: number;
  /** Session XP + award XP, for the identity context line. */
  totalXp: number;
  inventory: StreakInventory;
  profileSettings: Record<string, unknown>;
  questRows: Map<string, QuestProgress>;
  questEvals: QuestEvaluation[];
  unlocks: Map<string, { unlockedAt: number; claimedAt: number | null }>;
  currentStreak: number;
  longestStreak: number;
  atRisk: boolean;
  streakState: StreakState;
  /** Last 7 local days ending today, oldest first. */
  weekDays: WeekDay[];
  milestoneRows: {
    milestone: StreakMilestone;
    reached: boolean;
    claimed: boolean;
    remaining: number;
  }[];
  cosmeticProgression: CosmeticProgression;
  achievementProgress: Map<string, { progress: number; goal: number; ratio: number }>;
  equippedIds: Partial<Record<CosmeticSlot, string>>;
  equippedFrameEmoji: string;
  equippedAccentName: string;
}

const EMPTY_PROFILE: ProfileData = {
  balance: 0,
  totalXp: 0,
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
  weekDays: [],
  milestoneRows: [],
  cosmeticProgression: {
    claimedAchievements: new Set(),
    claimedQuests: new Set(),
    longestStreak: 0,
  },
  achievementProgress: new Map(),
  equippedIds: {},
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

  const [
    balance,
    profile,
    unlockRows,
    progressRows,
    sessionXp,
    awardsXp,
  ] = await Promise.all([
    db.ledger.getBalance(),
    db.profile.get(),
    db.achievements.listUnlocks(),
    Promise.all(
      selectActiveQuests(QUEST_DEFINITIONS_V1, now).map((def) =>
        db.quests.listProgressForPeriod(currentPeriodKey(def.kind, now)),
      ),
    ),
    db.sessions.getTotalXp(now.getTime()),
    db.xpAwards.getTotalAwardedXp(now.getTime()),
  ]);

  const profileSettings = profile?.settings ?? {};
  const inventory = readInventory(profileSettings);

  // Lightweight projection only: quest evaluation needs (gameId, xp,
  // completedAt) — no JSON blobs. Full-row listRecent here was a per-focus
  // scalability hazard on large histories.
  const sessions = await db.sessions.listLightweight(
    Number.MAX_SAFE_INTEGER,
    now.getTime(),
  );
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

  // 7-day strip ending today (calendar-day walk so DST transitions cannot
  // duplicate or skip a column).
  const activeSet = new Set(activityDates);
  const weekDays: WeekDay[] = [];
  const cursor = new Date(now);
  for (let i = 0; i < 7; i++) {
    const key = localDateString(cursor);
    weekDays.unshift({
      key,
      label: cursor.toLocaleDateString(undefined, { weekday: "narrow" }),
      fullLabel: cursor.toLocaleDateString(undefined, { weekday: "long" }),
      active: activeSet.has(key),
      isToday: i === 0,
    });
    cursor.setDate(cursor.getDate() - 1);
  }

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
  const achievementProgress = new Map<
    string,
    { progress: number; goal: number; ratio: number }
  >(
    ACHIEVEMENT_DEFINITIONS_V1.map((definition) => {
      const evaluated = evaluateAchievementProgress(
        definition,
        achievementSnapshot,
      );
      return [
        definition.id,
        {
          progress: evaluated.progress,
          goal: evaluated.goal,
          ratio: evaluated.ratio,
        },
      ];
    }),
  );

  const equipped = resolveEquipped(
    COSMETIC_DEFINITIONS,
    profileSettings,
    cosmeticProgression,
  );
  const equippedIds: Partial<Record<CosmeticSlot, string>> = {};
  for (const slot of COSMETIC_SLOTS) {
    const def = equipped[slot];
    if (def) {
      equippedIds[slot] = def.id;
    }
  }

  return {
    balance,
    totalXp: sessionXp + awardsXp,
    inventory,
    profileSettings,
    questRows,
    questEvals,
    unlocks,
    currentStreak: effectiveCurrent(streakState, today),
    longestStreak,
    atRisk: streakState.atRisk,
    streakState,
    weekDays,
    milestoneRows: milestoneProgress(streakState).map((m) => ({
      milestone: m.milestone,
      reached: m.reached,
      remaining: m.remaining,
      claimed: claimedMilestones.has(m.milestone.id),
    })),
    cosmeticProgression,
    achievementProgress,
    equippedIds,
    equippedFrameEmoji: equipped.avatarFrame?.preview.emoji ?? "🟦",
    equippedAccentName: equipped.accent?.name ?? "Indigo",
  };
}

/** Human-readable unlock requirement for a cosmetic (locked-state caption). */
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

export default function ProfileScreen() {
  const { themeId, setThemeId } = useSettings();
  const theme = useTheme();
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

  // Contextual claim counters: surface "rewards ready" summaries at the top of
  // the quest/achievement sections so completed-but-unclaimed work is
  // impossible to miss in a long list.
  const claimableQuests = data.questEvals.filter((evaluation) => {
    const row = data.questRows.get(evaluation.questId);
    const completed = evaluation.completed || row?.completedAt != null;
    return completed && row?.claimedAt == null;
  }).length;
  const claimableAchievements = ACHIEVEMENT_DEFINITIONS_V1.filter(
    (definition) => {
      const unlock = data.unlocks.get(definition.id);
      return unlock != null && unlock.claimedAt == null;
    },
  ).length;

  // Next unreached streak milestone, teased under the 7-day strip.
  const nextMilestone = data.milestoneRows.find((row) => !row.reached) ?? null;

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

  const level = levelForXp(data.totalXp);
  const hasProgress = data.totalXp > 0 || data.balance > 0;

  return (
    <ScreenShell>
      <ThemedText type="title" testID="profile-title">
        Profile
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Identity, achievements and settings.
      </ThemedText>

      {/* Identity hero: avatar + level + XP meter + coin balance. */}
      <Card variant="hero" tone="xpSoft" testID="profile-identity">
        <View style={styles.heroRow}>
          <Avatar
            size="lg"
            emoji={data.equippedFrameEmoji}
            label="Local player"
          />
          <View style={styles.identityText}>
            <ThemedText type="bodyLarge">Local player</ThemedText>
            {/* Progression context (gated on real data so the db-unavailable
                fallback — and the visual-baseline canary — stays unchanged). */}
            {hasProgress ? (
              <ThemedText type="numeral">Level {level}</ThemedText>
            ) : (
              <ThemedText type="caption" themeColor="textSecondary">
                Profile name and avatar customization arrive in a later wave.
              </ThemedText>
            )}
          </View>
          <StatBlock label="Coins" value={`${data.balance}`} metric="currency" />
        </View>
        {hasProgress ? (
          <ProgressBar
            value={levelProgress(data.totalXp)}
            tone="xp"
            label={`Level ${level}`}
            valueLabel={`${xpIntoLevel(data.totalXp)} of ${xpForNextLevel(data.totalXp)} XP`}
          />
        ) : null}
      </Card>

      {/* Streak beat: flame + count → "N day streak" → 7-day strip → tease. */}
      <Card testID="profile-streak">
        <ThemedText type="headline">Streak</ThemedText>
        <View
          style={styles.beatRow}
          accessibilityLabel={`${data.currentStreak} day streak`}
        >
          <ThemedText type="numeralLg" themeColor="streak">
            🔥 {data.currentStreak}
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            day streak
          </ThemedText>
        </View>
        {data.weekDays.length > 0 ? (
          <View style={styles.weekStrip} testID="profile-streak-week">
            {data.weekDays.map((day) => (
              <View
                key={day.key}
                style={[
                  styles.dayDot,
                  {
                    backgroundColor: day.active
                      ? theme.streak
                      : theme.surfaceSunken,
                  },
                  day.isToday && {
                    borderColor: theme.streak,
                    borderWidth: 2,
                  },
                ]}
                accessibilityLabel={`${day.fullLabel}, ${day.active ? "trained" : "no training"}${day.isToday ? ", today" : ""}`}
              >
                <ThemedText
                  type="caption"
                  themeColor={day.active ? "streakOn" : "textMuted"}
                  allowFontScaling={false}
                >
                  {day.label}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
        {nextMilestone ? (
          <ThemedText type="caption" themeColor="textSecondary">
            Next milestone: {nextMilestone.milestone.label} —{" "}
            {nextMilestone.remaining} days to go
          </ThemedText>
        ) : null}
        <View style={styles.streakRow}>
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
                  <ThemedText type="body">
                    {item.label} × {data.inventory[item.kind]}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {item.caption}
                  </ThemedText>
                </View>
                <View style={styles.itemActions}>
                  {canApply && (
                    <Button
                      label="Apply"
                      size="sm"
                      variant="secondary"
                      fullWidth={false}
                      testID={`streak-apply-${item.kind}`}
                      accessibilityLabel={`Apply ${item.label}`}
                      onPress={() => onApplyStreakItem(item.kind)}
                    />
                  )}
                  <Button
                    label={`${ITEM_COSTS[item.kind]} coins`}
                    size="sm"
                    variant="secondary"
                    fullWidth={false}
                    testID={`streak-buy-${item.kind}`}
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
                  />
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Streak milestones: claimable = action, reached = check, else meter. */}
      <Card testID="profile-milestones">
        <ThemedText type="headline">Streak Milestones</ThemedText>
        {data.milestoneRows.map(({ milestone, reached, claimed, remaining }) => (
          <View
            key={milestone.id}
            style={styles.stateRow}
            testID={`profile-milestone-${milestone.id}`}
          >
            <View style={styles.itemText}>
              <ThemedText type="body">
                {milestone.label}
              </ThemedText>
              <ProgressBar
                value={
                  milestone.days <= 0
                    ? 1
                    : Math.min(data.longestStreak / milestone.days, 1)
                }
                tone="streak"
                valueLabel={`${Math.min(data.longestStreak, milestone.days)}/${milestone.days} days`}
                accessibilityLabel={`${milestone.label}, ${Math.min(data.longestStreak, milestone.days)} of ${milestone.days} days`}
              />
              <ThemedText type="caption" themeColor="textSecondary">
                {milestone.description}
                {milestone.rewardXp || milestone.rewardCurrency
                  ? ` · +${milestone.rewardXp ?? 0} XP / +${milestone.rewardCurrency ?? 0} coins`
                  : ""}
                {!reached && remaining > 0 ? ` · ${remaining} days to go` : ""}
                {reached && !claimed ? " · Complete — claim your reward" : ""}
                {claimed ? " · ✓ Claimed" : ""}
              </ThemedText>
            </View>
            {reached && !claimed ? (
              <View style={styles.stateAction}>
                <Badge tone="accent" label="✓ Ready to claim" size="sm" />
                <Button
                  label="Claim"
                  size="sm"
                  variant="primary"
                  fullWidth={false}
                  testID={`milestone-claim-${milestone.id}`}
                  accessibilityLabel={`Claim ${milestone.label} reward`}
                  onPress={() => onClaimMilestone(milestone)}
                />
              </View>
            ) : claimed ? (
              <Badge tone="success" label="✓ Claimed" size="sm" />
            ) : null}
          </View>
        ))}
      </Card>

      {/* Quests — live progress + once-only claims. */}
      <Card testID="profile-quests">
        <ThemedText type="headline">Quests</ThemedText>
        {claimableQuests > 0 && (
          <ThemedText
            type="caption"
            themeColor="accent"
            testID="profile-quests-ready"
            accessibilityLiveRegion="polite"
          >
            {claimableQuests} quest reward{claimableQuests === 1 ? "" : "s"}{" "}
            ready to claim!
          </ThemedText>
        )}
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
            const shown = Math.min(evaluation.progress, evaluation.goal);
            return (
              <View
                key={evaluation.questId}
                style={styles.stateRow}
                testID={`profile-quest-${evaluation.questId}`}
              >
                <View style={styles.itemText}>
                  <ThemedText type="body">
                    {definition?.title ?? evaluation.questId}
                  </ThemedText>
                  <ProgressBar
                    value={progress}
                    valueLabel={`${shown}/${evaluation.goal}`}
                    accessibilityLabel={`${definition?.title ?? evaluation.questId}, ${shown} of ${evaluation.goal}`}
                  />
                  <ThemedText type="caption" themeColor="textSecondary">
                    {claimed
                      ? "✓ Claimed"
                      : completed
                        ? "Complete — claim your reward"
                        : "In progress"}
                  </ThemedText>
                </View>
                {completed && !claimed && definition ? (
                  <View style={styles.stateAction}>
                    <Badge tone="accent" label="✓ Ready to claim" size="sm" />
                    <Button
                      label="Claim"
                      size="sm"
                      variant="primary"
                      fullWidth={false}
                      testID={`quest-claim-${evaluation.questId}`}
                      accessibilityLabel={`Claim ${definition.title} reward`}
                      onPress={() => onClaimQuest(definition)}
                    />
                  </View>
                ) : claimed ? (
                  <Badge tone="success" label="✓ Claimed" size="sm" />
                ) : null}
              </View>
            );
          })
        )}
      </Card>

      {/* Achievements — claimable vs in-progress vs locked treatments. */}
      <Card testID="profile-achievements">
        <ThemedText type="headline">Achievements</ThemedText>
        {claimableAchievements > 0 && (
          <ThemedText
            type="caption"
            themeColor="accent"
            testID="profile-achievements-ready"
            accessibilityLiveRegion="polite"
          >
            {claimableAchievements} achievement reward
            {claimableAchievements === 1 ? "" : "s"} ready to claim!
          </ThemedText>
        )}
        {ACHIEVEMENT_DEFINITIONS_V1.map((definition) => {
          const unlock = data.unlocks.get(definition.id);
          const claimed = unlock?.claimedAt != null;
          const unlocked = unlock != null;
          const evaluated = data.achievementProgress.get(definition.id);
          const progress = evaluated?.progress ?? (unlocked ? 1 : 0);
          const goal = evaluated?.goal ?? 1;
          const ratio =
            evaluated?.ratio ?? (unlocked ? 1 : 0);
          return (
            <View
              key={definition.id}
              style={styles.stateRow}
              testID={`profile-achievement-${definition.id}`}
            >
              <View style={styles.itemText}>
                <ThemedText
                  type="body"
                  themeColor={unlocked || claimed ? "text" : "textMuted"}
                >
                  {!unlocked ? "🔒 " : ""}
                  {definition.title}
                </ThemedText>
                {progress > 0 || unlocked ? (
                  <ProgressBar
                    value={ratio}
                    valueLabel={`${Math.min(progress, goal)}/${goal}`}
                    accessibilityLabel={`${definition.title}, ${Math.min(progress, goal)} of ${goal}`}
                  />
                ) : null}
                <ThemedText type="caption" themeColor="textSecondary">
                  {definition.description} ·{" "}
                  {claimed
                    ? "✓ Claimed"
                    : unlocked
                      ? "Unlocked — claim your reward"
                      : progress > 0
                        ? "In progress — locked"
                        : "Locked"}
                </ThemedText>
              </View>
              {unlocked && !claimed ? (
                <View style={styles.stateAction}>
                  <Badge tone="accent" label="✓ Ready to claim" size="sm" />
                  <Button
                    label="Claim"
                    size="sm"
                    variant="primary"
                    fullWidth={false}
                    testID={`achievement-claim-${definition.id}`}
                    accessibilityLabel={`Claim ${definition.title} reward`}
                    onPress={() => onClaimAchievement(definition)}
                  />
                </View>
              ) : claimed ? (
                <Badge tone="success" label="✓ Claimed" size="sm" />
              ) : null}
            </View>
          );
        })}
      </Card>

      {/* Cosmetics gallery: equipped / owned / locked grid + hub link. */}
      <Card>
        <ThemedText type="headline">Cosmetics</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Frame: {data.equippedFrameEmoji} · Accent:{" "}
          {data.equippedAccentName}
        </ThemedText>
        {COSMETIC_SLOTS.map((slot) => (
          <View key={slot}>
            <ThemedText type="label" themeColor="textSecondary">
              {SLOT_LABELS[slot]}
            </ThemedText>
            <View style={styles.grid}>
              {COSMETIC_DEFINITIONS.filter((d) => d.slot === slot).map(
                (def) => {
                  const owned = isCosmeticOwned(
                    def,
                    data.cosmeticProgression,
                    data.profileSettings,
                  );
                  const equipped = data.equippedIds[slot] === def.id;
                  const state = equipped
                    ? "Equipped"
                    : owned
                      ? "Owned"
                      : `Locked. ${unlockHint(def)}`;
                  return (
                    <View
                      key={def.id}
                      style={styles.cell}
                      testID={`profile-cosmetic-${def.id}`}
                      accessibilityLabel={`${def.name}. ${state}`}
                    >
                      <Avatar
                        size="sm"
                        emoji={def.preview.emoji}
                        label={def.preview.emoji ? undefined : def.name.slice(0, 1)}
                      />
                      <ThemedText
                        type="bodySmall"
                        themeColor={owned ? "text" : "textMuted"}
                        numberOfLines={1}
                      >
                        {def.name}
                      </ThemedText>
                      {equipped ? (
                        <Badge tone="success" label="✓ Equipped" size="sm" />
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
                    </View>
                  );
                },
              )}
            </View>
          </View>
        ))}
        <ListRow
          title="Manage cosmetics"
          subtitle="Equip and unlock in the Rewards hub"
          onPress={() => router.push("/rewards")}
          testID="profile-cosmetics"
          accessibilityLabel="Cosmetics. Manage your cosmetics"
        />
      </Card>

      {/* Data portability — export / import / wipe (Session 05). */}
      <Card>
        <ListRow
          title="Data Management"
          subtitle="Backup, restore, and delete your local training data"
          onPress={() => router.push("/data-management")}
          testID="profile-data-management"
          accessibilityLabel="Data Management. Backup, restore, and delete your local training data"
        />
      </Card>

      {/* Theme selection (theme registry seam). */}
      <Card testID="theme-card">
        <ThemedText type="headline">Theme</ThemedText>
        {THEME_OPTIONS.map((option) => {
          const selected = option.id === themeId;
          return (
            <View key={option.id} testID={`theme-option-${option.id}`}>
              <ListRow
                title={option.label}
                subtitle={selected ? `Active · ${option.mode}` : option.mode}
                meta={selected ? "✓ Active" : undefined}
                onPress={() => onSelectTheme(option)}
                testID={`profile-settings-theme-${option.id}`}
                accessibilityLabel={`Theme ${option.label}${selected ? ", active" : ""}`}
                accessibilityHint={selected ? undefined : `Switch to the ${option.label} theme`}
                showChevron={false}
              />
            </View>
          );
        })}
      </Card>

      {/* Sensory toggles live in the shared sensory card (owned outside this
          surface); the wrapper pins the profile-settings testID family. */}
      <View testID="profile-sensory-card">
        <SensorySettingsCard />
      </View>

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
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  beatRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.two,
  },
  weekStrip: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  dayDot: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: "center",
    justifyContent: "center",
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
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  stateAction: {
    alignItems: "flex-end",
    gap: Spacing.one,
  },
  itemText: {
    flex: 1,
    gap: Spacing.half,
  },
  itemActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  cell: {
    flexBasis: "48%",
    flexGrow: 1,
    alignItems: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
});
