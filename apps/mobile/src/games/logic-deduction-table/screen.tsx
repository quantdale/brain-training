/**
 * LogicDeductionScreen — the Deduction Table game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Deduction-Table-specific — the reducer wiring, the per-round
 * expiry timeout, the scoring/persistence pipeline, and the puzzle view. All
 * gameplay timing comes from the injectable SDK monotonic clock.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the round
 * deadline; resuming re-arms the remaining budget. The screen is covered by
 * the opaque shared `PauseOverlay` and hidden from the accessibility tree
 * while paused, so the puzzle cannot be studied during a pause.
 */
import { AppIcon } from '@/components/ui/app-icon';
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { GestureResponderEvent } from "react-native";

import { isDevBuild, liveAudioHaptics, systemClock, testId } from "@/sdk";
import type { Clock, TutorialStore, XpRatingHook } from "@/sdk";
import { pipelineXpRatingHook } from "@/rating/xp-hook";
import { ThemedText } from "@/components/themed-text";
import { AnimatedNumber, useSafeBack } from "@/components/ui";
import { GameButton, StatRow } from "@/components/game-ui";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from "@/components/game-host";

import { ClueTable } from "./components/clue-table";
import { Option } from "./components/option";
import type { OptionVisualState } from "./components/option";
import { QaPanel } from "./components/qa-panel";
import { Tutorial } from "./components/tutorial";
import {
  logicDeductionParamsFromProfile,
  sessionChallengeRating,
} from "./difficulty";
import { gameDefinition } from "./game-definition";
import {
  createLogicDeductionQaForceStateHooks,
  createLogicDeductionTutorialLifecycle,
} from "./hooks";
import { logicDeductionReducer } from "./reducer";
import { normalizeLogicDeductionResult } from "./scoring";
import {
  buildLogicDeductionRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistLogicDeductionSession,
} from "./session";
import type { SessionPersistence } from "./session";
import { GAME_ID, createInitialLogicDeductionState, type LogicDeductionAction } from "./types";
import { SCORING_VERSION } from "./versions";

export interface LogicDeductionScreenProps {
  /** Injectable clock for session timing (tests); defaults to the system clock. */
  clock?: Clock;
  /** Injectable tutorial persistence (tests); defaults to an in-memory store. */
  tutorialStore?: TutorialStore;
  /** Fixed session seed (tests); defaults to a random per-session seed. */
  sessionSeed?: string | number;
  /** Injectable session persister (tests); defaults to the db layer. */
  persistSession?: SessionPersistence;
  /** Injectable XP/rating hook; defaults to the pipeline-backed hook. */
  xpHook?: XpRatingHook;
}

