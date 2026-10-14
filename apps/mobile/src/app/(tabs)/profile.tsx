/** Profile keeps identity and preferences before optional training records.
 * Rewards owns claims and cosmetics; streak purchases retain their stable
 * operation keys and the existing transactional repositories. */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { useSettings } from "@/components/settings/settings-provider";
import { SensorySettingsCard } from "@/components/sensory/sensory-settings-card";
import { ThemedText } from "@/components/themed-text";
import { StateCard } from "@/components/shell";
import { formatGoalProgress } from "@/components/shell/format";
import { Radii, Spacing, type ThemeColor } from "@/constants/theme";
import { MIN_TOUCH_TARGET } from "@/components/a11y";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { useTheme } from "@/hooks/use-theme";
import {
  Badge,
  AppIcon,
  type AppIconName,
  Button,
  Card,
  Entrance,
  HAIRLINE,
  ProgressBar,
  StreakStrip,
  Tappable,
  showToast,
} from "@/components/ui";
import type { AppDatabase, QuestProgress } from "@/db";
import { getDb, InsufficientFundsError, purchaseStreakItem } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import {
  ACHIEVEMENT_DEFINITIONS_V1,
  evaluateAchievementProgress,
} from "@/achievements";
import { buildAchievementSnapshot, refreshProgression } from "@/progression";
import {
  lastSyncedQuestSnapshot,
  progressionFocusSyncDue,
  progressionInputFingerprint,
  readNewestProgressionInput,
  runProgressionSync,
} from "@/progression/focus-sync";
import {
  levelForXp,
  levelProgress,
  xpForNextLevel,
  xpIntoLevel,
} from "@/rating";
import {
  evaluateQuests,
  currentPeriodKey,
  selectActiveQuests,
  QUEST_DEFINITIONS_V1,
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
  type StreakMilestone,
} from "@/streaks";
import { readInventory } from "@/streaks/inventory";
import {
  COSMETIC_DEFINITIONS,
  COSMETIC_SLOTS,
  resolveEquipped,
  type CosmeticProgression,
  type CosmeticSlot,
} from "@/cosmetics";
import { RewardCelebrationHost, celebrateReward } from "@/rewards/celebration";
import { collectClaimableRewards } from "@/rewards/inbox";
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

interface WeekDay {
  key: string;
  /** Single-letter column header (locale aware). */
  label: string;
  /** Full day name for screen readers. */
  fullLabel: string;
  active: boolean;
  isToday: boolean;
}

/** One equipped cosmetic rendered as an identity chip in the player card. */
interface EquippedCosmetic {
  slot: CosmeticSlot;
  name: string;
  color?: string;
  emoji?: string;
}

interface ProfileData {
  /** Player's own name, or "Player" when the profile has none. */
  displayName: string;
  balance: number;
  /** Session XP + award XP, for the identity context line. */
  totalXp: number;
  /** Authoritative inbox count, including persisted quest periods. */
  claimableRewardCount: number | null;
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
  achievementProgress: Map<
    string,
    { progress: number; goal: number; ratio: number }
  >;
  /** Equipped cosmetic per slot, already resolved from ownership. */
  equippedCosmetics: EquippedCosmetic[];
}

const EMPTY_PROFILE: ProfileData = {
  displayName: "Player",
  balance: 0,
  totalXp: 0,
  claimableRewardCount: null,
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
  equippedCosmetics: [],
};

