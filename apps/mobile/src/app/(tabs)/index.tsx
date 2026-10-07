/**
 * Home — dashboard (Wave 1 shell + WP-2H + campaign 003 personalization).
 *
 * Static slots per PROJECT_CONSTITUTION §13, in first-viewport order:
 * Today's Workout CTA, streak/XP/level stats, recent games. The workout is a
 * deterministic daily 4-game selection personalized with weak-domain
 * balancing + recency avoidance (src/workout/personalize.ts); rerolls follow
 * §14 economics — first free, then escalating coin costs (ledger-debited).
 * Streak/XP/level read real persisted data when the db is available and
 * degrade to placeholders otherwise. Slot testIDs are the stable QA contract.
 *
 * W13 UX wave: focus-refresh so returning from a game updates every slot,
 * an explicit Continue-workout CTA at the resume position, a workout
 * completion bar, quick-action drills (games/progress/rewards), coin balance
 * surfacing, relative-day recency labels on recent sessions, and explicit
 * loading/error states. The first-run/empty-state render tree is kept stable
 * for the visual-baseline canary snapshots.
 *
 * W24 wave: Workout V2 surfacing — a secondary "More workouts" section that
 * starts focus/length-template workouts through `useWorkoutTemplates` (the
 * daily flow above stays primary), a post-workout completion summary card,
 * a compact workout-history feed over the engine's history API, and a
 * read-only claimable-rewards hint on the Rewards quick action (W12 inbox).
 * All W24 additions are gated behind loaded data so first-run trees stay
 * unchanged for the visual-baseline canaries.
 *
 * Campaign 012 (W07) wave: the More-workouts picker gains a selected-template
 * detail panel (explicit length line + durable "2 of 4 done" resume state /
 * completed state), a focus-workout explanation computed from the engine's
 * pure reason explainer (`@/workout/reasons`), progress-aware chips, richer
 * completion outcomes, and length-labelled history rows.
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SectionHeader } from "@/components/shell";
import { GameWorldArt } from "@/components/discovery/game-identity";
import {
  Button,
  Card,
  EmptyState,
  Entrance,
  HAIRLINE,
  ListRow,
  ProgressBar,
  ProgressRing,
  Report,
  ReportRow,
  SectionGrid,
  Skeleton,
  SkeletonText,
  Spark,
  StreakStrip,
  showToast,
} from '@/components/ui';
import {
  WorkoutCompletionCard,
  WorkoutFocusExplanation,
  WorkoutHistoryRow,
  WorkoutLengthChips,
  WorkoutTemplateChips,
  WorkoutTemplateDetails,
} from "@/components/workout";
import { formatRelativeDay } from "@/components/shell/format";
import { ScreenShell } from "@/components/screen-shell";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Radii, Spacing } from "@/constants/theme";
import type { AppDatabase, DomainRating } from "@/db";
import type { GameDefinition } from "@/sdk";
import { levelForXp, levelProgress, xpForLevel } from "@/rating";
import { useDbData } from "@/hooks/use-db-data";
import { getAllGameDefinitions, getGameDefinition } from "@/registry/registry";
import { collectClaimableRewards } from "@/rewards/inbox";
import { refreshProgression } from "@/progression";
import {
  progressionFocusSyncDue,
  progressionInputFingerprint,
  runProgressionSync,
  type ProgressionInput,
} from "@/progression/focus-sync";
import {
  effectiveCurrent,
  milestoneProgress,
  readCoveredDates,
  reconstructStreak,
} from "@/streaks";
import { parseInstanceKey, type WorkoutLength } from "@/workout/metadata";
import type { WorkoutSelectionReason } from "@/workout/personalize";
import { canAffordReroll, MAX_REROLLS_PER_DAY } from "@/workout/reroll";
import { explainTemplateWorkout } from "@/workout/reasons";
import { eligibleGames } from "@/workout/reconcile";
import {
  applyTemplatePersonalization,
  DEFAULT_WORKOUT_LENGTH,
  estimatedWorkoutMinutes,
  selectTemplateWorkout,
  workoutLengthSpec,
} from "@/workout/templates";
import type { WorkoutCompletionSummary } from "@/workout/summary";
import { localDateString } from "@/workout/today";
import { useWorkout } from "@/workout/use-workout";
import { useWorkoutTemplates } from "@/workout/use-workout-templates";
import { gameHref } from "@/workout/routing";
import { MilestoneStrip } from "@/components/mastery/mastery-card";
import { useMasterySummaries } from "@/mastery/use-mastery";
import { registry } from "@/registry/registry.generated";
import { SpotlightCard } from "@/components/spotlight/spotlight-card";
import { RewardCelebrationHost } from "@/rewards/celebration";

// Certification-only source binding. The marker is injected by Metro through
// Expo's EXPO_PUBLIC_* environment handling and is rendered only in dev
// builds, so a certification run can prove the installed JS bundle came from
// the clean checkout SHA without adding release UI or product state.
const QA_BUILD_SHA = /^[0-9a-f]{40}$/.test(process.env.EXPO_PUBLIC_BUILD_SHA ?? "")
  ? process.env.EXPO_PUBLIC_BUILD_SHA
  : null;

interface HomeData {
  /** Load-time clock for relative-day formatting (set outside render). */
  nowMs: number;
  domainRatings: DomainRating[];
  recentGameIds: string[];
  /** Local YYYY-MM-DD of each recent session (for streak reconstruction). */
  activityDates: string[];
  /** Freeze/recovery dates that count as activity in the shared streak model. */
  coveredDates: string[];
  balance: number;
  totalXp: number;
  /** Task 9.6: Recent sessions with game details for display */
  recentSessions: readonly {
    id: string;
    gameId: string;
    gameName: string;
    normalizedResult: number;
    xp: number;
    completedAt: number;
  }[];
  /** W24: claimable engagement rewards (W12 inbox, read-only hint count). */
  claimableRewards: number;
}

