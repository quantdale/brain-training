/**
 * Profile — player identity, records and quiet settings (campaign 055).
 *
 * Campaign 052: identity dissolved into a long record/settings document of
 * stacked stat cards. The refinement lock (§2.7) makes the first viewport a
 * player card: monogram plate + name (`display_name` or "Player") + level
 * emblem + XP progress + streak rail + equipped cosmetic chips, with an
 * on-device honesty line. Motivation, milestones, quests and achievements
 * follow in Report grammar; data and settings become quiet entry rows.
 *
 * All economy behaviour is untouched: streak item purchase/apply still flows
 * through the idempotent repositories, rewards stay owned by `/rewards`, and
 * every existing testID/accessibility seam is preserved.
 *
 * Change 076 (Training-Studio lock, REFERENCE_LOCK.md): the player card is the
 * screen's one focal object and moves onto the immersive stage panel — white
 * instrument numerals, translucent stage wells. Quests/achievements/cosmetics
 * become numbered hairline fact rows (lock §8); theme/settings become quiet
 * bordered rows. Red appears only as identity tones, never an action fill
 * (this screen has no primary action). Semantics and data flow are unchanged.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { useSettings } from "@/components/settings/settings-provider";
import { SensorySettingsCard } from "@/components/sensory/sensory-settings-card";
import { ThemedText } from "@/components/themed-text";
import { StateCard } from "@/components/shell";
import { Report, ReportRow } from "@/components/ui/report";
import { Radii, Spacing, type ThemeColor } from "@/constants/theme";
import { MIN_TOUCH_TARGET } from "@/components/a11y";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { useTheme } from "@/hooks/use-theme";
import {
  Badge,
  Button,
  Card,
  Entrance,
  HAIRLINE,
  ListRow,
  ProgressBar,
  Spark,
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

/** Stage-panel surface language (REFERENCE_LOCK §7): the same translucent
 *  white ramp the shared stage chrome (SessionHeader) uses, so screen-local
 *  stage content never invents a new opacity step. */
