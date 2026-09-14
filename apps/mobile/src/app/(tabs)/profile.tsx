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
 * Presentation (campaign 026, design-language v3 "Neon Arcade"): the identity
 * hero owns a 2×2 metric grid with exactly one accent-filled identity cell
 * (level) and neutral cells for streak / XP / coins; the streak beat is a
 * day-dot `StreakStrip` plus protection items with identity sparks; quests /
 * achievements / milestones keep three distinct treatments (claimable =
 * primary action, in-progress = meter, locked = desaturated + lock); settings
 * navigate through `ListRow`s with identity icons.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { useSettings } from "@/components/settings/settings-provider";
import { SensorySettingsCard } from "@/components/sensory/sensory-settings-card";
import { ThemedText } from "@/components/themed-text";
import { StateCard } from "@/components/shell";
import { Radii, Spacing, type ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Entrance,
  HAIRLINE,
  ListRow,
  ProgressBar,
  Spark,
  StreakStrip,
  showToast,
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
  refreshProgression,
} from "@/progression";
import { levelForXp, levelProgress, xpForNextLevel, xpIntoLevel } from "@/rating";
import {
  evaluateQuests,
  currentPeriodKey,
  applyQuestReward,
  selectActiveQuests,
  QUEST_DEFINITIONS_V1,
  type QuestDefinition,
  type QuestEvaluation,
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

/** Soft chip + ink per protection item, so each item carries its identity. */
const ITEM_TONES: Record<
  StreakItemKind,
  { soft: ThemeColor; ink: ThemeColor }
> = {
  freeze: { soft: "infoSoft", ink: "infoText" },
  shield: { soft: "accentSoft", ink: "accentText" },
  recovery: { soft: "successSoft", ink: "successText" },
};

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
  // screen reflects sessions completed since the last visit. The shared
  // refresh also re-seeds definitions if a wipe/replace dropped them, and
  // returns the exact snapshot it evaluated — the screen derives its quest
  // rows from the same bounded sample + lifetime aggregates, no second full
  // scan (Campaign 027 performance work).
  const questSnapshot = await refreshProgression(db, now);

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

  // Quest evaluations reuse the sync's bounded snapshot; longterm quests read
  // its lifetime aggregates, so their numbers stay exact at any history size.
  const questEvals = evaluateQuests(
    selectActiveQuests(QUEST_DEFINITIONS_V1, now),
    questSnapshot,
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
  const { data, loaded, error } = useDbData(loadProfile, [refreshKey], EMPTY_PROFILE);

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
        // Campaign 027: a failed purchase used to be console-only. The toast
        // is the user-visible surface; the balance is unchanged.
        showToast({
          title: "Purchase failed",
          detail: "Your coins are unchanged — try again.",
          tone: "danger",
        });
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
        // Campaign 027: the applied branch used to fire this celebration too,
        // so a successful protection always read "No item to apply" as well.
        celebrateReward({ title: "No item to apply", emoji: "⚠️" });
      }
    } catch (error) {
      console.error("[profile] streak item apply failed", error);
      showToast({
        title: "Couldn't apply that item",
        detail: "Nothing was changed — try again.",
        tone: "danger",
      });
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
      // Campaign 028: a failed claim used to be console-only. Claims are
      // once-only and transactional, so a rejection means nothing was granted.
      showToast({
        title: "Couldn't claim that reward",
        detail: "Nothing was changed — try again.",
        tone: "danger",
      });
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
      // Campaign 028: a failed claim used to be console-only.
      showToast({
        title: "Couldn't claim that quest",
        detail: "Nothing was changed — try again.",
        tone: "danger",
      });
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
      // Campaign 028: a failed claim used to be console-only.
      showToast({
        title: "Couldn't claim that achievement",
        detail: "Nothing was changed — try again.",
        tone: "danger",
      });
    }
  };

  const onSelectTheme = (option: ThemeOption) => {
    setThemeId(option.id);
    try {
      void getDb()
        .profile.update({ settings: { [THEME_SETTINGS_KEY]: option.id } })
        .catch((error: unknown) => {
          console.error("[profile] theme persist failed", error);
          // Campaign 028 sweep: the optimistic in-session switch stays, but a
          // failed persist would silently revert on restart — say so.
          showToast({
            title: "Couldn't save your theme",
            detail: "It may reset when you restart — try again.",
            tone: "danger",
          });
        });
    } catch (error) {
      console.error("[profile] theme persist failed", error);
      showToast({
        title: "Couldn't save your theme",
        detail: "It may reset when you restart — try again.",
        tone: "danger",
      });
    }
  };

  const level = levelForXp(data.totalXp);
  const hasProgress = data.totalXp > 0 || data.balance > 0;

  // A failed load must not present the zeroed fallback as a new-player profile:
  // show the recoverable error with a retry, matching Home/progress-detail.
  if (loaded && error) {
    return (
      <ScreenShell>
        <ThemedText type="title" testID="profile-title">
          Profile
        </ThemedText>
        <StateCard
          variant="error"
          title="Couldn't load your profile"
          message="Your profile data is unavailable right now."
          testID="profile-error"
          action={{ label: "Try again", onPress: refresh }}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <Entrance index={0}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <ThemedText type="eyebrow" themeColor="accentText">
              PLAYER
            </ThemedText>
            <ThemedText type="title" testID="profile-title">
              Profile
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Identity, achievements and settings.
            </ThemedText>
          </View>
          <Spark size={30} color={theme.accent} />
        </View>
      </Entrance>

      {/* Identity hero: avatar row plus the 2×2 metric grid; the level cell is
          the single accent-filled identity metric, the rest stay neutral. */}
      <Entrance index={1}>
        <Card variant="hero" testID="profile-identity" padding="lg">
          <View style={styles.heroRow}>
            <Avatar
              size="lg"
              emoji={data.equippedFrameEmoji}
              label="Local player"
            />
            <View style={styles.identityText}>
              <ThemedText type="bodyLarge">Local player</ThemedText>
              {/* Progression context (gated on real data so the db-unavailable
                  fallback stays honest instead of inventing progress). */}
              <ThemedText type="caption" themeColor="textSecondary">
                {hasProgress
                  ? `Level ${level} · ${data.equippedAccentName} accent`
                  : "Profile name and avatar customization arrive in a later wave."}
              </ThemedText>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <MetricTile
              testID="profile-metric-level"
              label="Level"
              value={`${level}`}
              tone="accent"
              icon={<Spark size={16} color={theme.accentOn} />}
            />
            <MetricTile
              testID="profile-metric-streak"
              label="Day streak"
              value={`${data.currentStreak}`}
              valueColor="streakText"
              icon={<Spark size={16} color={theme.streakText} />}
            />
            <MetricTile
              testID="profile-metric-xp"
              label="Total XP"
              value={compactNumber(data.totalXp)}
              valueColor="xpText"
              icon={<Spark size={16} color={theme.xpText} />}
            />
            <MetricTile
              testID="profile-metric-coins"
              label="Coins"
              value={compactNumber(data.balance)}
              valueColor="currencyText"
              icon={<Spark size={16} color={theme.currencyText} />}
            />
          </View>

          {hasProgress ? (
            <ProgressBar
              value={levelProgress(data.totalXp)}
              tone="xp"
              label={`Level ${level} progress`}
              valueLabel={`${xpIntoLevel(data.totalXp)} of ${xpForNextLevel(data.totalXp)} XP`}
            />
          ) : null}
        </Card>
      </Entrance>

      {/* Streak rhythm: day-dot strip + count pill, never a plain text row. */}
      <Entrance index={2}>
        <Card testID="profile-streak">
          <ThemedText type="headline">Streak</ThemedText>
          <View style={styles.streakBeat}>
            <StreakStrip
              count={data.currentStreak}
              days={7}
              testID="profile-streak-week"
            />
            {data.atRisk ? (
              <Badge tone="warning" label="At risk" size="sm" />
            ) : null}
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
          {nextMilestone ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Next milestone: {nextMilestone.milestone.label} —{" "}
              {nextMilestone.remaining} days to go
            </ThemedText>
          ) : null}
          <View style={styles.statRow}>
            <Stat
              value={`${data.longestStreak}`}
              label="Longest streak"
              valueColor="streakText"
            />
            <Stat
              value={`${data.inventory.freeze + data.inventory.shield + data.inventory.recovery}`}
              label="Protection items"
              valueColor="infoText"
            />
          </View>
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
              const itemTone = ITEM_TONES[item.kind];
              return (
                <View key={item.kind} style={styles.itemRow}>
                  <View
                    style={[
                      styles.itemIcon,
                      { backgroundColor: theme[itemTone.soft] },
                    ]}
                  >
                    <Spark size={16} color={theme[itemTone.ink]} />
                  </View>
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
      </Entrance>

      {/* Streak milestones: claimable = action, reached = check, else meter. */}
      <Entrance index={3}>
        <Card testID="profile-milestones">
          <ThemedText type="headline">Streak Milestones</ThemedText>
          {data.milestoneRows.map(
            ({ milestone, reached, claimed, remaining }) => (
              <View
                key={milestone.id}
                style={styles.stateRow}
                testID={`profile-milestone-${milestone.id}`}
              >
                <View style={styles.itemText}>
                  <ThemedText type="body">{milestone.label}</ThemedText>
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
                    {!reached && remaining > 0
                      ? ` · ${remaining} days to go`
                      : ""}
                    {reached && !claimed
                      ? " · Complete — claim your reward"
                      : ""}
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
            ),
          )}
        </Card>
      </Entrance>

      {/* Quests — live progress + once-only claims. */}
      <Entrance index={4}>
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
              const completed =
                evaluation.completed || row?.completedAt != null;
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
      </Entrance>

      {/* Achievements — claimable vs in-progress vs locked treatments. */}
      <Entrance index={5}>
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
            const ratio = evaluated?.ratio ?? (unlocked ? 1 : 0);
            return (
              <View
                key={definition.id}
                style={[
                  styles.stateRow,
                  !unlocked ? styles.lockedRow : null,
                ]}
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
      </Entrance>

      {/* Cosmetics gallery: equipped / owned / locked grid + hub link. */}
      <Entrance index={6}>
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
                        style={[
                          styles.cell,
                          {
                            backgroundColor: theme.surfaceSunken,
                            borderColor: theme.border,
                          },
                          !owned ? styles.lockedRow : null,
                        ]}
                        testID={`profile-cosmetic-${def.id}`}
                        accessibilityLabel={`${def.name}. ${state}`}
                      >
                        <Avatar
                          size="sm"
                          emoji={def.preview.emoji}
                          label={
                            def.preview.emoji ? undefined : def.name.slice(0, 1)
                          }
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
            icon={<Spark size={16} color={theme.accentText} />}
            tone="accentSoft"
            onPress={() => router.push("/rewards")}
            testID="profile-cosmetics"
            accessibilityLabel="Cosmetics. Manage your cosmetics"
          />
        </Card>
      </Entrance>

      {/* Data portability — export / import / wipe (Session 05). */}
      <Entrance index={7}>
        <Card>
          <ListRow
            title="Data Management"
            subtitle="Backup, restore, and delete your local training data"
            icon={<Spark size={16} color={theme.infoText} />}
            tone="infoSoft"
            onPress={() => router.push("/data-management")}
            testID="profile-data-management"
            accessibilityLabel="Data Management. Backup, restore, and delete your local training data"
          />
        </Card>
      </Entrance>

      {/* Theme selection (theme registry seam). */}
      <Entrance index={8}>
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
                  icon={
                    <Spark
                      size={14}
                      color={selected ? theme.accentOn : theme.textMuted}
                    />
                  }
                  tone={selected ? "accent" : "surfaceSunken"}
                  onPress={() => onSelectTheme(option)}
                  testID={`profile-settings-theme-${option.id}`}
                  accessibilityLabel={`Theme ${option.label}${selected ? ", active" : ""}`}
                  accessibilityHint={
                    selected ? undefined : `Switch to the ${option.label} theme`
                  }
                  showChevron={false}
                />
              </View>
            );
          })}
        </Card>
      </Entrance>

      {/* Sensory toggles live in the shared sensory card (owned outside this
          surface); the wrapper pins the profile-settings testID family. */}
      <View testID="profile-sensory-card">
        <SensorySettingsCard />
      </View>

      <RewardCelebrationHost />
    </ScreenShell>
  );
}