const EMPTY_HOME: HomeData = {
  nowMs: 0,
  domainRatings: [],
  recentGameIds: [],
  activityDates: [],
  coveredDates: [],
  balance: 0,
  totalXp: 0,
  recentSessions: [],
  claimableRewards: 0,
};

/** One today-instance of a template, for resume/completed markers. */
interface TemplateResumeEntry {
  length: WorkoutLength | null;
  completedGames: number;
  totalGames: number;
  status: WorkoutCompletionSummary["status"];
}

async function loadHome(db: AppDatabase): Promise<HomeData> {
  const nowMs = Date.now();
  // One focus-time progression sync per throttle window (finding 1): the
  // newest persisted session is the fingerprint, so a completion always wins
  // over the window. Home already reads the newest sessions below.
  const [
    domainRatings,
    recent,
    balance,
    sessionXp,
    awardsXp,
    activityDates,
    profile,
  ] =
    await Promise.all([
      db.ratings.getRatings(),
      db.sessions.listRecent(30, nowMs),
      db.ledger.getBalance(),
      db.sessions.getTotalXp(nowMs),
      db.xpAwards.getTotalAwardedXp(nowMs),
      // Task 9.3: Use distinct activity dates for streak calculation
      db.sessions.getDistinctActivityDates(nowMs),
      db.profile.get(),
    ]);

  // Task 9.6: Build recent sessions with game names. The registry is already
  // statically imported above; the former dynamic import broke this loader in
  // the Jest environment (untransformed `import()`), hiding the whole tail of
  // the load from every Home test.
  const recentSessions = recent.slice(0, 5).map((session) => ({
    id: session.id,
    gameId: session.gameId,
    gameName: getGameDefinition(session.gameId)?.name ?? session.gameId,
    normalizedResult: session.normalizedResult,
    xp: session.xp,
    completedAt: session.completedAt,
  }));

  return {
    nowMs,
    domainRatings,
    recentGameIds: recent.map((session) => session.gameId),
    activityDates,
    coveredDates: readCoveredDates(profile?.settings ?? {}),
    balance,
    totalXp: sessionXp + awardsXp,
    recentSessions,
    claimableRewards: await loadClaimableRewardCount(db, recent[0] ?? null, nowMs),
  };
}

/**
 * W24 (read-only consumption of W12's engagement exports): count currently
 * claimable rewards for the Rewards quick-action hint. Isolated try/catch so
 * an engagement-layer failure can never blank the core dashboard slots —
 * the hint simply stays at zero.
 *
 * Finding 1: the progression sync is throttled by the shared focus gate. The
 * fingerprint comes from the newest session Home already read; a completion
 * changes it and forces an immediate sync regardless of the window.
 */
async function loadClaimableRewardCount(
  db: AppDatabase,
  newestSession: ProgressionInput | null,
  nowMs: number,
): Promise<number> {
  const fingerprint = progressionInputFingerprint(newestSession);
  if (progressionFocusSyncDue(nowMs, fingerprint)) {
    // Sync quests/achievements first: a session completed in this process must
    // be reflected in the hint without a Profile detour. Both steps are
    // isolated so an engagement-layer failure can never blank the core
    // dashboard slots.
    try {
      const now = new Date(nowMs);
      await runProgressionSync((syncNow) => refreshProgression(db, syncNow), now, fingerprint);
    } catch (error) {
      console.error('[home] progression refresh failed', error);
    }
  }
  try {
    return (await collectClaimableRewards(db)).length;
  } catch {
    return 0;
  }
}