const STAGE_WELL = "rgba(255, 255, 255, 0.08)";
const STAGE_LINE = "rgba(255, 255, 255, 0.28)";

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
          <ThemedText type="eyebrow" themeColor="textMuted">
            PLAYER
          </ThemedText>
          <ThemedText type="title" testID="profile-title">
            Profile
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Your level, streak, rewards and settings.
          </ThemedText>
        </View>
      </Entrance>

      {/* The screen's one focal object: the player card on the immersive stage
          (REFERENCE_LOCK §1/§7) — white instrument numerals, translucent stage
          wells. Level/XP/streak read as identity attributes here, not four
          equal stat tiles. */}
      <Entrance index={1}>
        <Card variant="stage" padding="lg" testID="profile-identity">
          <View style={styles.identityRow}>
            <View
              style={[
                styles.monogram,
                {
                  backgroundColor: STAGE_WELL,
                  borderColor: frameColor,
                },
              ]}
              accessibilityRole="image"
              accessibilityLabel={`${data.displayName} avatar`}
            >
              <ThemedText
                type="headline"
                themeColor="stageInk"
                allowFontScaling={false}
                aria-hidden
              >
                {monogram}
              </ThemedText>
            </View>
            <View style={styles.identityText}>
              <ThemedText
                type="headline"
                themeColor="stageInk"
                numberOfLines={1}
                testID="profile-name"
              >
                {data.displayName}
              </ThemedText>
              <ThemedText
                type="caption"
                themeColor="stageInk"
                style={styles.stageCaption}
              >
                Your training record is saved on this device.
              </ThemedText>
            </View>
          </View>

          <View style={styles.levelRow}>
            <View
              testID="profile-metric-level"
              style={[styles.levelPill, { backgroundColor: theme.xp }]}
            >
              <ThemedText type="label" themeColor="xpOn">
                Level {level}
              </ThemedText>
            </View>
            <View style={styles.levelProgress}>
              {hasProgress ? (
                <ProgressBar
                  value={levelProgress(data.totalXp)}
                  tone="xp"
                  valueLabel={`${xpIntoLevel(data.totalXp)} of ${xpForNextLevel(data.totalXp)} XP`}
                  accessibilityLabel={`Level ${level} progress: ${xpIntoLevel(data.totalXp)} of ${xpForNextLevel(data.totalXp)} XP`}
                />
              ) : (
                <ThemedText
                  type="caption"
                  themeColor="stageInk"
                  style={styles.stageCaption}
                >
                  No XP yet — play a game to start your level.
                </ThemedText>
              )}
            </View>
          </View>

          {/* Instrument row (lock §1): white tabular numerals over translucent
              stage separators — the metric strip IS the identity instrument. */}
          <View style={styles.metricStrip}>
            <Metric
              testID="profile-metric-xp"
              value={compactNumber(data.totalXp)}
              label="Total XP"
            />
            <View
              style={[styles.metricDivider, { backgroundColor: STAGE_LINE }]}
            />
            <Metric
              testID="profile-metric-streak"
              value={`${data.currentStreak}`}
              label="Day streak"
            />
            <View
              style={[styles.metricDivider, { backgroundColor: STAGE_LINE }]}
            />
            <Metric
              testID="profile-metric-coins"
              value={compactNumber(data.balance)}
              label="Coins"
            />
          </View>

          <View style={styles.railRow}>
            <StreakStrip
              count={data.currentStreak}
              days={7}
              testID="profile-streak-week"
            />
            {data.atRisk ? (
              <Badge tone="warning" label="At risk" size="sm" />
            ) : null}
          </View>

          {data.atRisk ? (
            /* Feedback band (lock §6): warning soft fill carries the tone with
               text + glyph, legible on the stage in both schemes. */
            <View
              style={[styles.atRiskBand, { backgroundColor: theme.warningSoft }]}
              testID="profile-streak-at-risk"
              accessibilityLiveRegion="polite"
            >
              <ThemedText type="caption" themeColor="warningSoftText">
                ⚠ Your streak is at risk — play today to keep it alive.
              </ThemedText>
            </View>
          ) : null}

          {data.equippedCosmetics.length > 0 ? (
            <Tappable
              testID="profile-equipped"
              onPress={() => router.replace("/rewards")}
              feedback="tap"
              accessibilityLabel={`Equipped cosmetics: ${data.equippedCosmetics
                .map((item) => item.name)
                .join(", ")}. Opens Rewards`}
              accessibilityHint="Opens Rewards to change your cosmetics"
              style={styles.equippedRow}
              pressedStyle={{ backgroundColor: STAGE_WELL }}>
              <ThemedText
                type="caption"
                themeColor="stageInk"
                style={styles.stageCaption}>
                Equipped
              </ThemedText>
              {data.equippedCosmetics.map((item) => (
                <View
                  key={item.slot}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: STAGE_WELL,
                      borderColor: STAGE_LINE,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.chipObject,
                      { backgroundColor: item.color ?? theme.accent },
                    ]}
                  />
                  <ThemedText type="caption" themeColor="stageInk">
                    {item.name}
                  </ThemedText>
                </View>
              ))}
              <ThemedText
                type="body"
                themeColor="stageInk"
                style={styles.stageCaption}
                aria-hidden
              >
                {"›"}
              </ThemedText>
            </Tappable>
          ) : null}
        </Card>
      </Entrance>

      {/* Streak protection: the controls that use coins and inventory. The
          records below stay borderless with hairline rows (Report grammar). */}
      <Entrance index={2}>
        <Report title="Streak" testID="profile-streak">
          <ReportRow
            label="Longest streak"
            value={`${data.longestStreak} days`}
            valueTone="streakText"
            divider
          />
          <ReportRow
            label="Protection items"
            value={`${protectionCount}`}
            valueTone="infoText"
            divider
          />
          {STREAK_ITEMS.map((item, index) => {
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
              <ReportRow
                key={item.kind}
                icon={
                  <View
                    style={[
                      styles.itemIcon,
                      { backgroundColor: theme[itemTone.soft] },
                    ]}
                  >
                    <Spark size={16} color={theme[itemTone.ink]} />
                  </View>
                }
                label={`${item.label} × ${data.inventory[item.kind]}`}
                hint={item.caption}
                accessibilityLabel={`${item.label}: ${data.inventory[item.kind]} owned. ${item.caption}`}
                divider={index < STREAK_ITEMS.length - 1}
                trailing={
                  <View style={styles.itemActions}>
                    {canApply ? (
                      <Button
                        label="Apply"
                        size="sm"
                        variant="secondary"
                        fullWidth={false}
                        testID={`streak-apply-${item.kind}`}
                        accessibilityLabel={`Apply ${item.label}`}
                        onPress={() => onApplyStreakItem(item.kind)}
                      />
                    ) : null}
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
                      onPress={() => {
                        // Fire-and-forget: the handler owns its async failure
                        // surface, and returning the promise would make the
                        // test harness adopt an in-flight purchase.
                        void onBuyStreakItem(item.kind);
                      }}
                    />
                  </View>
                }
              />
            );
          })}
        </Report>
      </Entrance>

      {/* Streak milestones are motivation evidence; Rewards owns the claim. */}
      <Entrance index={3}>
        <Report title="Streak milestones" testID="profile-milestones">
          {nextMilestone ? (
            <ReportRow
              label="Next milestone"
              value={nextMilestone.milestone.label}
              hint={`${nextMilestone.remaining} days to go`}
              divider
            />
          ) : null}
          {data.milestoneRows.map(
            ({ milestone, reached, claimed, remaining }, index) => (
              <RecordRow
                key={milestone.id}
                testID={`profile-milestone-${milestone.id}`}
                index={index}
                title={milestone.label}
                meter={
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
                }
                hint={`${milestone.description}${
                  milestone.rewardXp || milestone.rewardCurrency
                    ? ` · +${milestone.rewardXp ?? 0} XP / +${milestone.rewardCurrency ?? 0} coins`
                    : ""
                }${
                  !reached && remaining > 0 ? ` · ${remaining} days to go` : ""
                }${reached && !claimed ? " · Complete — available in Rewards" : ""}${
                  claimed ? " · ✓ Claimed" : ""
                }`}
                badge={
                  reached && !claimed ? (
                    <Badge tone="accent" label="In Rewards" size="sm" />
                  ) : claimed ? (
                    <Badge tone="success" label="✓ Claimed" size="sm" />
                  ) : null
                }
                divider={index < data.milestoneRows.length - 1}
              />
            ),
          )}
        </Report>
      </Entrance>

      {/* Quests — live progress; the once-only claim lives in Rewards. */}
      <Entrance index={4}>
        <Report title="Quests" testID="profile-quests">
          {claimableQuests > 0 ? (
            <ThemedText
              type="caption"
              themeColor="warningText"
              testID="profile-quests-ready"
              accessibilityLiveRegion="polite"
              style={styles.readyLine}
            >
              {claimableQuests} quest reward{claimableQuests === 1 ? "" : "s"}{" "}
              available in Rewards.
            </ThemedText>
          ) : null}
          {data.questEvals.length === 0 ? (
            <ReportRow
              label="No quests yet"
              hint="Quests appear as you play."
            />
          ) : (
            data.questEvals.map((evaluation, index) => {
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
                <RecordRow
                  key={evaluation.questId}
                  testID={`profile-quest-${evaluation.questId}`}
                  index={index}
                  title={definition?.title ?? evaluation.questId}
                  meter={
                    <ProgressBar
                      value={progress}
                      valueLabel={`${shown}/${evaluation.goal}`}
                      accessibilityLabel={`${definition?.title ?? evaluation.questId}, ${shown} of ${evaluation.goal}`}
                    />
                  }
                  hint={
                    claimed
                      ? "✓ Claimed"
                      : completed
                        ? "Complete — available in Rewards"
                        : "In progress"
                  }
                  badge={
                    completed && !claimed && definition ? (
                      <Badge tone="accent" label="In Rewards" size="sm" />
                    ) : claimed ? (
                      <Badge tone="success" label="✓ Claimed" size="sm" />
                    ) : null
                  }
                  divider={index < data.questEvals.length - 1}
                />
              );
            })
          )}
        </Report>
      </Entrance>

      {/* Achievements — unlocked vs in-progress vs locked treatments. */}
      <Entrance index={5}>
        <Report title="Achievements" testID="profile-achievements">
          {claimableAchievements > 0 ? (
            <ThemedText
              type="caption"
              themeColor="warningText"
              testID="profile-achievements-ready"
              accessibilityLiveRegion="polite"
              style={styles.readyLine}
            >
              {claimableAchievements} achievement reward
              {claimableAchievements === 1 ? "" : "s"} available in Rewards.
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
            return (
              <RecordRow
                key={definition.id}
                testID={`profile-achievement-${definition.id}`}
                index={index}
                title={`${!unlocked ? "🔒 " : ""}${definition.title}`}
                titleTone={unlocked || claimed ? "text" : "textMuted"}
                meter={
                  progress > 0 || unlocked ? (
                    <ProgressBar
                      value={ratio}
                      valueLabel={`${Math.min(progress, goal)}/${goal}`}
                      accessibilityLabel={`${definition.title}, ${Math.min(progress, goal)} of ${goal}`}
                    />
                  ) : undefined
                }
                hint={`${definition.description} · ${
                  claimed
                    ? "✓ Claimed"
                    : unlocked
                      ? "Unlocked — available in Rewards"
                      : progress > 0
                        ? "In progress — locked"
                        : "Locked"
                }`}
                badge={
                  unlocked && !claimed ? (
                    <Badge tone="accent" label="In Rewards" size="sm" />
                  ) : claimed ? (
                    <Badge tone="success" label="✓ Claimed" size="sm" />
                  ) : null
                }
                divider={index < ACHIEVEMENT_DEFINITIONS_V1.length - 1}
              />
            );
          })}
        </Report>
      </Entrance>

      {/* Rewards owns all claim actions, cosmetics and reward history. Profile
          keeps a single quiet entry row plus a live pending count. */}
      <Entrance index={6}>
        <Report title="Rewards" testID="profile-rewards">
          <View testID="profile-rewards-entry">
            <ListRow
              title="Open Rewards"
              subtitle={
                pendingRewardCount > 0
                  ? `${pendingRewardCount} ready to claim · Manage cosmetics and reward history`
                  : "No rewards waiting · Manage cosmetics and reward history"
              }
              meta={
                pendingRewardCount > 0 ? `${pendingRewardCount} ready` : "Open"
              }
              metaTestID="profile-rewards-pending"
              icon={<Spark size={16} color={theme.currencyText} />}
              tone="currencySoft"
              onPress={() => router.replace("/rewards")}
              // Preserve the established automation seam while the row's
              // visible ownership language stays player-facing.
              testID="profile-cosmetics"
              accessibilityLabel="Open Rewards. Claim rewards and manage cosmetics"
              accessibilityHint="Opens the single place to claim rewards and manage cosmetics"
            />
          </View>
        </Report>
      </Entrance>

      {/* Data portability — export / import / wipe (Session 05). A quiet
          entry row: the destination speaks for itself, no identity chrome. */}
      <Entrance index={7}>
        <Report title="Your data">
          <ReportRow
            label="Data Management"
            hint="Backup, restore, and delete your local training data"
            onPress={() => router.replace("/data-management")}
            testID="profile-data-management"
          />
        </Report>
      </Entrance>

      {/* Theme selection (theme registry seam) — quiet bordered settings card
          (lock §5 secondary): hairline-separated rows inside one border, no
          elevation, no identity chrome. */}
      <Entrance index={8}>
        <Card
          variant="outlined"
          padding="lg"
          testID="theme-card"
          style={styles.settingsCard}
        >
          <ThemedText type="eyebrow" themeColor="textMuted">
            THEME
          </ThemedText>
          <View>
            {THEME_OPTIONS.map((option, index) => {
              const selected = option.id === themeId;
              return (
                <View key={option.id} testID={`theme-option-${option.id}`}>
                  <ReportRow
                    label={option.label}
                    hint={selected ? "Active" : option.mode}
                    icon={
                      <Spark
                        size={14}
                        color={selected ? theme.accentOn : theme.textMuted}
                      />
                    }
                    trailing={
                      selected ? (
                        <Badge tone="success" label="✓ Active" size="sm" />
                      ) : undefined
                    }
                    onPress={() => onSelectTheme(option)}
                    testID={`profile-settings-theme-${option.id}`}
                    accessibilityLabel={`Theme ${option.label}${selected ? ", active" : ""}`}
                    divider={index < THEME_OPTIONS.length - 1}
                  />
                </View>
              );
            })}
          </View>
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

