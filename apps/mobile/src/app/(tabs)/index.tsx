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

import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ProgressTrack, SectionHeader, StateCard, StatTile } from "@/components/shell";
import { formatRelativeDay } from "@/components/shell/format";
import {
  WorkoutCompletionCard,
  WorkoutFocusExplanation,
  WorkoutHistoryRow,
  WorkoutLengthChips,
  WorkoutTemplateChips,
  WorkoutTemplateDetails,
} from "@/components/workout";
import { ScreenShell } from "@/components/screen-shell";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MinTouchTarget } from "@/components/a11y";
import { Radii, Spacing } from "@/constants/theme";
import type { AppDatabase, DomainRating } from "@/db";
import type { GameDefinition } from "@/sdk";
import { useDbData } from "@/hooks/use-db-data";
import { levelForXp } from "@/rating";
import { getAllGameDefinitions } from "@/registry/registry";
import { collectClaimableRewards } from "@/rewards/inbox";
import {
  effectiveCurrent,
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

  // Task 9.6: Build recent sessions with game names
  const { getGameDefinition } = await import("@/registry/registry");
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
    claimableRewards: await loadClaimableRewardCount(db),
  };
}

/**
 * W24 (read-only consumption of W12's engagement exports): count currently
 * claimable rewards for the Rewards quick-action hint. Isolated try/catch so
 * an engagement-layer failure can never blank the core dashboard slots —
 * the hint simply stays at zero.
 */
async function loadClaimableRewardCount(db: AppDatabase): Promise<number> {
  try {
    return (await collectClaimableRewards(db)).length;
  } catch {
    return 0;
  }
}