async function loadProfile(
  db: AppDatabase,
  now = new Date(),
): Promise<ProfileData> {
  // Re-evaluate quests/achievements from persisted sessions first so the
  // screen reflects sessions completed since the last visit. Finding 1: the
  // focus-time sync is throttled by the shared input-aware gate; when the
  // window is still fresh the last successful sync's snapshot is reused (the
  // persisted rows cannot have changed inside the window), and a newly
  // completed session forces an immediate sync. The refresh also re-seeds
  // definitions if a wipe/replace dropped them, and returns the exact snapshot
  // it evaluated — the screen derives its quest rows from the same bounded
  // sample + lifetime aggregates, no second full scan (Campaign 027).
  const newest = await readNewestProgressionInput(db, now.getTime());
  const fingerprint = progressionInputFingerprint(newest);
  let questSnapshot = lastSyncedQuestSnapshot();
  if (progressionFocusSyncDue(now.getTime(), fingerprint) || questSnapshot === null) {
    questSnapshot = await runProgressionSync(
      (syncNow) => refreshProgression(db, syncNow),
      now,
      fingerprint,
    );
  }

  const [balance, profile, unlockRows, progressRows, sessionXp, awardsXp] =
    await Promise.all([
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
  const equippedCosmetics: EquippedCosmetic[] = [];
  for (const slot of COSMETIC_SLOTS) {
    const def = equipped[slot];
    if (def) {
      equippedCosmetics.push({
        slot,
        name: def.name,
        color: def.preview.color,
        emoji: def.preview.emoji,
      });
    }
  }

  // Rewards is the ownership source for claims. Reuse its collector so the
  // Profile badge includes completed quest periods that are no longer in the
  // active Profile list. If an engagement read fails, keep the Profile load
  // usable and fall back to the current-period counters in the view.
  let claimableRewardCount: number | null = null;
  try {
    claimableRewardCount = (await collectClaimableRewards(db, now)).length;
  } catch (error) {
    console.error("[profile] reward count read failed", error);
  }

  return {
    // Never surface the placeholder profile name: an empty display_name is
    // simply "Player" (never "Local player", lock §2.7).
    displayName: (profile?.displayName ?? "").trim() || "Player",
    balance,
    totalXp: sessionXp + awardsXp,
    claimableRewardCount,
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
    equippedCosmetics,
  };
}

export default function ProfileScreen() {
  const { themeId, setThemeId } = useSettings();
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale >= 1.5;
  const [showMilestones, setShowMilestones] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // 072: `status` distinguishes a failure from "no data yet". The hook already
  // carried `error`, but a screen that only checked `loaded` (and Profile did
  // exactly that for the LOADING case) painted the zeroed fallback — a
  // brand-new player with 0 XP and an empty inventory — while the real read was
  // still in flight.
  const { data, status, retry, hasData } = useDbData(loadProfile, [refreshKey], EMPTY_PROFILE, {
    label: 'profile',
  });

  // Re-sync progression each time the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, []),
  );

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  // Contextual claim counters: surface the single Rewards destination so
  // completed-but-unclaimed work is impossible to miss from the records.
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
  const claimableMilestones = data.milestoneRows.filter(
    ({ reached, claimed }) => reached && !claimed,
  ).length;
  const localPendingRewardCount =
    claimableQuests + claimableAchievements + claimableMilestones;
  const pendingRewardCount =
    data.claimableRewardCount ?? localPendingRewardCount;

  // Next unreached streak milestone, teased in the milestones record.
  const nextMilestone = data.milestoneRows.find((row) => !row.reached) ?? null;

  // In-flight guard per item kind: a fast double tap must not pass the
  // canPurchase balance gate twice and double-charge (the repository also
  // validates balance inside its transaction; this keeps the UX single-shot).
  const buyInFlightRef = useRef<Set<StreakItemKind>>(new Set());

  // 065: one stable economy operation key per user purchase intent. A
  // rejection does not prove the transaction failed (the commit may have
  // landed before a bridge/JS error), so the key survives the failure and the
  // retry reuses it — the economy ledger then returns the original entry
  // instead of debiting a second time. Cleared only on confirmed success, so
  // the next purchase is a new intent with a fresh key.
  const buyIntentRef = useRef<Map<StreakItemKind, string>>(new Map());

  const onBuyStreakItem = async (kind: StreakItemKind) => {
    if (buyInFlightRef.current.has(kind)) {
      return;
    }
    const cost = ITEM_COSTS[kind];
    if (!canPurchase(data.balance, kind, data.profileSettings, new Date())) {
      return;
    }
    buyInFlightRef.current.add(kind);
    let operationId = buyIntentRef.current.get(kind);
    if (operationId === undefined) {
      operationId = `streak-item:${kind}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      buyIntentRef.current.set(kind, operationId);
    }
    try {
      await purchaseStreakItem(getDb(), {
        kind,
        cost,
        operationId,
        reason: `streak-item-${kind}`,
      });
      // Confirmed success: this intent is settled, so a later purchase starts
      // a new one rather than replaying this key.
      buyIntentRef.current.delete(kind);
      refresh();
      celebrateReward({
        title: `${kind} purchased`,
        coins: -cost,
        emoji: "🛡️",
      });
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
  const monogram = data.displayName.charAt(0).toUpperCase() || "P";
  const frameColor =
    data.equippedCosmetics.find((item) => item.slot === "avatarFrame")?.color ??
    theme.accent;
  const protectionCount =
    data.inventory.freeze + data.inventory.shield + data.inventory.recovery;

  // A failed load must not present the zeroed fallback as a new-player profile:
  // show the recoverable error with a retry, matching Home/progress-detail.
  if (status === 'error') {
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
          action={{ label: "Try again", onPress: retry }}
        />
      </ScreenShell>
    );
  }

  // 072: a LOADING state, reusing the shell loading primitive Home already
  // uses. Before this, the first paint was the zeroed fallback — 0 XP, 0 coins,
  // an empty inventory — which is indistinguishable from a genuine new player,
  // so a slow read showed a confident and completely wrong account.
  //
  // `!hasData` is load-bearing: a REFRESH (focus, or a mutation bumping
  // refreshKey) also reports `loading`, and replacing the screen on every
  // refresh would tear down transient UI the refresh itself triggered — a
  // celebration overlay, for instance, which is a regression this was caught
  // introducing.
  if (status === 'loading' && !hasData) {
    return (
      <ScreenShell>
        <ThemedText type="title" testID="profile-title">
          Profile
        </ThemedText>
        <View
          style={styles.loadingBlock}
          testID="profile-loading"
          accessible
          accessibilityLabel="Loading your profile"
        >
          <Skeleton height={Spacing.six * 2} />
          <SkeletonText lines={2} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <Entrance index={0}>
        <View style={styles.headerText}>
          <ThemedText type="title" testID="profile-title">Profile</ThemedText>
          <ThemedText type="bodySmall" themeColor="textSecondary">
            Your training, your preferences.
          </ThemedText>
        </View>
      </Entrance>

      {/* Identity must paint immediately when data arrives, including tab re-entry. */}
      <Entrance index={1} enabled={false}>
        <Card padding="md" testID="profile-identity" style={styles.identityCard}>
          <View style={styles.identityRow}>
            <View
              style={[styles.monogram, { backgroundColor: theme.surfaceSunken, borderColor: frameColor }]}
              accessibilityRole="image"
              accessibilityLabel={data.displayName + " avatar"}>
              <ThemedText type="headline" allowFontScaling={false} aria-hidden>{monogram}</ThemedText>
            </View>
            <View style={styles.identityText}>
              <ThemedText type="headline" testID="profile-name">{data.displayName}</ThemedText>
              <View
                testID="profile-metric-level"
                style={[styles.levelPill, { backgroundColor: theme.xpSoft }]}>
                <ThemedText type="label" themeColor="xpText">Level {level}</ThemedText>
              </View>
            </View>
          </View>
          {hasProgress ? (
            <ProgressBar
              value={levelProgress(data.totalXp)}
              tone="xp"
              valueLabel={formatGoalProgress(xpIntoLevel(data.totalXp), xpForNextLevel(data.totalXp)) + " XP"}
              accessibilityLabel={"Level " + level + " progress: " + formatGoalProgress(xpIntoLevel(data.totalXp), xpForNextLevel(data.totalXp)) + " XP"}
            />
          ) : (
            <ThemedText type="caption" themeColor="textSecondary">
              No XP yet — play a game to start your level.
            </ThemedText>
          )}
          <View testID="profile-metrics" style={[styles.metricStrip, stacked && styles.stack]}>
            <Metric testID="profile-metric-xp" value={compactNumber(data.totalXp)} label="Total XP" />
            <Metric testID="profile-metric-streak" value={String(data.currentStreak)} label="Day streak" />
            <Metric testID="profile-metric-coins" value={compactNumber(data.balance)} label="Coins" />
          </View>
          {data.equippedCosmetics.length > 0 ? (
            <Tappable
              testID="profile-equipped"
              onPress={() => router.replace("/rewards")}
              feedback="tap"
              accessibilityLabel={"Equipped cosmetics: " + data.equippedCosmetics.map((item) => `${item.slot === 'avatarFrame' ? 'Frame' : item.slot === 'accent' ? 'Color' : 'Effect'}: ${item.name}`).join(", ") + ". Opens Rewards"}
              accessibilityHint="Opens Rewards to change your cosmetics"
              style={[styles.equippedRow, { borderTopColor: theme.border }]}
              pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
              <AppIcon name="layers" size={18} />
              <ThemedText type="caption" themeColor="textSecondary" style={styles.flexText}>
                {data.equippedCosmetics.map((item) => `${item.slot === 'avatarFrame' ? 'Frame' : item.slot === 'accent' ? 'Color' : 'Effect'}: ${item.name}`).join(" · ")}
              </ThemedText>
              <AppIcon name="chevron" size={18} />
            </Tappable>
          ) : null}
        </Card>
      </Entrance>

      {/* Preferences precede every progression list, including on populated profiles. */}
      <View style={styles.preferences} testID="profile-preferences">
        <Card variant="outlined" padding="md" testID="theme-card" style={styles.settingsCard}>
          <View style={styles.sectionHeading}>
            <AppIcon name="settings" tone="accent" />
            <ThemedText type="subtitle" accessibilityRole="header">Appearance</ThemedText>
          </View>
          <View style={styles.themeOptions}>
            {THEME_OPTIONS.map((option) => {
              const selected = option.id === themeId;
              return (
                <View key={option.id} testID={"theme-option-" + option.id}
                  style={stacked ? styles.fullWidth : styles.themeOptionCell}>
                  <Tappable
                    onPress={() => onSelectTheme(option)}
                    testID={"profile-settings-theme-" + option.id}
                    accessibilityLabel={"Theme " + option.label + (selected ? ", active" : "")}
                    accessibilityState={{ selected }}
                    style={[
                      styles.themeOption,
                      { backgroundColor: selected ? theme.accentSoft : theme.surface,
                        borderColor: selected ? theme.accent : theme.border },
                    ]}
                    pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
                    <AppIcon name={option.mode === "dark" ? "moon" : option.mode === "light" ? "sun" : "settings"}
                      size={18} tone={selected ? "accentText" : "textSecondary"} />
                    <ThemedText type="label" themeColor={selected ? "accentText" : "text"}>{option.label}</ThemedText>
                  </Tappable>
                </View>
              );
            })}
          </View>
        </Card>
        <View testID="profile-sensory-card">
          <SensorySettingsCard title="Sound & feel" />
        </View>
        <Tappable
          testID="profile-data-management"
          onPress={() => router.replace("/data-management")}
          accessibilityLabel="Data Management. Backup, restore, and delete your local training data"
          accessibilityHint="Opens data management"
          style={[styles.destination, { backgroundColor: theme.surface, borderColor: theme.border }]}
          pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
          <AppIcon name="save" tone="accent" />
          <View style={styles.flexText}>
            <ThemedText type="bodyLarge">Your data</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">Saved on this device. Backup, restore or delete.</ThemedText>
          </View>
          <AppIcon name="chevron" />
        </Tappable>
      </View>

      <View testID="profile-rewards">
        <View testID="profile-rewards-entry">
          <Tappable
            testID="profile-cosmetics"
            onPress={() => router.replace("/rewards")}
            accessibilityLabel="Open Rewards. Claim rewards and manage cosmetics"
            accessibilityHint="Opens the single place to claim rewards and manage cosmetics"
            style={[styles.destination, { backgroundColor: theme.surface, borderColor: theme.border }]}
            pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
            <AppIcon name="layers" tone="accent" />
            <View style={styles.flexText}>
              <ThemedText type="bodyLarge">Open Rewards</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {pendingRewardCount > 0 ? "Claim earned rewards and choose your cosmetics." : "Your collection and reward history."}
              </ThemedText>
              <ThemedText type="caption" themeColor={pendingRewardCount > 0 ? "warningText" : "textSecondary"}
                testID="profile-rewards-pending">
                {pendingRewardCount > 0 ? pendingRewardCount + " ready" : "No rewards waiting"}
              </ThemedText>
            </View>
            <AppIcon name="chevron" />
          </Tappable>
        </View>
      </View>

      <View style={styles.section} testID="profile-streak">
        <View style={styles.sectionHeading}>
          <AppIcon name="streak" tone="streakText" />
          <ThemedText type="subtitle" accessibilityRole="header">Streak & protection</ThemedText>
        </View>
        <View style={[styles.railRow, stacked && styles.stack]}>
          <StreakStrip count={data.currentStreak} days={7} testID="profile-streak-week" />
          <ThemedText type="caption" themeColor="textSecondary">
            {"Best " + data.longestStreak + " days · " + protectionCount + " protection items"}
          </ThemedText>
        </View>
        {data.atRisk ? (
          <View style={[styles.atRiskBand, { backgroundColor: theme.warningSoft }]}
            testID="profile-streak-at-risk" accessibilityLiveRegion="polite">
            <AppIcon name="info" size={18} tone="warningText" />
            <ThemedText type="caption" themeColor="warningText" style={styles.flexText}>
              Your streak is at risk — play today to keep it alive.
            </ThemedText>
          </View>
        ) : null}
        {STREAK_ITEMS.map((item) => {
          const canApply = item.kind === "freeze"
            ? canApplyFreeze(data.streakState, data.profileSettings, new Date())
            : item.kind === "recovery"
              ? canApplyRecovery(data.streakState, data.profileSettings, new Date())
              : canApplyShield(data.streakState, data.profileSettings, new Date());
          const itemTone = ITEM_TONES[item.kind];
          return (
            <View key={item.kind} style={[styles.protectionItem, { borderTopColor: theme.border }]}>
              <View style={styles.itemHeading}>
                <View style={[styles.itemIcon, { backgroundColor: theme[itemTone.soft] }]}>
                  <AppIcon name={item.kind === "recovery" ? "retry" : "shield"} size={18} tone={itemTone.ink} />
                </View>
                <View style={styles.flexText}>
                  <ThemedText type="bodyLarge">{item.label + " × " + data.inventory[item.kind]}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">{item.caption}</ThemedText>
                </View>
              </View>
              <View style={styles.itemActions}>
                {canApply ? (
                  <Button label="Apply" size="sm" variant="secondary" fullWidth={false}
                    testID={"streak-apply-" + item.kind} accessibilityLabel={"Apply " + item.label}
                    onPress={() => onApplyStreakItem(item.kind)} />
                ) : null}
                <Button label={ITEM_COSTS[item.kind] + " coins"} size="sm" variant="secondary" fullWidth={false}
                  testID={"streak-buy-" + item.kind}
                  accessibilityLabel={"Buy " + item.label + " for " + ITEM_COSTS[item.kind] + " coins"}
                  disabled={!canPurchase(data.balance, item.kind, data.profileSettings, new Date())}
                  onPress={() => { void onBuyStreakItem(item.kind); }} />
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.section} testID="profile-records">
        <ThemedText type="subtitle" accessibilityRole="header">Training goals</ThemedText>
        <ExpandableSection title="Streak milestones" testID="profile-milestones" icon="streak"
          summary={nextMilestone ? nextMilestone.remaining + " days to " + nextMilestone.milestone.label : "Your streak milestones"}
          expanded={showMilestones} onToggle={() => setShowMilestones((shown) => !shown)}>
          {data.milestoneRows.map(({ milestone, reached, claimed, remaining }, index) => {
            const readout = formatGoalProgress(data.longestStreak, milestone.days) + " days";
            return (
              <RecordRow key={milestone.id} testID={"profile-milestone-" + milestone.id} title={milestone.label}
                meter={<ProgressBar value={milestone.days <= 0 ? 1 : Math.min(data.longestStreak / milestone.days, 1)}
                  tone="streak" valueLabel={readout} accessibilityLabel={milestone.label + ", " + readout} />}
                hint={milestone.description
                  + (milestone.rewardXp || milestone.rewardCurrency ? " · +" + (milestone.rewardXp ?? 0) + " XP / +" + (milestone.rewardCurrency ?? 0) + " coins" : "")
                  + (!reached && remaining > 0 ? " · " + remaining + " days to go" : "")
                  + (reached && !claimed ? " · Complete — available in Rewards" : "")
                  + (claimed ? " · Claimed" : "")}
                badge={reached && !claimed ? <Badge tone="accent" label="In Rewards" size="sm" />
                  : claimed ? <Badge tone="success" label="Claimed" size="sm" /> : undefined}
                divider={index < data.milestoneRows.length - 1} />
            );
          })}
        </ExpandableSection>

        <ExpandableSection title="Quests" testID="profile-quests" icon="target"
          summary={data.questEvals.length + " active" + (claimableQuests > 0 ? " · " + claimableQuests + " ready in Rewards" : "")}
          expanded={showQuests} onToggle={() => setShowQuests((shown) => !shown)}>
          {claimableQuests > 0 ? (
            <ThemedText type="caption" themeColor="warningText" testID="profile-quests-ready" accessibilityLiveRegion="polite">
              {claimableQuests + " quest reward" + (claimableQuests === 1 ? "" : "s") + " available in Rewards."}
            </ThemedText>
          ) : null}
          {data.questEvals.length === 0 ? (
            <ThemedText type="bodySmall" themeColor="textSecondary">Quests appear as you play.</ThemedText>
          ) : data.questEvals.map((evaluation, index) => {
            const row = data.questRows.get(evaluation.questId);
            const claimed = row?.claimedAt != null;
            const completed = evaluation.completed || row?.completedAt != null;
            const definition = QUEST_DEFINITIONS_V1.find((candidate) => candidate.id === evaluation.questId);
            const title = definition?.title ?? evaluation.questId;
            const progress = evaluation.goal <= 0 ? evaluation.completed ? 1 : 0 : Math.min(evaluation.progress / evaluation.goal, 1);
            const readout = formatGoalProgress(evaluation.progress, evaluation.goal, "count");
            return (
              <RecordRow key={evaluation.questId} testID={"profile-quest-" + evaluation.questId} title={title}
                meter={<ProgressBar value={progress} valueLabel={readout} accessibilityLabel={title + ", " + readout} />}
                hint={claimed ? "Claimed" : completed ? "Complete — available in Rewards" : "In progress"}
                badge={completed && !claimed && definition ? <Badge tone="accent" label="In Rewards" size="sm" />
                  : claimed ? <Badge tone="success" label="Claimed" size="sm" /> : undefined}
                divider={index < data.questEvals.length - 1} />
            );
          })}
        </ExpandableSection>

        <ExpandableSection title="Achievements" testID="profile-achievements" icon="award"
          summary={data.unlocks.size + " unlocked of " + ACHIEVEMENT_DEFINITIONS_V1.length
            + (claimableAchievements > 0 ? " · " + claimableAchievements + " ready in Rewards" : "")}
          expanded={showAchievements} onToggle={() => setShowAchievements((shown) => !shown)}>
          {claimableAchievements > 0 ? (
            <ThemedText type="caption" themeColor="warningText" testID="profile-achievements-ready" accessibilityLiveRegion="polite">
              {claimableAchievements + " achievement reward" + (claimableAchievements === 1 ? "" : "s") + " available in Rewards."}
            </ThemedText>
          ) : null}
          {ACHIEVEMENT_DEFINITIONS_V1.map((definition, index) => {
            const unlock = data.unlocks.get(definition.id);
            const claimed = unlock?.claimedAt != null;
            const unlocked = unlock != null;
            const evaluated = data.achievementProgress.get(definition.id);
            const progress = evaluated?.progress ?? (unlocked ? 1 : 0);
            const goal = evaluated?.goal ?? 1;
            const ratio = evaluated?.ratio ?? (unlocked ? 1 : 0);
            const unit = definition.criteria.type === "best-normalized" ? "percent" : "count";
            const readout = formatGoalProgress(progress, goal, unit);
            return (
              <RecordRow key={definition.id} testID={"profile-achievement-" + definition.id} title={definition.title}
                meter={progress > 0 || unlocked ? (
                  <ProgressBar value={ratio} valueLabel={readout} accessibilityLabel={definition.title + ", " + readout} />
                ) : undefined}
                hint={definition.description + " · " + (claimed ? "Claimed" : unlocked
                  ? "Unlocked — available in Rewards" : progress > 0 ? "In progress — locked" : "Locked")}
                badge={unlocked && !claimed ? <Badge tone="accent" label="In Rewards" size="sm" />
                  : claimed ? <Badge tone="success" label="Claimed" size="sm" /> : undefined}
                divider={index < ACHIEVEMENT_DEFINITIONS_V1.length - 1} />
            );
          })}
        </ExpandableSection>
      </View>

      <RewardCelebrationHost />
    </ScreenShell>
  );
}

/** Small identity facts retain full labels and the established automation IDs. */
function Metric({ value, label, testID }: { value: string; label: string; testID?: string }) {
  return (
    <View testID={testID} style={styles.metric}>
      <ThemedText type="bodyLarge">{value}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">{label}</ThemedText>
    </View>
  );
}

/** A deliberate disclosure keeps growing record lists out of the settings path. */
function ExpandableSection({ title, summary, icon, testID, expanded, onToggle, children }: {
  title: string; summary: string; icon: AppIconName; testID: string;
  expanded: boolean; onToggle: () => void; children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card variant="outlined" padding="md" testID={testID} style={styles.section}>
      <Tappable testID={testID + "-toggle"} onPress={onToggle}
        accessibilityLabel={title + ". " + summary}
        accessibilityHint={expanded ? "Hide these records" : "Show these records"}
        accessibilityState={{ expanded }}
        style={styles.disclosureHeading}
        pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
        <AppIcon name={icon} tone="accent" />
        <View style={styles.flexText}>
          <ThemedText type="bodyLarge">{title}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">{summary}</ThemedText>
        </View>
        <AppIcon name={expanded ? "expand" : "chevron"} />
      </Tappable>
      {expanded ? <View style={[styles.records, { borderTopColor: theme.border }]}>{children}</View> : null}
    </Card>
  );
}

function RecordRow({ testID, title, meter, hint, badge, divider = false }: {
  testID: string; title: string; meter?: ReactNode; hint: string; badge?: ReactNode; divider?: boolean;
}) {
  const theme = useTheme();
  return (
    <View testID={testID} style={[styles.recordRow,
      divider ? { borderBottomWidth: HAIRLINE, borderBottomColor: theme.border } : null]}>
      <ThemedText type="bodyLarge">{title}</ThemedText>
      {meter}
      <ThemedText type="caption" themeColor="textSecondary">{hint}</ThemedText>
      {badge ? <View style={styles.recordBadge}>{badge}</View> : null}
    </View>
  );
}

/** Compact XP/coin display so a large balance cannot break the identity strip. */
function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + "M";
  if (Math.abs(value) >= 1e5) return Math.round(value / 1e3) + "k";
  return String(Math.round(value));
}

const styles = StyleSheet.create({
  headerText: { gap: Spacing.half },
  loadingBlock: { gap: Spacing.two },
  identityCard: { gap: Spacing.two },
  identityRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  monogram: { width: 48, height: 48, borderRadius: Radii.pill, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  identityText: { flex: 1, gap: Spacing.one },
  levelPill: { alignSelf: "flex-start", borderRadius: Radii.pill, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  metricStrip: { flexDirection: "row", gap: Spacing.two },
  metric: { flex: 1, gap: Spacing.half },
  stack: { flexDirection: "column", alignItems: "stretch" },
  flexText: { flex: 1, minWidth: 0, gap: Spacing.half },
  equippedRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one, minHeight: MIN_TOUCH_TARGET, borderTopWidth: HAIRLINE, paddingTop: Spacing.one },
  preferences: { gap: Spacing.three },
  section: { gap: Spacing.two },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: Spacing.oneHalf },
  settingsCard: { gap: Spacing.two },
  themeOptions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.one },
  themeOptionCell: { flexBasis: "30%", flexGrow: 1, minWidth: 84 },
  fullWidth: { width: "100%" },
  themeOption: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.one, minHeight: MIN_TOUCH_TARGET, borderWidth: 1, borderRadius: Radii.pill, paddingHorizontal: Spacing.one, paddingVertical: Spacing.one },
  destination: { flexDirection: "row", alignItems: "center", gap: Spacing.two, minHeight: MIN_TOUCH_TARGET, borderWidth: HAIRLINE, borderRadius: Radii.medium, padding: Spacing.two },
  railRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  atRiskBand: { flexDirection: "row", alignItems: "center", gap: Spacing.one, borderRadius: Radii.small, padding: Spacing.two },
  protectionItem: { borderTopWidth: HAIRLINE, paddingTop: Spacing.two, gap: Spacing.two },
  itemHeading: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  itemIcon: { width: 36, height: 36, borderRadius: Radii.medium, alignItems: "center", justifyContent: "center" },
  itemActions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, minHeight: MIN_TOUCH_TARGET },
  disclosureHeading: { flexDirection: "row", alignItems: "center", gap: Spacing.two, minHeight: MIN_TOUCH_TARGET },
  records: { borderTopWidth: HAIRLINE },
  recordRow: { gap: Spacing.one, minHeight: MIN_TOUCH_TARGET, paddingVertical: Spacing.two },
  recordBadge: { alignSelf: "flex-start" },
});