export default function HomeScreen() {
  const theme = useTheme();
  const today = localDateString();
  const [refreshKey, setRefreshKey] = useState(0);
  // Reload on every focus so slots reflect sessions completed elsewhere (the
  // workout instance additionally self-refreshes via workout events).
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, []),
  );
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const { data, loaded, error } = useDbData(loadHome, [refreshKey], EMPTY_HOME);
  // Load-time clock (see HomeData.nowMs) for relative-day labels.
  const nowMs = data.nowMs;

  // Durable workout context: loads/creates today's persisted instance and owns
  // reroll (persisted attempt + transactional currency debit). The displayed
  // selection reflects the persisted reroll attempt (006R tasks 6.2/6.5).
  const workoutFlow = useWorkout({
    domainRatings: data.domainRatings,
    recentGameIds: data.recentGameIds,
    balance: data.balance,
  });
  const rerollAttempt = workoutFlow.instance?.rerollAttempt ?? 0;
  const nextRerollCost = workoutFlow.rerollCostNow;
  const rerollAffordable = canAffordReroll(data.balance, rerollAttempt);
  const rerollExhausted = rerollAttempt >= MAX_REROLLS_PER_DAY;

  // Campaign 014 (W6): closest mastery milestones for the return-user strip.
  // Games still climbing (not new, not mastered) with a concrete next step.
  const { byGame: masteryByGame } = useMasterySummaries();
  const milestoneItems = useMemo(() => {
    const items: {
      gameId: string;
      name: string;
      summary: import("@/mastery").MasterySummary;
    }[] = [];
    for (const game of registry) {
      const summary = masteryByGame.get(game.id);
      if (
        !summary ||
        summary.tier === "unplayed" ||
        summary.tier === "mastered" ||
        !summary.nextMilestone
      ) {
        continue;
      }
      items.push({ gameId: game.id, name: game.name, summary });
    }
    return items;
  }, [masteryByGame]);

  // Durable workout progress markers (006R hardening): reflect the persisted
  // current index so completed/current positions are visually distinct. The
  // instance refreshes on focus (see `useWorkout`), so leaving results after a
  // game advances the workout and Home re-renders with the new index.
  const workoutIndex = workoutFlow.instance?.currentIndex ?? 0;
  const workoutStatus = workoutFlow.instance?.status ?? "active";

  // ---------------------------------------------------------------------
  // W24: Workout V2 surfacing (templates / completion / history).
  // Secondary path — the daily flow above stays the primary CTA.
  // ---------------------------------------------------------------------
  const {
    suggestions,
    templates: allTemplates,
    history: workoutHistory,
    startTemplate,
    refresh: refreshTemplates,
  } = useWorkoutTemplates({
    domainRatings: data.domainRatings,
    recentGameIds: data.recentGameIds,
  });

  // Template history/chips/completion-card live in their own hook with
  // db-event-driven reloads; also re-read on focus so returning from a game
  // can never show a pre-advance snapshot (defense in depth for any mutation
  // path that forgets to emit `workoutChanged`).
  useFocusEffect(
    useCallback(() => {
      refreshTemplates();
    }, [refreshTemplates]),
  );

  // Picker state: null = follow today's rotation order (first suggestion) /
  // the engine's default length, so the section is sensible before any tap.
  const [pickedTemplateId, setPickedTemplateId] = useState<string | null>(null);
  const [pickedLength, setPickedLength] = useState<WorkoutLength | null>(null);
  const [startInProgress, setStartInProgress] = useState(false);

  /** Template ids already started today (active or completed). */
  const startedTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const summary of workoutHistory) {
      if (summary.date !== today) {
        continue;
      }
      const parsed = parseInstanceKey(summary.key);
      if (parsed.kind === "template" && parsed.templateId) {
        ids.add(parsed.templateId);
      }
    }
    return ids;
  }, [workoutHistory, today]);

  // Chip menu: today's rotation order first; started workouts leave the
  // rotation menu, so re-append them (catalog order) to keep partially played
  // templates resumable from Home — startTemplate resumes the SAME persisted
  // instance instead of duplicating it.
  const templateChoices = useMemo(() => {
    const choices = suggestions.filter((t) => t.kind === "template");
    for (const template of allTemplates) {
      if (
        template.kind === "template" &&
        startedTemplateIds.has(template.id) &&
        !choices.some((choice) => choice.id === template.id)
      ) {
        choices.push(template);
      }
    }
    return choices;
  }, [suggestions, allTemplates, startedTemplateIds]);

  const effectiveTemplateId =
    pickedTemplateId != null &&
    templateChoices.some((t) => t.id === pickedTemplateId)
      ? pickedTemplateId
      : (templateChoices[0]?.id ?? null);
  const effectiveLength = pickedLength ?? DEFAULT_WORKOUT_LENGTH;
  const selectedTemplate =
    templateChoices.find((t) => t.id === effectiveTemplateId) ?? null;
  const resumeSelected = effectiveTemplateId != null && startedTemplateIds.has(effectiveTemplateId);

  /** All of today's template instances grouped by template id. A template
   * can legitimately own several instances in one day (one per length). */
  const resumeEntriesByTemplateId = useMemo(() => {
    const map = new Map<string, TemplateResumeEntry[]>();
    for (const summary of workoutHistory) {
      if (summary.date !== today) {
        continue;
      }
      const parsed = parseInstanceKey(summary.key);
      if (parsed.kind !== "template" || !parsed.templateId) {
        continue;
      }
      const list = map.get(parsed.templateId) ?? [];
      list.push({
        length: parsed.length,
        completedGames: summary.completedGames,
        totalGames: summary.totalGames,
        status: summary.status,
      });
      map.set(parsed.templateId, list);
    }
    return map;
  }, [workoutHistory, today]);

  // Display entry per template id: prefer the instance at the currently
  // selected length (that is the one Start would resume), else the most
  // progressed one — so chips read "2 of 4 done" / "Completed" truthfully.
  const resumeById = useMemo(() => {
    const out = new Map<string, TemplateResumeEntry>();
    for (const [templateId, entries] of resumeEntriesByTemplateId) {
      const matching = entries.find((entry) => entry.length === effectiveLength);
      const mostProgressed = [...entries].sort(
        (a, b) => b.completedGames - a.completedGames,
      )[0];
      const chosen = matching ?? mostProgressed;
      if (chosen) {
        out.set(templateId, chosen);
      }
    }
    return out;
  }, [resumeEntriesByTemplateId, effectiveLength]);

  const selectedResume = effectiveTemplateId
    ? (resumeById.get(effectiveTemplateId) ?? null)
    : null;
  const selectedCompletedToday = selectedResume?.status === "completed";

  const lengthSpec = workoutLengthSpec(effectiveLength);
  const lengthLabel = lengthSpec.label;
  const dailyExpectedMinutes = estimatedWorkoutMinutes(DEFAULT_WORKOUT_LENGTH);

  // Why-this-workout reasons: recompute the same deterministic selection the
  // engine will persist on start (pure functions, no side effects), then run
  // the shared personalization explainer over it. Null when the catalog is
  // empty or the template is not startable — the panel degrades to static copy.
  const previewReasons = useMemo<readonly WorkoutSelectionReason[] | null>(() => {
    if (!selectedTemplate || selectedTemplate.kind !== "template") {
      return null;
    }
    try {
      const selection = selectTemplateWorkout({
        games: eligibleGames(),
        template: selectedTemplate,
        length: effectiveLength,
        date: today,
      });
      const ordered = applyTemplatePersonalization(selection.games, {
        domainRatings: data.domainRatings,
        recentGameIds: data.recentGameIds,
        seed: selection.seed,
      });
      return explainTemplateWorkout(
        ordered,
        data.domainRatings,
        data.recentGameIds,
      );
    } catch {
      return null;
    }
  }, [
    selectedTemplate,
    effectiveLength,
    today,
    data.domainRatings,
    data.recentGameIds,
  ]);

  const startLabel = selectedTemplate
    ? selectedCompletedToday
      ? `${selectedTemplate.name} · Completed`
      : `${resumeSelected ? "Resume" : "Start"} ${selectedTemplate.name} · ${lengthLabel}`
    : "Start workout";

  // Latest completed TEMPLATE workout today → post-workout summary card.
  // History is newest-first, so the first match is the most recent one.
  const latestCompletedTemplate: WorkoutCompletionSummary | null = useMemo(() => {
    for (const summary of workoutHistory) {
      if (summary.date !== today) {
        continue;
      }
      const parsed = parseInstanceKey(summary.key);
      if (parsed.kind === "template" && summary.status === "completed") {
        return summary;
      }
    }
    return null;
  }, [workoutHistory, today]);

  const onStartTemplate = useCallback(async () => {
    if (!effectiveTemplateId || startInProgress) {
      return;
    }
    setStartInProgress(true);
    try {
      const instance = await startTemplate(effectiveTemplateId, effectiveLength);
      // Jump straight into the first unplayed game. A fully completed resume
      // target has nothing left to launch, so stay on Home (the completion
      // card below picks it up).
      const nextGameId =
        instance?.status === "active"
          ? (instance.gameIds[instance.currentIndex] ?? null)
          : null;
      if (instance && nextGameId) {
        router.push(
          gameHref(nextGameId, {
            instanceKey: instance.date,
            legIndex: instance.currentIndex,
            gameId: nextGameId,
          }),
        );
      }
    } catch (error) {
      console.error("[home] template workout start failed", error);
      // Campaign 028: a failed start used to be console-only. The toast is the
      // user-visible surface; the `finally` below keeps the CTA retryable and
      // no instance was created, so nothing was changed.
      showToast({
        title: "Couldn't start the workout",
        detail: "Nothing was changed — try again.",
        tone: "danger",
      });
    } finally {
      setStartInProgress(false);
    }
  }, [effectiveTemplateId, effectiveLength, startInProgress, startTemplate]);

  // Displayed selection reflects the persisted workout instance (so rerolls and
  // resume state stay in sync with what is stored).
  const allGames = getAllGameDefinitions();

  const workout: GameDefinition[] = workoutFlow.instance
    ? workoutFlow.instance.gameIds
        .map((id) => allGames.find((g) => g.id === id))
        .filter((g): g is GameDefinition => g !== undefined)
    : [];
  const currentGame = workoutFlow.currentGameId
    ? allGames.find((g) => g.id === workoutFlow.currentGameId)
    : undefined;
  const consoleGame = currentGame ?? workout[0] ?? allGames[0];

  const streak = reconstructStreak(
    data.activityDates,
    today,
    data.coveredDates,
  );
  const currentStreak = effectiveCurrent(streak, today);
  const level = levelForXp(data.totalXp);
  const levelRatio = levelProgress(data.totalXp);
  const nextLevelXp = xpForLevel(level + 1);
  const xpToNext = Math.max(0, nextLevelXp - data.totalXp);

  // Next streak milestone (best-run honors): the first catalog milestone the
  // best streak has not reached yet, rendered as the strip's closing line.
  const nextStreakMilestone =
    milestoneProgress(streak).find((entry) => !entry.reached) ?? null;
  const streakMilestoneLine =
    nextStreakMilestone == null
      ? "Every streak milestone reached — legendary."
      : nextStreakMilestone.remaining === 1
        ? `1 day to ${nextStreakMilestone.milestone.label} · ${nextStreakMilestone.milestone.days}-day streak`
        : `${nextStreakMilestone.remaining} days to ${nextStreakMilestone.milestone.label} · ${nextStreakMilestone.milestone.days}-day streak`;

  // Hero CTA copy: resume language once the plan is underway, start language
  // on a fresh plan. The sublabel carries the context line (next game +
  // position), so the single primary button reads as a complete invitation.
  const isResuming = workoutStatus === "active" && workoutIndex > 0;
  const heroCtaLabel = isResuming ? "Continue workout" : "Start workout";
  const heroCtaAccessibilityLabel =
    workoutStatus === "completed"
      ? "See today's progress"
      : workout.length === 0
        ? heroCtaLabel
        : isResuming
          ? `Continue today's workout with ${currentGame?.name ?? "the next game"}`
          : `Start today's workout, ${workout.length} games`;
  // Same destination (with the same workout-leg provenance) the resume Link
  // used before the hero rebuild — null until a current game is known.
  // Before the workout is started there is no instance yet, so the CTA targets
  // the first planned leg — the action must exist in the first viewport, not
  // only once a session is already in flight.
  const heroGameId =
    workoutStatus === "active"
      ? (workoutFlow.currentGameId ?? workout[0]?.id ?? null)
      : null;
  const heroHref = heroGameId
    ? gameHref(
        heroGameId,
        workoutFlow.instance
          ? {
              instanceKey: workoutFlow.instance.date,
              legIndex: workoutFlow.instance.currentIndex,
              gameId: heroGameId,
            }
          : null,
      )
      : null;
  const heroPlanLine =
    workout.length > 0
      ? `${workout.length} games${dailyExpectedMinutes ? ` · about ${dailyExpectedMinutes} minutes` : ""} · ${
          data.recentSessions.length > 0
            ? "balanced across your recent training."
            : "a balanced starting set."
        }`
      : null;
  const heroCtaSublabel =
    workoutStatus === "completed"
      ? `${workout.length}/${workout.length} games saved`
      : workout.length === 0
        ? undefined
        : isResuming
          ? `${currentGame?.name ?? "Next game"} · Game ${workoutIndex + 1} of ${workout.length}`
          : `Starts with ${workout[0]?.name ?? "game one"} · ${workout.length} games`;

  // Error surfacing: only when a real game catalog is installed. With an empty
  // registry (fresh bootstrap / bare test harness) a db failure is expected
  // and the static placeholders ARE the correct degraded state — surfacing an
  // error there would flip the visual-baseline canaries.
  const hasCatalog = allGames.length > 0;

  // Reroll is user-triggered and can reject (paid debit transaction, apply
  // failure, unexpected db error). The wrapper keeps the CTA retryable and
  // tells the player nothing was spent; the hook still throws for tests.
  const [rerollInProgress, setRerollInProgress] = useState(false);
  const onReroll = useCallback(async () => {
    if (rerollInProgress) {
      return;
    }
    setRerollInProgress(true);
    try {
      await workoutFlow.reroll();
    } catch (error) {
      console.error("[home] workout reroll failed", error);
      showToast({
        title: "Couldn't reroll the workout",
        detail: "Your coins were not spent — try again.",
        tone: "danger",
      });
    } finally {
      setRerollInProgress(false);
    }
  }, [rerollInProgress, workoutFlow]);

  // 073 §3 — skip is user-triggered and can reject (the repository re-checks
  // the allowance against the FRESH row, so a stale render cannot skip the
  // final leg). Failure is surfaced like the reroll's rather than swallowed.
  const [skipInProgress, setSkipInProgress] = useState(false);
  const onSkip = useCallback(async () => {
    if (skipInProgress) {
      return;
    }
    setSkipInProgress(true);
    try {
      await workoutFlow.skipCurrentLeg();
      showToast({ title: "Game skipped", detail: "Your plan moved to the next game." });
    } catch (error) {
      console.error("[home] workout skip failed", error);
      showToast({
        title: "Couldn't skip this game",
        detail: "Your plan is unchanged — try again.",
        tone: "danger",
      });
    } finally {
      setSkipInProgress(false);
    }
  }, [skipInProgress, workoutFlow]);

  // The allowance and the boundary reason are ON the control (task 3.4):
  // nothing about skipping is discovered by tapping.
  const skipLabel = workoutFlow.canSkip
    ? "Skip this game (free)"
    : "Skip unavailable";
  const skipHint =
    workoutFlow.skipUnavailableReason ??
    (workoutFlow.skipsRemaining === 1
      ? "1 skip left in this plan — the last game must be played."
      : `${workoutFlow.skipsRemaining} skips left in this plan — the last game must be played.`);

  // 073 §4 — a leg tap must never hand the game a false ownership tuple.
  // Three honest launches: the current leg (tuple true by construction), a
  // later leg (an EXPLICIT jump that records the skipped prefix first, so the
  // tuple is then true against the durable row), and an already-settled leg
  // (a practice replay with NO tuple — its session must not claim a leg the
  // plan already settled).
  const [jumpInProgress, setJumpInProgress] = useState(false);
  const onJumpToLeg = useCallback(
    async (gameId: string, index: number) => {
      const instance = workoutFlow.instance;
      if (!instance) {
        router.push(gameHref(gameId, null));
        return;
      }
      if (workoutStatus !== "active" || index < workoutIndex) {
        router.push(gameHref(gameId, null));
        return;
      }
      if (index === workoutIndex) {
        router.push(
          gameHref(gameId, {
            instanceKey: instance.date,
            legIndex: index,
            gameId,
          }),
        );
        return;
      }
      if (jumpInProgress) {
        return;
      }
      setJumpInProgress(true);
      try {
        await workoutFlow.jumpToLeg(index);
        // The tuple is built AFTER the jump lands, from the position the
        // durable row now holds — never from the row index of a stale render.
        router.push(
          gameHref(gameId, {
            instanceKey: instance.date,
            legIndex: index,
            gameId,
          }),
        );
      } catch (error) {
        console.error("[home] workout jump failed", error);
        showToast({
          title: "Couldn't open that game",
          detail: "Your plan is unchanged — try again.",
          tone: "danger",
        });
      } finally {
        setJumpInProgress(false);
      }
    },
    [jumpInProgress, workoutFlow, workoutStatus, workoutIndex],
  );

  const rerollLabel =
    workoutStatus === "completed"
      ? "Workout complete"
      : rerollExhausted
        ? "No rerolls left"
        : nextRerollCost === 0
          ? "Reroll workout (free)"
          : rerollAffordable
            ? `Reroll workout (${nextRerollCost} coins)`
            : `Need ${nextRerollCost} coins`;

  // Explanatory hint so the reroll economy is legible (Queue D).
  const rerollHint =
    workoutStatus === "completed"
      ? "You've finished today's workout."
      : rerollExhausted
        ? "You've used all rerolls for today."
        : nextRerollCost === 0
          ? "First reroll is free; later rerolls cost escalating coins."
          : rerollAffordable
            ? `Reroll costs ${nextRerollCost} coins (more each time).`
            : `Not enough coins — you need ${nextRerollCost}.`;

  return (
    <ScreenShell>
<ThemedText type="eyebrow" themeColor="accentText" testID="home-brand">
        BRAIN TRAINING
      </ThemedText>
      <ThemedText type="title" testID="home-title">
        Home
      </ThemedText>
      {__DEV__ && QA_BUILD_SHA ? (
        <View
          collapsable={false}
          pointerEvents="none"
          style={styles.qaBuildMarker}
          testID={`home-build-sha-${QA_BUILD_SHA}`}
        />
      ) : null}

      {/* Loading state: skeleton blocks while the first db read settles. */}
      {!loaded && (
        <View
          style={styles.loadingBlock}
          testID="home-loading"
          accessible
          accessibilityLabel="Loading your training data"
        >
          <Skeleton height={Spacing.six * 2} />
          <SkeletonText lines={2} />
        </View>
      )}

      {/* Today's Workout — the screen's single focal object (campaign 055).
          The focus-module world art leads, a compact body carries the plan,
          progress and the one primary key, and the per-game legs move to a
          quiet Report directly below. */}
      <Entrance index={0}>
        {/* Change 076 (lock section 1): the focal workout object is the
            immersive stage card — charcoal in both schemes, stageInk type. */}
        <Card variant="stage" padding="none" testID="home-workout-cta">
          {consoleGame ? (
            <View testID="home-training-console">
              <GameWorldArt
                game={consoleGame}
                size="stage"
                testID="home-training-console-world"
              />
            </View>
          ) : null}
          <View style={styles.heroBody}>
            <View style={styles.heroTitle}>
              <View style={styles.heroEyebrowRow}>
                <Spark size={14} color={theme.accent} />
                <ThemedText type="eyebrow" themeColor="stageInk">
                  TODAY
                </ThemedText>
              </View>
              <ThemedText type="headline" themeColor="stageInk">Today&apos;s Workout</ThemedText>
              {heroPlanLine ? (
                <ThemedText
                  type="bodySmall"
                  themeColor="stageInk"
                  testID="home-workout-plan">
                  {heroPlanLine}
                </ThemedText>
              ) : null}
              <ThemedText
                type="caption"
                themeColor="stageInk"
                testID="home-local-trust">
                Your training is ready on this device and works offline.
              </ThemedText>
            </View>
            {workoutStatus === "completed" ? (
              <View
                style={[styles.completePanel, { backgroundColor: theme.successSoft }]}
                testID="home-workout-complete-panel">
                <ThemedText
                  type="label"
                  themeColor="successSoftText"
                  testID="home-workout-complete">
                  Workout complete
                </ThemedText>
                <ThemedText type="caption" themeColor="successSoftText">
                  {`${workout.length}/${workout.length} games saved. See today's progress for a summary.`}
                </ThemedText>
              </View>
            ) : workout.length > 0 ? (
              <View style={styles.progressRow}>
                {/* stageInk required: this numeral sits on the charcoal stage
                    card, where the default paper ink is unreadable (device
                    capture: near-black "0/4" on the stage). */}
                <ThemedText type="numeralXl" themeColor="stageInk" testID="home-workout-progress">
                  {`${workoutIndex}/${workout.length}`}
                </ThemedText>
                <View style={styles.progressCopy}>
                  <ThemedText type="label" themeColor="stageInk">
                    {`${workoutIndex} of ${workout.length} complete`}
                  </ThemedText>
                  {currentGame ? (
                    <ThemedText type="caption" themeColor="stageInk">
                      {`Next: ${currentGame.name}`}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ) : null}
            {workout.length > 0 ? (
              <>
                <ProgressBar
                  value={workoutIndex / workout.length}
                  tone="success"
                  testID="home-workout-progress-bar"
                  accessibilityLabel={
                    workoutStatus === "completed"
                      ? `Workout complete, ${workout.length} of ${workout.length} games done`
                      : `${workoutIndex} of ${workout.length} games done`
                  }
                />
                {workoutStatus === "completed" ? (
                  <Button
                    variant="primary"
                    size="lg"
                    label="See today's progress"
                    sublabel={`${workout.length}/${workout.length} games saved`}
                    testID="home-workout-continue"
                    accessibilityLabel="See today's progress"
                    accessibilityHint="Review your completed workout"
                    onPress={() => router.replace("/progress")}
                  />
                ) : heroHref ? (
                  <Button
                    variant="primary"
                    size="lg"
                    label={heroCtaLabel}
                    sublabel={heroCtaSublabel}
                    testID="home-workout-continue"
                    accessibilityLabel={heroCtaAccessibilityLabel}
                    onPress={() => router.push(heroHref)}
                  />
                ) : null}
              </>
            ) : hasCatalog && workoutFlow.loadFailed ? (
              // A failed load-or-create must not read as "no catalog installed".
              <Card tone="dangerSoft" testID="home-workout-error">
                <View style={styles.errorBody}>
                  <ThemedText type="label" themeColor="dangerSoftText">
                    Couldn&apos;t load today&apos;s workout
                  </ThemedText>
                  <ThemedText type="bodySmall" themeColor="dangerSoftText">
                    Your plan is stored on this phone — try again to reload it.
                  </ThemedText>
                  <Button
                    variant="secondary"
                    label="Try again"
                    testID="home-workout-retry"
                    onPress={workoutFlow.retry}
                  />
                </View>
              </Card>
            ) : hasCatalog && workoutFlow.status === "loading" ? (
              // Hold the skeleton instead of flashing the empty-plan copy while
              // the durable instance loads.
              <Skeleton height={Spacing.six * 2} testID="home-workout-loading" />
            ) : (
              <EmptyState
                testID="home-workout-empty"
                icon={<Spark size={32} color={theme.accent} />}
                title="No plan yet"
                message="Your daily 4-game training plan will appear here once games are registered."
              />
            )}
          </View>
        </Card>

        {/* The leg list is evidence of the plan, not part of the decision
            surface — it leaves the artifact for a quiet Report below. */}
        {workout.length > 0 ? (
          <Report title="Today's plan" testID="home-workout-list" style={styles.planReport}>
            {workout.map((game, index) => {
              // 073 — a skipped leg is its OWN outcome: it must never render
              // as "Done" (the player did not play it and it earned nothing).
              const isSkipped =
                workoutFlow.instance?.skippedIndices?.includes(index) ?? false;
              const isCompleted =
                !isSkipped && (workoutStatus === "completed" || index < workoutIndex);
              const isCurrent =
                workoutStatus === "active" && index === workoutIndex;
              const status = isSkipped
                ? "Skipped"
                : isCompleted
                  ? "Done"
                  : isCurrent
                    ? "Now"
                    : "Up next";
              return (
                <ReportRow
                  key={`${game.id}-${index}`}
                  label={game.name}
                  hint={game.primaryCategory}
                  trailing={
                    // Contract: automation reads each leg's status text from
                    // this node (and excludes the prefix from leg counting).
                    <ThemedText
                      type="label"
                      testID={`home-workout-game-status-${game.id}`}>
                      {status}
                    </ThemedText>
                  }
                  divider={index < workout.length - 1}
                  testID={`home-workout-game-${game.id}`}
                  accessibilityLabel={`${game.name}, ${game.primaryCategory}, ${
                    isSkipped
                      ? "skipped"
                      : isCompleted
                        ? "done"
                        : isCurrent
                          ? "up now"
                          : "up next"
                  }`}
                  onPress={() => void onJumpToLeg(game.id, index)}
                />
              );
            })}
          </Report>
        ) : null}
      </Entrance>

      {/* Context stays available, but outside the decision surface. Report
          grammar keeps streak, level and coins as evidence — not a second
          hero competing with today's workout. */}
      <Report title="Your training" testID="home-context">
        {/* The streak row carries the strip, milestone line and at-risk note;
            ReportRow has no testID slots for those nodes, so the row is
            composed directly inside Report's hairline grammar. */}
        <View
          style={[styles.reportRow, { borderBottomColor: theme.border }]}
          testID="home-streak-card">
          <View style={styles.reportRowHead}>
            <ThemedText type="bodySmall" themeColor="textSecondary">
              Day streak
            </ThemedText>
            <ThemedText
              type="numeralXl"
              style={{ color: theme.streak }}
              testID="home-stat-streak">
              {currentStreak}
            </ThemedText>
          </View>
          <StreakStrip
            count={currentStreak}
            testID="home-streak-card-tracker"
          />
          {streakMilestoneLine ? (
            <ThemedText
              type="caption"
              themeColor="textSecondary"
              testID="home-streak-card-next-milestone">
              {streakMilestoneLine}
            </ThemedText>
          ) : null}
          {loaded && streak.atRisk ? (
            <View
              style={[styles.atRisk, { backgroundColor: theme.warningSoft }]}
              testID="home-streak-at-risk">
              <ThemedText type="caption" themeColor="warningSoftText">
                Play today to keep your streak alive.
              </ThemedText>
            </View>
          ) : null}
        </View>

        <ReportRow
          testID="home-level-card"
          icon={
            <ProgressRing
              value={levelRatio}
              tone="xp"
              size={48}
              label={
                xpToNext > 0
                  ? `Level ${level}, ${data.totalXp} XP total, ${xpToNext} XP to Level ${level + 1}`
                  : `Level ${level}, ${data.totalXp} XP total, max level`
              }
              testID="home-stat-xp">
              <ThemedText
                type="numeralLg"
                themeColor="xp"
                testID="home-stat-level">
                {level}
              </ThemedText>
            </ProgressRing>
          }
          label="Level"
          value={`${data.totalXp} XP`}
          hint={
            xpToNext > 0
              ? `${xpToNext} XP to Level ${level + 1}`
              : "Max level"
          }
          divider={data.balance > 0}
        />

        {data.balance > 0 ? (
          <ReportRow
            testID="home-stat-coins"
            label="Coins"
            value={`🪙 ${data.balance}`}
            accessibilityLabel={`${data.balance} coins`}
          />
        ) : null}
      </Report>

      {/* W24: post-workout feedback — the most recent TEMPLATE workout
          finished today. Data-gated so first-run trees stay unchanged. */}
      {loaded && latestCompletedTemplate ? (
        <WorkoutCompletionCard
          summary={latestCompletedTemplate}
          resolveGameName={(gameId) =>
            allGames.find((game) => game.id === gameId)?.name ?? null
          }
          testID="home-workout-completion-card"
        />
      ) : null}

      {/* Workout configuration is deliberately one quiet secondary surface:
          reroll and focus/length choices stay available without competing with
          the Today CTA. */}
      {loaded && hasCatalog ? (
        <Card
          variant="outlined"
          padding="md"
          style={styles.sectionCardGap}
          testID="home-workout-templates"
        >
          <SectionHeader
            title="Choose a workout"
            caption="Change the mix or choose a focus."
          />
          <View testID="home-workout-options" style={styles.secondaryAction}>
            {workout.length > 0 ? (
              <>
                <ThemedText type="label">Today&apos;s mix</ThemedText>
                <Button
                  variant="ghost"
                  label={rerollLabel}
                  testID="home-workout-reroll"
                  accessibilityHint={rerollHint}
                  disabled={
                    !rerollAffordable ||
                    rerollExhausted ||
                    rerollInProgress ||
                    workoutStatus === "completed"
                  }
                  onPress={onReroll}
                />
                {/* 073 §3 — the free exit the plan never had. Rerolls were the
                    only way past an unwanted leg and they cost coins and cap
                    per day; the allowance and its boundary reason live on the
                    control so nothing about skipping is discovered by tapping. */}
                <Button
                  variant="ghost"
                  label={skipLabel}
                  testID="home-workout-skip"
                  accessibilityHint={skipHint}
                  disabled={!workoutFlow.canSkip || skipInProgress}
                  onPress={onSkip}
                />
                {workoutStatus === "active" ? (
                  <ThemedText
                    type="caption"
                    themeColor="textSecondary"
                    testID="home-workout-skip-hint"
                  >
                    {skipHint}
                  </ThemedText>
                ) : null}
                {workoutStatus === "active" ? (
                  <ThemedText
                    type="caption"
                    themeColor="textSecondary"
                    testID="home-reroll-hint"
                  >
                    {rerollHint}
                  </ThemedText>
                ) : null}
              </>
            ) : null}
          </View>
          {templateChoices.length > 0 ? (
            <>
              <ThemedText type="label">Focus workouts</ThemedText>
              <WorkoutTemplateChips
                templates={templateChoices}
                selectedId={effectiveTemplateId}
                startedIds={startedTemplateIds}
                resumeById={resumeById}
                onSelect={setPickedTemplateId}
                testIDPrefix="home-workout-template"
              />
              <WorkoutLengthChips
                selected={effectiveLength}
                onSelect={setPickedLength}
                testIDPrefix="home-workout-length"
              />
              {selectedTemplate ? (
                <>
                  {/* Selected-template detail: explicit length line + durable
                      resume/completed state for today's instance. */}
                  <WorkoutTemplateDetails
                    template={selectedTemplate}
                    lengthSpec={lengthSpec}
                    resume={selectedResume}
                    testID="home-workout-selected"
                  />
                  {/* Focus explanation: why this domain + how the
                      personalization layer ordered the games. */}
                  <WorkoutFocusExplanation
                    template={selectedTemplate}
                    reasons={previewReasons}
                    testID="home-workout-focus"
                  />
                </>
              ) : null}
              <Button
                variant="secondary"
                label={startLabel}
                testID="home-workout-template-start"
                accessibilityLabel={startLabel}
                accessibilityHint={`Starts a ${lengthLabel.toLowerCase()} ${
                  selectedTemplate?.name ?? "workout"
                } session.`}
                loading={startInProgress}
                disabled={
                  !effectiveTemplateId || startInProgress || selectedCompletedToday
                }
                onPress={onStartTemplate}
              />
            </>
          ) : (
            <ThemedText type="bodySmall" themeColor="textSecondary">
              All of today&apos;s suggested focus workouts are already on your
              plan.
            </ThemedText>
          )}
        </Card>
      ) : null}

      {/* Error state: recoverable read failure with an explicit retry.
          `error != null` keeps the guard boolean so the JSX stays ReactNode. */}
      {loaded && error != null && hasCatalog ? (
        <Card tone="dangerSoft" testID="home-data-error">
          <View style={styles.errorBody}>
            <ThemedText type="label" themeColor="dangerSoftText">
              Couldn&apos;t load your data
            </ThemedText>
            <ThemedText type="bodySmall" themeColor="dangerSoftText">
              Your training data couldn&apos;t be read just now. Your progress
              stays safely on disk — try again.
            </ThemedText>
            <Button variant="secondary" label="Retry" onPress={refresh} />
          </View>
        </Card>
      ) : null}

      {/* Quick actions (constitution §13 order): drill-downs one tap away.
          Secondary buttons in an adaptive grid — stacked on phones,
          side-by-side on expanded widths. */}
      {workout.length > 0 && (
        <View>
          <SectionHeader title="Quick actions" />
          <View style={styles.quickActions} testID="home-quick-actions">
            <SectionGrid>
              <Button
                variant="secondary"
                label="Browse games"
                testID="home-quick-games"
                accessibilityLabel="Browse all games"
                onPress={() => router.replace("/games")}
              />
              <Button
                variant="secondary"
                label="Progress"
                testID="home-quick-progress"
                accessibilityLabel="View your progress"
                onPress={() => router.replace("/progress")}
              />
              <Button
                variant="secondary"
                label={
                  data.claimableRewards > 0
                    ? `Rewards (${data.claimableRewards})`
                    : "Rewards"
                }
                testID="home-quick-rewards"
                accessibilityLabel={
                  data.claimableRewards > 0
                    ? `Open rewards, ${data.claimableRewards} ready to claim`
                    : "Open rewards"
                }
                onPress={() => router.replace("/rewards")}
              />
            </SectionGrid>
          </View>
        </View>
      )}

      {/* Campaign 014 (W6): daily Spotlight challenge + closest mastery
          milestones — return-user hooks that stay out of the first
          viewport's workout/stats priority. */}
      {loaded && error == null ? <SpotlightCard /> : null}
      {loaded && error == null && milestoneItems.length > 0 ? (
        <MilestoneStrip items={milestoneItems} testIDPrefix="home-milestone" />
      ) : null}

      {/* Recent games slot — task 9.6: real recent session/game data */}
      <Card
        padding="lg"
        style={styles.sectionCardGap}
        testID="home-recent-games"
      >
        <SectionHeader
          title="Recent games"
          actionLabel={data.recentSessions.length > 0 ? "See all" : undefined}
          actionTestID="home-recent-all"
          actionAccessibilityLabel="Open full results history"
          onActionPress={
            data.recentSessions.length > 0
              ? () => router.replace("/results")
              : undefined
          }
        />
        {data.recentSessions.length > 0 ? (
          <View style={styles.recentList}>
            {data.recentSessions.map((session) => (
              <ListRow
                key={session.id}
                title={session.gameName}
                subtitle={`${formatRelativeDay(session.completedAt, nowMs)} · +${session.xp} XP`}
                meta={`${Math.round(session.normalizedResult * 100)}%`}
                testID={`home-recent-game-${session.id}`}
                accessibilityLabel={`${session.gameName} result, ${formatRelativeDay(
                  session.completedAt,
                  nowMs,
                )}, ${Math.round(session.normalizedResult * 100)} percent`}
                accessibilityHint="Opens this session's result"
                onPress={() => router.push(`/results?id=${session.id}`)}
              />
            ))}
          </View>
        ) : (
          <ThemedText type="bodySmall" themeColor="textSecondary">
            Your latest sessions will show up here after your first workout.
          </ThemedText>
        )}
      </Card>

      {/* W24: compact workout-history feed over the engine's history API
          (daily + template workouts, newest first). Data-gated: hidden until
          the first workout exists, keeping first-run trees stable. */}
      {loaded && workoutHistory.length > 0 ? (
        <Card
          padding="lg"
          style={styles.sectionCardGap}
          testID="home-workout-history"
        >
          <SectionHeader
            title="Workout history"
            caption="Your recent daily and focus workouts."
          />
          <View style={styles.recentList}>
            {workoutHistory.slice(0, 4).map((summary) => (
              <WorkoutHistoryRow
                key={summary.key}
                summary={summary}
                nowMs={nowMs}
                testID={`home-workout-history-${sanitizeTestId(summary.key)}`}
              />
            ))}
          </View>
        </Card>
      ) : null}

      <RewardCelebrationHost />
    </ScreenShell>
  );
}

/**
 * Instance keys contain `::` separators (`2026-08-21::focus-math::short`);
 * flatten every non-alphanumeric run to `-` so the resulting testIDs stay
 * stable, single-token selectors for QA automation.
 */
function sanitizeTestId(key: string): string {
  return key.replace(/[^a-zA-Z0-9]+/g, "-");
}

const styles = StyleSheet.create({
  qaBuildMarker: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 2,
    height: 2,
    // Keep the development marker in the accessibility hierarchy without
    // creating visible product chrome.
    opacity: 0.01,
  },
  secondaryAction: {
    gap: Spacing.one,
  },
  sectionCardGap: {
    gap: Spacing.two,
  },
  loadingBlock: {
    gap: Spacing.two,
  },
  heroBody: {
    gap: Spacing.twoHalf,
    padding: Spacing.three,
  },
  completePanel: {
    borderRadius: Radii.medium,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  planReport: {
    marginTop: Spacing.three,
  },
  reportRow: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: HAIRLINE,
  },
  reportRowHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  heroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  heroTitle: {
    gap: Spacing.half,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  progressCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  atRisk: {
    alignSelf: "flex-start",
    borderRadius: Radii.medium,
    paddingVertical: Spacing.oneHalf,
    paddingHorizontal: Spacing.twoHalf,
  },
  errorBody: {
    gap: Spacing.two,
  },
  quickActions: {
    marginTop: Spacing.two,
  },
  recentList: {
    gap: Spacing.one,
  },
});