/**
 * One identity attribute in the player card's instrument strip (lock §1):
 * white tabular numeral over a tracked uppercase metric label, separated by
 * translucent stage hairlines — an instrument reading, not a tile.
 */
function Metric({
  value,
  label,
  testID,
}: {
  value: string;
  label: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.metric}>
      <ThemedText type="numeral" themeColor="stageInk">
        {value}
      </ThemedText>
      <ThemedText
        type="caption"
        themeColor="stageInk"
        style={styles.metricLabel}
      >
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * One progress record inside a Report. `ReportRow` has no meter slot, so the
 * meterized rows (milestones, quests, achievements) share this local row that
 * keeps the same hairline grammar and 44 dp floor. When `index` is given the
 * row carries the lock §8 numbered marker (`01`, `02`…) — quiet, credible
 * ordering for secondary reports.
 */
function RecordRow({
  testID,
  index,
  title,
  titleTone = "text",
  meter,
  hint,
  badge,
  divider = false,
}: {
  testID: string;
  index?: number;
  title: string;
  titleTone?: ThemeColor;
  meter?: ReactNode;
  hint: string;
  badge?: ReactNode;
  divider?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.recordRow,
        divider
          ? { borderBottomWidth: HAIRLINE, borderBottomColor: theme.border }
          : null,
      ]}
    >
      {index !== undefined ? (
        <ThemedText
          type="caption"
          themeColor="textMuted"
          style={styles.recordIndex}
        >
          {String(index + 1).padStart(2, "0")}
        </ThemedText>
      ) : null}
      <View style={styles.recordText}>
        <ThemedText type="bodySmall" themeColor={titleTone}>
          {title}
        </ThemedText>
        {meter}
        <ThemedText type="caption" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </View>
      {badge ? <View style={styles.recordBadge}>{badge}</View> : null}
    </View>
  );
}