function Stat({
  value,
  label,
  valueColor = "accent",
}: {
  value: string;
  label: string;
  valueColor?: ThemeColor;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: theme.surfaceSunken, borderColor: theme.border },
      ]}
    >
      <ThemedText type="numeral" themeColor={valueColor}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * One cell of the hero metric grid. The filled variant is the single
 * accent-owned identity metric; neutral cells keep their surface quiet and let
 * the metric hue live in the numeral and the spark mark only.
 */
function MetricTile({
  label,
  value,
  icon,
  tone,
  valueColor,
  testID,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  /** Filled family background (accent, for the identity cell). */
  tone?: ThemeColor;
  /** Numeral colour on a neutral cell. */
  valueColor?: ThemeColor;
  testID?: string;
}) {
  const theme = useTheme();
  const filled = tone !== undefined;
  return (
    <View
      testID={testID}
      style={[
        styles.metricTile,
        {
          backgroundColor: filled ? theme[tone] : theme.surfaceSunken,
          borderColor: filled ? theme[tone] : theme.border,
        },
      ]}
    >
      {icon}
      <ThemedText
        type="numeralLg"
        themeColor={filled ? "accentOn" : (valueColor ?? "text")}
      >
        {value}
      </ThemedText>
      <ThemedText
        type="eyebrow"
        themeColor={filled ? "accentOn" : "textSecondary"}
      >
        {label}
      </ThemedText>
    </View>
  );
}

/** Compact XP/coin display so a large balance cannot break a metric tile. */
function compactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Math.abs(value) >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1e5) {
    return `${Math.round(value / 1e3)}k`;
  }
  return `${Math.round(value)}`;
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
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  metricTile: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 96,
    borderRadius: Radii.large,
    borderWidth: HAIRLINE,
    padding: Spacing.three,
    gap: Spacing.one,
    // Value and label anchor to the bottom so uneven content still aligns.
    justifyContent: "flex-end",
  },
  streakBeat: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  statRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    borderRadius: Radii.large,
    borderWidth: HAIRLINE,
    padding: Spacing.three,
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
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: Radii.medium,
    alignItems: "center",
    justifyContent: "center",
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
  lockedRow: {
    opacity: 0.6,
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
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.large,
    borderWidth: HAIRLINE,
  },
});