export default function HomeScreen() {
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

  const streak = reconstructStreak(
    data.activityDates,
    today,
    data.coveredDates,
  );
  const currentStreak = effectiveCurrent(streak, today);
  const level = levelForXp(data.totalXp);

  // Error surfacing: only when a real game catalog is installed. With an empty
  // registry (fresh bootstrap / bare test harness) a db failure is expected
  // and the static placeholders ARE the correct degraded state — surfacing an
  // error there would flip the visual-baseline canaries.
  const hasCatalog = allGames.length > 0;

  const onReroll = workoutFlow.reroll;

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
      <ThemedText type="caption" themeColor="accent" testID="home-brand">
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

      {/* Loading state: brief inline hint while the first db read settles. */}
      {!loaded && (
        <ThemedText
          type="caption"
          themeColor="textSecondary"
          testID="home-loading"
        >
          Loading your training data…
        </ThemedText>
      )}

      {/* Today's Workout CTA slot (constitution §13: primary CTA). */}
      <ThemedView
        type="surface"
        style={styles.ctaCard}
        testID="home-workout-cta"
      >
        <ThemedText type="subtitle">Today&apos;s Workout</ThemedText>
        {workoutStatus === "completed" ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID="home-workout-complete"
          >
            Workout complete — come back tomorrow to train again.
          </ThemedText>
        ) : (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID="home-workout-progress"
          >
            {workoutIndex} of {workout.length} done — keep going!
          </ThemedText>
        )}
        {workout.length > 0 ? (
          <>
            {/* Completion bar mirrors the durable resume position. */}
            <ProgressTrack
              ratio={workoutIndex / workout.length}
              testID="home-workout-progress-bar"
            />
            <ThemedText type="small" themeColor="textSecondary">
              Your daily {workout.length}-game training plan, balanced toward
              your weakest domains. Play any game to earn XP and train your
              ratings.
            </ThemedText>
            <View style={styles.workoutList} testID="home-workout-list">
              {workout.map((game, index) => {
                const isCompleted =
                  workoutStatus === "completed" || index < workoutIndex;
                const isCurrent =
                  workoutStatus === "active" && index === workoutIndex;
                return (
                  <Link
                    key={`${game.id}-${index}`}
                    href={gameHref(
                      game.id,
                      workoutFlow.instance
                        ? {
                            instanceKey: workoutFlow.instance.date,
                            legIndex: index,
                            gameId: game.id,
                          }
                        : null,
                    )}
                    asChild
                  >
                    <Pressable
                      testID={`home-workout-game-${game.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${game.name}, ${game.primaryCategory}, ${
                        isCompleted ? "done" : isCurrent ? "up now" : "up next"
                      }`}
                      style={
                        isCurrent
                          ? StyleSheet.flatten([
                              styles.workoutRow,
                              styles.workoutRowCurrent,
                            ])
                          : styles.workoutRow
                      }
                    >
                      <ThemedText type="smallBold" themeColor="accent">
                        {index + 1}.
                      </ThemedText>
                      <View style={styles.workoutItemText}>
                        <ThemedText type="small">{game.name}</ThemedText>
                        <ThemedText
                          type="caption"
                          themeColor="textSecondary"
                        >
                          {game.primaryCategory}
                        </ThemedText>
                      </View>
                      <ThemedText
                        type="caption"
                        themeColor="textSecondary"
                        testID={`home-workout-game-status-${game.id}`}
                      >
                        {isCompleted ? "Done" : isCurrent ? "Now" : "Up next"}
                      </ThemedText>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
            {/* Primary resume affordance: jumps straight to the current game. */}
            {workoutStatus === "active" && workoutFlow.currentGameId ? (
              <Link
                href={gameHref(
                  workoutFlow.currentGameId,
                  workoutFlow.instance
                    ? {
                        instanceKey: workoutFlow.instance.date,
                        legIndex: workoutFlow.instance.currentIndex,
                        gameId: workoutFlow.currentGameId,
                      }
                    : null,
                )}
                asChild
              >
                <Pressable
                  testID="home-workout-continue"
                  accessibilityRole="button"
                  accessibilityLabel={`Continue today's workout with ${
                    currentGame?.name ?? "the next game"
                  }`}
                >
                  <ThemedView type="accentSoft" style={styles.ctaPill}>
                    <ThemedText type="smallBold" themeColor="accent">
                      Continue workout →
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </Link>
            ) : null}
            <Pressable
              testID="home-workout-reroll"
              accessibilityRole="button"
              accessibilityLabel={rerollLabel}
              accessibilityHint={rerollHint}
              disabled={
                !rerollAffordable ||
                rerollExhausted ||
                workoutStatus === "completed"
              }
              onPress={onReroll}
            >
              <ThemedView
                type={
                  rerollExhausted ||
                  !rerollAffordable ||
                  workoutStatus === "completed"
                    ? "surface"
                    : "accentSoft"
                }
                style={[styles.ctaPill, styles.secondaryPill]}
              >
                <ThemedText type="smallBold" themeColor="accent">
                  {rerollLabel}
                </ThemedText>
              </ThemedView>
            </Pressable>
            {workoutStatus === "active" && (
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                testID="home-reroll-hint"
              >
                {rerollHint}
              </ThemedText>
            )}
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Your daily 4-game training plan will appear here once games are
            registered.
          </ThemedText>
        )}
      </ThemedView>

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

      {/* W24: "More workouts" — Workout V2 rotation menu + length variants,
          started through the engine hook. Secondary to the daily CTA above;
          gated behind a loaded db + installed catalog for visual-baseline
          stability. */}
      {loaded && hasCatalog ? (
        <ThemedView
          type="surface"
          style={styles.ctaCard}
          testID="home-workout-templates"
        >
          <SectionHeader
            title="More workouts"
            caption="Focus training beyond today's mix."
          />
          {templateChoices.length > 0 ? (
            <>
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
              <Pressable
                testID="home-workout-template-start"
                accessibilityRole="button"
                accessibilityLabel={startLabel}
                accessibilityHint={`Starts a ${lengthLabel.toLowerCase()} ${
                  selectedTemplate?.name ?? "workout"
                } session.`}
                disabled={
                  !effectiveTemplateId || startInProgress || selectedCompletedToday
                }
                onPress={onStartTemplate}
              >
                <ThemedView
                  type={
                    effectiveTemplateId && !startInProgress && !selectedCompletedToday
                      ? "accentSoft"
                      : "surface"
                  }
                  style={[styles.ctaPill, styles.secondaryPill]}
                >
                  <ThemedText type="smallBold" themeColor="accent">
                    {startInProgress ? "Starting…" : startLabel}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              All of today&apos;s suggested focus workouts are already on your
              plan.
            </ThemedText>
          )}
        </ThemedView>
      ) : null}

      {/* Streak / XP / level slot — real values when the db is available.
          Coins join the row once a balance exists (economy visibility). */}
      <View style={styles.statsRow}>
        <StatTile
          testID="home-stat-streak"
          label="Streak"
          value={`${currentStreak} days`}
        />
        <StatTile testID="home-stat-xp" label="XP" value={`${data.totalXp}`} />
        <StatTile testID="home-stat-level" label="Level" value={`${level}`} />
        {data.balance > 0 && (
          <StatTile
            testID="home-stat-coins"
            label="Coins"
            value={`${data.balance}`}
          />
        )}
      </View>
      {loaded && streak.atRisk && (
        <ThemedText
          type="caption"
          themeColor="warning"
          testID="home-streak-at-risk"
        >
          Play today to keep your streak alive.
        </ThemedText>
      )}

      {/* Error state: recoverable read failure with an explicit retry.
          `error != null` keeps the guard boolean so the JSX stays ReactNode. */}
      {loaded && error != null && hasCatalog ? (
        <StateCard
          variant="error"
          testID="home-data-error"
          title="Couldn't load your data"
          message="Your training data couldn't be read just now. Your progress stays safely on disk — try again."
          action={{ label: "Retry", onPress: refresh }}
        />
      ) : null}

      {/* Quick actions (constitution §13 order): drill-downs one tap away. */}
      {workout.length > 0 && (
        <View>
          <SectionHeader title="Quick actions" />
          <View style={styles.quickRow} testID="home-quick-actions">
            <Link href="/games" asChild>
              <Pressable
                testID="home-quick-games"
                accessibilityRole="button"
                accessibilityLabel="Browse all games"
              >
                <ThemedView type="surface" style={styles.quickPill}>
                  <ThemedText type="smallBold" themeColor="accent">
                    Browse games
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
            <Link href={"/progress" as any} asChild>
              <Pressable
                testID="home-quick-progress"
                accessibilityRole="button"
                accessibilityLabel="View your progress"
              >
                <ThemedView type="surface" style={styles.quickPill}>
                  <ThemedText type="smallBold" themeColor="accent">
                    Progress
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
            <Link href={"/rewards" as any} asChild>
              <Pressable
                testID="home-quick-rewards"
                accessibilityRole="button"
                accessibilityLabel={
                  data.claimableRewards > 0
                    ? `Open rewards, ${data.claimableRewards} ready to claim`
                    : "Open rewards"
                }
              >
                <ThemedView type="surface" style={styles.quickPill}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {data.claimableRewards > 0
                      ? `Rewards (${data.claimableRewards})`
                      : "Rewards"}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
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
      <ThemedView
        type="surface"
        style={styles.recentCard}
        testID="home-recent-games"
      >
        {data.recentSessions.length > 0 ? (
          <SectionHeader
            title="Recent games"
            actionLabel="Results"
            actionTestID="home-recent-all"
            actionAccessibilityLabel="Open full results history"
            onActionPress={() => router.push("/results")}
          />
        ) : (
          <ThemedText type="subtitle">Recent games</ThemedText>
        )}
        {data.recentSessions.length > 0 ? (
          <View style={styles.recentList}>
            {data.recentSessions.map((session) => (
              <Link key={session.id} href={`/results?id=${session.id}`} asChild>
                <Pressable
                  testID={`home-recent-game-${session.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${session.gameName} result, ${formatRelativeDay(
                    session.completedAt,
                    nowMs,
                  )}, ${Math.round(session.normalizedResult * 100)} percent`}
                  style={({ pressed }) => [
                    styles.recentRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.recentText}>
                    <ThemedText type="small">{session.gameName}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {formatRelativeDay(session.completedAt, nowMs)} · +
                      {session.xp} XP
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold">
                    {Math.round(session.normalizedResult * 100)}%
                  </ThemedText>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Your latest sessions will show up here after your first workout.
          </ThemedText>
        )}
      </ThemedView>

      {/* W24: compact workout-history feed over the engine's history API
          (daily + template workouts, newest first). Data-gated: hidden until
          the first workout exists, keeping first-run trees stable. */}
      {loaded && workoutHistory.length > 0 ? (
        <ThemedView
          type="surface"
          style={styles.recentCard}
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
        </ThemedView>
      ) : null}
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
    // Must stay non-zero: uiautomator drops alpha-0 views from its
    // visible-to-user tree, so a fully transparent marker is invisible to
    // the certify preflight's `source-bundle-bound` probe (device-verified:
    // marker present in hierarchy only after opacity raised). Imperceptible
    // on-device at 0.01.
    opacity: 0.01,
  },
  ctaCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  ctaPill: {
    alignSelf: "flex-start",
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
  secondaryPill: {
    borderWidth: 1,
    borderColor: "rgba(120,120,140,0.2)",
  },
  workoutList: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  workoutItemText: {
    flex: 1,
    gap: Spacing.half,
  },
  workoutRowCurrent: {
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.two,
    backgroundColor: "rgba(0, 122, 255, 0.12)",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  quickPill: {
    ...MinTouchTarget,
    alignSelf: "flex-start",
    borderRadius: Radii.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: "rgba(120,120,140,0.2)",
  },
  recentCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  recentList: {
    gap: Spacing.two,
  },
  recentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  recentText: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