/** Compact XP/coin display so a large balance cannot break the identity strip. */
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
  headerText: {
    gap: Spacing.half,
  },
  // 072: spacing for the loading block, matching Home's shell loading
  // primitive so both screens read identically while data settles.
  loadingBlock: {
    gap: Spacing.two,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  monogram: {
    width: 64,
    height: 64,
    borderRadius: Radii.pill,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  levelPill: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.one,
  },
  levelProgress: {
    flex: 1,
  },
  metricStrip: {
    flexDirection: "row",
    alignItems: "center",
  },
  metric: {
    flex: 1,
    gap: Spacing.half,
    alignItems: "flex-start",
  },
  // Metric label language (lock §2): uppercase + tracking, dimmed on stage.
  // The text content itself keeps its original casing (test contract reads
  // e.g. "50Coins"); the transform is purely visual.
  metricLabel: {
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.68,
  },
  // Secondary copy on the stage panel: stage ink dimmed instead of a second
  // grey (lock §7 — the stage reads in white type).
  stageCaption: {
    opacity: 0.68,
  },
  atRiskBand: {
    borderRadius: Radii.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.oneHalf,
  },
  metricDivider: {
    width: HAIRLINE,
    alignSelf: "stretch",
    marginHorizontal: Spacing.two,
  },
  railRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  equippedRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.oneHalf,
    minHeight: MIN_TOUCH_TARGET,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    borderWidth: HAIRLINE,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipObject: {
    width: 14,
    height: 14,
    borderRadius: Radii.extraSmall,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: Radii.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  itemActions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  readyLine: {
    paddingVertical: Spacing.one,
  },
  settingsCard: {
    gap: Spacing.two,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: Spacing.two,
  },
  // Lock §8 numbered marker: fixed-width so values align down the column.
  recordIndex: {
    minWidth: 22,
    fontVariant: ["tabular-nums"],
  },
  recordText: {
    flex: 1,
    gap: Spacing.one,
  },
  recordBadge: {
    alignItems: "flex-end",
    flexShrink: 0,
  },
});