export default function LogicDeductionScreen(
  props: LogicDeductionScreenProps = {},
) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const goBack = useSafeBack('/games');
  const theme = useTheme();
  const [state, dispatchReducer] = useReducer(
    logicDeductionReducer,
    undefined,
    createInitialLogicDeductionState,
  );

  const stateRef = useRef(state);
  const deliveredPresses = useRef(new WeakSet<object>());
  const claimPress = useCallback((event?: GestureResponderEvent) => {
    const payload = event?.nativeEvent;
    if (payload == null) return true;
    if (deliveredPresses.current.has(payload)) return false;
    deliveredPresses.current.add(payload);
    return true;
  }, []);
  // Retire rendered callbacks synchronously, before React commits a boundary.
  const dispatch = useCallback((action: LogicDeductionAction) => {
    const current = stateRef.current;
    const next = logicDeductionReducer(current, action);
    if (next === current) return;
    stateRef.current = next;
    dispatchReducer(action);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return current.phase === "question" && !current.paused;
    },
    onPause: () => dispatch({ type: "pause", nowMs: clock.now() }),
  });

  const { status: readStatus, isCurrentSession } = session;
  const renderedEpoch = state.continuationEpoch;
  const renderedSessionId = state.sessionId;
  const renderedRoundIndex = state.roundIndex;
  const renderedPhase = state.phase;
  const ownsRenderedInput = useCallback(() => {
    const current = stateRef.current;
    return readStatus() === 'active' && isCurrentSession(renderedSessionId) &&
      current.continuationEpoch === renderedEpoch && current.sessionId === renderedSessionId &&
      current.roundIndex === renderedRoundIndex && current.phase === renderedPhase &&
      !current.paused && !current.tutorialOpen;
  }, [readStatus, isCurrentSession, renderedEpoch, renderedSessionId, renderedRoundIndex, renderedPhase]);

  const tutorial = useMemo(
    () => createLogicDeductionTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  // Construct the dev-only adapter inside the event; no state ref is read during render.
  const qaHooks = {
    forceWin: () => createLogicDeductionQaForceStateHooks(dispatch).forceWin(),
    forceLose: () => createLogicDeductionQaForceStateHooks(dispatch).forceLose(),
    forceTimeout: () => createLogicDeductionQaForceStateHooks(dispatch).forceTimeout(),
  };

  const rounds = state.params?.rounds ?? 6;
  const budgetSeconds = Math.max(
    1,
    Math.round((state.params?.roundTimeMs ?? 24_000) / 1000),
  );
  const inSession = state.phase === "question" || state.phase === "roundResult";
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Per-round expiry timer: fires once at the round deadline. Pausing
  // deactivates the timeout (effect cleanup) and the reducer freezes the
  // remaining budget; resuming re-arms a fresh timeout for whatever is left.
  useEffect(() => {
    if (state.phase !== 'question' || state.paused || state.tutorialOpen || state.roundDeadlineMs === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      if (cancelled || !ownsRenderedInput()) return;
      const deadline = stateRef.current.roundDeadlineMs;
      if (deadline === null) return;
      const remaining = deadline - clock.now();
      if (remaining > 0) {
        timer = setTimeout(wake, Math.max(1, Math.ceil(remaining)));
        return;
      }
      dispatch({ type: 'expire-round', nowMs: clock.now() });
    };
    timer = setTimeout(wake, Math.max(0, state.roundDeadlineMs - clock.now()));
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state.phase, state.paused, state.tutorialOpen, state.roundDeadlineMs, ownsRenderedInput, clock, dispatch]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: "tutorial-open" });
    }
  }, [tutorial, dispatch]);

  // ---- Session finalization: complete the lifecycle, run the SDK scoring
  // pipeline (raw → normalized → XP hook), and persist atomically.
  // `claimFinalize()` guards against double submission (once per session).
  useEffect(() => {
    if (
      state.phase !== "results" ||
      !session.claimFinalize() ||
      state.profile === null ||
      state.params === null ||
      state.sessionId === null ||
      state.startedAtMs === null
    ) {
      return;
    }

    session.completeIfActive();
    const activeDurationMs = session.elapsedMs();
    const pausedDurationMs = session.pausedDurationMs();
    const completedAtMs = Date.now();
    const difficulty = state.difficulty ?? "normal";
    // `state.params` carries the adaptive escalation applied by the reducer;
    // the resolved profile is the immutable session-start baseline.
    const resolvedParams =
      state.params ?? logicDeductionParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.entityCount,
      resolvedParams.attributeCount,
    );

    const raw = buildLogicDeductionRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      outcomes: state.roundOutcomes,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = {
      gameId: GAME_ID,
      difficulty,
      durationMs: activeDurationMs,
    };
    const normalized = normalizeLogicDeductionResult(raw, context);
    const xp = xpHook.computeXp(normalized, context);
    xpHook.computeRatingDeltas(normalized, context);

    dispatch({
      type: "session-finalized",
      xp,
      normalized: normalized.value,
      activeDurationMs,
      pausedDurationMs,
      completedAtMs,
    });

    const record = buildSessionRecord({
      sessionId: state.sessionId,
      rawResult: raw,
      // The record's structured difficulty is authoritative for the shared
      // rating pipeline: it carries the final computed challenge rating and
      // the params of the final (escalated) adaptive round.
      difficulty: {
        ...state.profile,
        challengeRating,
        parameters: {
          ...state.profile.parameters,
          entityCount: resolvedParams.entityCount,
          attributeCount: resolvedParams.attributeCount,
          clueCount: resolvedParams.clueCount,
          roundTimeMs: resolvedParams.roundTimeMs,
        },
      },
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: "persistence-started" });
    void persistLogicDeductionSession(record, persistSession).then(
      (outcome) => {
        if (!session.isCurrentSession(record.id)) return;
        if (outcome.ok) {
          dispatch({ type: "persistence-succeeded" });
          const co = outcome.result.completionOutcome;
          if (co) {
            dispatch({
              type: "completion-outcome-received",
              xp: co.xp,
              currency: co.currency,
              deltas: co.deltas,
            });
          }
        } else {
          dispatch({
            type: "persistence-failed",
            message: String(outcome.error),
          });
        }
      },
    );
  }, [
    state.phase,
    state.profile,
    state.params,
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.roundOutcomes,
    state.difficulty,
    session,
    xpHook,
    persistSession,
    dispatch,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    if (session.resumeIfPaused()) {
      dispatch({ type: "resume", nowMs: clock.now() });
    }
  }, [session, clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    goBack();
  }, [session, goBack]);

  const handleAnswer = useCallback(
    (index: number, event?: GestureResponderEvent) => {
      if (!ownsRenderedInput() || !claimPress(event)) return;
      const current = stateRef.current;
      if (
        current.phase !== "question" ||
        current.paused ||
        current.roundDeadlineMs === null
      ) {
        return;
      }
      const nowMs = clock.now();
      if (nowMs >= current.roundDeadlineMs) {
        dispatch({ type: 'expire-round', nowMs });
        return;
      }
      const action: LogicDeductionAction = { type: 'answer-option', index, nowMs };
      const next = logicDeductionReducer(current, action);
      if (next === current) return;
      dispatch(action);
      if (next.roundOutcome === 'correct') liveAudioHaptics.feedback('correct');
      else if (next.roundOutcome === 'wrong') liveAudioHaptics.feedback('wrong');
    },
    [clock, dispatch, ownsRenderedInput, claimPress],
  );

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    if (current.continuationEpoch !== renderedEpoch || current.sessionId !== renderedSessionId ||
        current.phase !== renderedPhase || current.roundIndex !== renderedRoundIndex) return;
    if ((current.phase !== 'intro' && current.phase !== 'results') || current.tutorialOpen ||
        session.status() === 'active' || session.status() === 'paused' || session.status() === 'abandoned') return;
    const seed = current.seedOverride ?? resolveSessionSeed(sessionSeed);
    const identity = session.begin();
    dispatch({
      type: "start-session",
      seed,
      sessionId: identity.sessionId,
      startedAtMs: identity.startedAtMs,
      nowMs: clock.now(),
    });
  }, [session, sessionSeed, clock, dispatch, renderedEpoch, renderedSessionId, renderedPhase, renderedRoundIndex]);

  const handleRestart = handleStart;

  // ---- Tutorial controls.
  const openTutorial = useCallback(() => {
    if (stateRef.current.phase !== 'intro') return;
    tutorial.requestReplay(GAME_ID);
    dispatch({ type: "tutorial-open" });
  }, [tutorial, dispatch]);

  const completeTutorial = useCallback(() => {
    tutorial.complete(GAME_ID);
    dispatch({ type: "tutorial-close" });
  }, [tutorial, dispatch]);

  const skipTutorial = useCallback(() => {
    tutorial.skipForQa(GAME_ID); // dev-only (assertDevOnly inside)
    dispatch({ type: "tutorial-close" });
  }, [tutorial, dispatch]);

  // ---- Option visuals. During the question every card is neutral (no hint);
  // after scoring the true answer lights up, the player's own wrong pick is
  // marked, and everything else mutes out.
  const visualFor = useCallback(
    (index: number): OptionVisualState => {
      if (state.phase === "question" || state.round === null) return "idle";
      if (index === state.round.correctIndex) return "correct";
      if (index === state.lastAnswerIndex) return "wrong";
      return "muted";
    },
    [state.phase, state.round, state.lastAnswerIndex],
  );

  const roundResultMessage =
    state.roundOutcome === "correct"
      ? "Correct!"
      : state.roundOutcome === "timeout"
        ? "Time’s up"
        : "Not quite";

  return (
    <GameHost
      gameId={GAME_ID}
      description={gameDefinition.description}
      view={inSession ? "session" : state.phase === "results" ? "results" : "intro"}
      paused={state.paused}
      difficulty={state.difficulty}
      onSelectDifficulty={(level) =>
        dispatch({ type: "select-difficulty", level })
      }
      onStart={handleStart}
      onHelp={openTutorial}
      onPause={pauseSession}
      onResume={resumeSession}
      onQuit={quitToLibrary}
      interceptBack={inSession}
      header={
        <ThemedText
          type="subtitle"
          testID={testId(GAME_ID, "round", String(state.roundIndex + 1))}
         themeColor="stageInk">
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
          onForceTimeout={qaHooks.forceTimeout}
        />
      }
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial
          onComplete={completeTutorial}
          onSkip={isDevBuild() ? skipTutorial : undefined}
        />
      }>
      {inSession ? (
        <>
          <View style={styles.scoreStrip}>
            <ThemedText type="small" themeColor="textSecondary">
              Score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeral"
              themeColor="text"
              testID={testId(GAME_ID, "score-live")}
            />
          </View>
          {state.phase === "question" && state.round !== null ? (
            <View style={styles.section}>
              <ClueTable
                round={state.round}
                testID={testId(GAME_ID, "clue-table")}
              />
              <View style={styles.clues}>
                {state.round.clues.map((clue, i) => (
                  <ThemedText
                    key={i}
                    type="small"
                    themeColor="textSecondary"
                    testID={testId(GAME_ID, "clue", String(i))}
                  >
                    • {clue.text}
                  </ThemedText>
                ))}
              </View>
              <ThemedText
                type="headline"
                testID={testId(GAME_ID, "question")}
                accessibilityLabel={state.round.question.text}
              >
                {state.round.question.text}
              </ThemedText>
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                testID={testId(GAME_ID, "time-budget")}
              >
                Answer within {budgetSeconds}s
              </ThemedText>
              <View style={styles.options}>
                {state.round.options.map((value, index) => (
                  <Option
                    key={index}
                    index={index}
                    label={value}
                    visual={visualFor(index)}
                    onPressOption={handleAnswer}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {state.phase === "roundResult" && state.round !== null ? (
            <View style={styles.section} testID={testId(GAME_ID, "round-result")}>
              <ClueTable
                round={state.round}
                testID={testId(GAME_ID, "clue-table")}
              />
              <ThemedText
                type="headline"
                testID={testId(GAME_ID, "question")}
                accessibilityLabel={state.round.question.text}
              >
                {state.round.question.text}
              </ThemedText>
              <View
                style={[
                  styles.verdict,
                  {
                    backgroundColor:
                      state.roundOutcome === "correct"
                        ? theme.successSoft
                        : state.roundOutcome === "timeout"
                          ? theme.warningSoft
                          : theme.dangerSoft,
                    borderColor:
                      state.roundOutcome === "correct"
                        ? theme.success
                        : state.roundOutcome === "timeout"
                          ? theme.warning
                          : theme.danger,
                  },
                ]}
                testID={testId(GAME_ID, "round-verdict")}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        state.roundOutcome === "correct"
                          ? theme.success
                          : state.roundOutcome === "timeout"
                            ? theme.warning
                            : theme.danger,
                    },
                  ]}
                  importantForAccessibility="no-hide-descendants"
                  testID={testId(GAME_ID, "round-verdict-glyph")}>
                  <AppIcon name={state.roundOutcome === "correct" ? 'check' : state.roundOutcome === "timeout" ? 'time' : 'close'} color={state.roundOutcome === "correct"
                          ? theme.successOn
                          : state.roundOutcome === "timeout"
                            ? theme.warningOn
                            : theme.dangerOn} size={20} />
                </View>
                <ThemedText
                  type="headline"
                  themeColor={
                    state.roundOutcome === "correct"
                      ? "success"
                      : state.roundOutcome === "timeout"
                        ? "warning"
                        : "danger"
                  }
                  testID={testId(
                    GAME_ID,
                    state.roundOutcome === "correct"
                      ? "round-correct"
                      : state.roundOutcome === "timeout"
                        ? "round-timeout"
                        : "round-wrong",
                  )}
                >
                  {roundResultMessage}
                </ThemedText>
                {state.roundOutcome !== "correct" ? (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    testID={testId(GAME_ID, "round-answer-reveal")}
                  >
                    The answer was {state.round.answer}
                  </ThemedText>
                ) : null}
              </View>
              <View style={styles.options}>
                {state.round.options.map((value, index) => (
                  <Option
                    key={index}
                    index={index}
                    label={value}
                    visual={visualFor(index)}
                    selected={index === state.lastAnswerIndex}
                    disabled
                    onPressOption={handleAnswer}
                  />
                ))}
              </View>
              <GameButton
                testID={testId(GAME_ID, "next-round")}
                label={isLastRound ? "See results" : "Next round"}
                onPress={() => {
                  if (ownsRenderedInput()) dispatch({ type: 'next-round', nowMs: clock.now() });
                }}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {state.phase === "results" ? (
        <GameResults
          reward={{
            xp: state.authoritativeXp ?? state.xp,
            coins: state.authoritativeCurrency ?? 0,
          }}
          gameId={GAME_ID}
          normalizedResult={state.normalized ?? undefined}
          persistState={state.persistState}
          lastError={state.lastError}
          forced={state.forced}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          <View style={styles.finalScore}>
            <ThemedText type="small" themeColor="textSecondary">
              Final score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeralLg"
              themeColor="text"
              testID={testId(GAME_ID, "score-final")}
            />
          </View>
          <StatRow
            label="Accuracy"
            value={`${Math.round(
              (state.stats.roundsPlayed > 0
                ? state.stats.roundsCorrect / state.stats.roundsPlayed
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, "accuracy")}
          />
          <StatRow
            label="Rounds correct"
            value={`${state.stats.roundsCorrect}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, "rounds-correct")}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, "best-streak")}
          />
          <StatRow
            label="Avg answer time"
            value={
              state.stats.roundsPlayed > 0
                ? `${(state.stats.totalAnswerMs / state.stats.roundsPlayed / 1000).toFixed(1)}s`
                : "—"
            }
            testID={testId(GAME_ID, "avg-time")}
          />
          <StatRow
            label="XP"
            value={String(state.authoritativeXp ?? state.xp)}
            testID={testId(GAME_ID, "xp")}
          />
        </GameResults>
      ) : null}
    </GameHost>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  clues: {
    gap: Spacing.one,
  },
  options: {
    gap: Spacing.two,
  },
  // Round verdict: soft verdict fill + verdict border + opaque glyph badge,
  // so the outcome reads on the dense board without leaning on hue.
  verdict: {
    gap: Spacing.three,
    alignItems: "center",
    borderRadius: Radii.large,
    borderWidth: 2,
    padding: Spacing.four,
  },
  // Opaque verdict badge: the icon/shape half of the verdict channel.
  badge: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  scoreStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  finalScore: {
    alignItems: "center",
    gap: Spacing.one,
  },
});
