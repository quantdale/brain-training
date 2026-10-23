/**
 * SymbolTrackerScreen — the Symbol Tracker game (multiple-object identity
 * tracking variant).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Symbol-Tracker-specific — the reducer wiring, the observe
 * pacing timer, the scoring/persistence pipeline, and the board view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels both
 * windows' pacing; resuming continues each remaining window via active-time
 * accumulation (the observe reveal and the respond budget share the exact
 * same freeze-and-continue convention). The board is covered by the opaque
 * shared PauseOverlay and hidden from the accessibility tree while paused, so
 * the answer cannot be read off the UI during a pause.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import {
  assertDevOnly,
  isDevBuild,
  liveAudioHaptics,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { pipelineXpRatingHook } from '@/rating/xp-hook';
import { ThemedText } from '@/components/themed-text';
import { AnimatedNumber, useSafeBack } from '@/components/ui';
import { GameButton, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from '@/components/game-host';

import { Board } from './components/board';
import type { CellVisualState } from './components/cell';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import {
  sessionChallengeRating,
  symbolTrackerParamsFromProfile,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createSymbolTrackerTutorialLifecycle,
} from './hooks';
import { symbolTrackerGameReducer } from './reducer';
import { normalizeSymbolTrackerResult } from './scoring';
import {
  buildSymbolTrackerRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSymbolTrackerSession,
} from './session';
import type { SessionPersistence } from './session';
import { SCORING_VERSION } from './versions';
import { continuationStamp, ownsContinuation, GAME_ID, createInitialSymbolTrackerState } from './types';
import type { ResultContinuationStamp, SymbolTrackerAction } from './types';
import { freezeWindow, readWindowElapsed } from './observed-window';
import type { ObservedWindow } from './observed-window';

export interface SymbolTrackerScreenProps {
  /** Injectable clock for session timing (tests); defaults to the system clock. */
  clock?: Clock;
  /** Injectable tutorial persistence (tests); defaults to an in-memory store. */
  tutorialStore?: TutorialStore;
  /** Fixed session seed (tests); defaults to a random per-session seed. */
  sessionSeed?: string | number;
  /** Injectable session persister (tests); defaults to the db layer. */
  persistSession?: SessionPersistence;
  /** Injectable XP/rating hook; defaults to the shared pipeline-backed hook. */
  xpHook?: XpRatingHook;
}

/** Rendering/expiry-notice cadence only; measured exposure owns the budget. */
const OBSERVE_TICK_MS = 100;

export default function SymbolTrackerScreen(props: SymbolTrackerScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const theme = useTheme();
  const goBack = useSafeBack('/games');
  const [state, reactDispatch] = useReducer(
    symbolTrackerGameReducer,
    undefined,
    createInitialSymbolTrackerState,
  );

  const stateRef = useRef(state);
  const windowRef = useRef<ObservedWindow | null>(null);
  const presentedCueRef = useRef<ResultContinuationStamp | null>(null);
  const deliveredPresses = useRef(new WeakSet<object>());
  // Claim selection, submit and lifecycle boundaries synchronously while
  // keeping distinct known-symbol taps valid within one React batch.
  const dispatch = useCallback((action: SymbolTrackerAction) => {
    const current = stateRef.current;
    const next = symbolTrackerGameReducer(current, action);
    if (next === current) return null;
    if (next.paused || next.tutorialOpen || next.sessionId !== current.sessionId ||
        next.roundIndex !== current.roundIndex || next.phase !== current.phase) {
      freezeWindow(windowRef.current, clock.now());
    }
    stateRef.current = next;
    reactDispatch(action);
    return next;
  }, [clock]);
  const dispatchContinuation = dispatch;
  useLayoutEffect(() => { stateRef.current = state; });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'observe' ||
          current.phase === 'respond' ||
          current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatchContinuation({ type: 'pause' }),
  });

  const renderedContinuation = continuationStamp(state);
  const handleContinue = () => {
    if (session.status() !== 'active' || !session.isCurrentSession(renderedContinuation.sessionId)) {
      return;
    }
    const current = stateRef.current;
    const action: SymbolTrackerAction = {
      type: 'next-round', stamp: renderedContinuation,
    };
    const next = symbolTrackerGameReducer(current, action);
    if (next === current) return;
    dispatch(action);
  };

  const tutorial = useMemo(
    () => createSymbolTrackerTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const forceWin = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-win' }); }, [dispatch]);
  const forceLose = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-lose' }); }, [dispatch]);
  const forceTimeout = useCallback(() => {
    assertDevOnly();
    dispatch({ type: stateRef.current.phase === 'respond' ? 'respond-deadline' : 'observe-tick' });
  }, [dispatch]);

  const params =
    state.profile !== null ? symbolTrackerParamsFromProfile(state.profile) : null;
  const observeMs = params?.observeMs ?? 2200;
  const gridSize = params?.gridSize ?? 9;
  const rounds = params?.rounds ?? 5;
  const inSession =
    state.phase === 'observe' ||
    state.phase === 'respond' ||
    state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  const respondDeadlineMs = params?.respondDeadlineMs ?? 7000;
  const renderedCue = useMemo<ResultContinuationStamp>(() => ({ sessionId: state.sessionId, roundIndex: state.roundIndex, phase: state.phase, epoch: state.continuationEpoch }), [state.sessionId, state.roundIndex, state.phase, state.continuationEpoch]);
  const readStatus = session.status;

  // The highlighted board and then the scrambled board each receive their
  // own exposure from display commit, even when the preceding JS task stalls.
  useLayoutEffect(() => {
    if ((state.phase !== 'observe' && state.phase !== 'respond') || state.paused || state.tutorialOpen || readStatus() !== 'active') return;
    const previous = windowRef.current;
    const samePhase = previous !== null && previous.sessionId === state.sessionId && previous.roundIndex === state.roundIndex && previous.phase === state.phase;
    const window: ObservedWindow = { sessionId: state.sessionId, roundIndex: state.roundIndex, phase: state.phase,
      elapsedMs: samePhase ? previous.elapsedMs : 0, startedAtMs: clock.now() };
    windowRef.current = window;
    presentedCueRef.current = renderedCue;
    const observed = window;
    return () => freezeWindow(observed, clock.now());
  }, [state.phase, state.paused, state.tutorialOpen, state.sessionId, state.roundIndex, renderedCue, readStatus, clock]);

  useEffect(() => {
    if ((state.phase !== 'observe' && state.phase !== 'respond') || state.paused || state.tutorialOpen) return;
    const observed = windowRef.current;
    if (observed === null) return;
    const durationMs = state.phase === 'observe' ? observeMs : respondDeadlineMs;
    let cancelled = false;
    const interval = setInterval(() => {
      const current = stateRef.current;
      if (cancelled || readStatus() !== 'active' || windowRef.current !== observed || !ownsContinuation(current, renderedCue)) return;
      if (readWindowElapsed(observed, clock.now()) >= durationMs) {
        dispatch({ type: renderedCue.phase === 'observe' ? 'observe-tick' : 'respond-deadline', stamp: renderedCue });
      }
    }, OBSERVE_TICK_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [state.phase, state.paused, state.tutorialOpen, renderedCue, observeMs, respondDeadlineMs, clock, readStatus, dispatch]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial, dispatch]);

  // ---- Round outcome audio/haptics (canonical feedback events only).
  useEffect(() => {
    if (state.roundOutcome === 'passed') {
      liveAudioHaptics.feedback('correct');
    } else if (state.roundOutcome === 'failed') {
      liveAudioHaptics.feedback('wrong');
    }
  }, [state.roundOutcome]);

  // ---- Session finalization: complete the lifecycle, run the SDK scoring
  // pipeline (raw → normalized → XP hook), and persist atomically.
  // `claimFinalize()` guards against double submission (once per session).
  useEffect(() => {
    if (
      state.phase !== 'results' ||
      state.profile === null ||
      state.sessionId === null ||
      state.startedAtMs === null ||
      !session.claimFinalize()
    ) {
      return;
    }

    session.completeIfActive();
    const activeDurationMs = session.elapsedMs();
    const pausedDurationMs = session.pausedDurationMs();
    const completedAtMs = Date.now();
    const difficulty = state.difficulty ?? 'normal';
    const resolvedParams = symbolTrackerParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.trackCount,
    );

    const raw = buildSymbolTrackerRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
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
    const normalized = normalizeSymbolTrackerResult(raw, context);
    const xp = xpHook.computeXp(normalized, context);
    xpHook.computeRatingDeltas(normalized, context);

    dispatch({
      type: 'session-finalized',
      xp,
      normalized: normalized.value,
      activeDurationMs,
      pausedDurationMs,
      completedAtMs,
    });

    const record = buildSessionRecord({
      sessionId: state.sessionId,
      rawResult: raw,
      // Rating pipeline reads the final computed challenge from the record
      // difficulty, not the SDK baseline profile (006r adaptive contract).
      difficulty: { ...state.profile, challengeRating },
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: 'persistence-started' });
    void persistSymbolTrackerSession(record, persistSession).then((outcome) => {
      if (!session.isCurrentSession(record.id)) return;
      if (outcome.ok) {
        dispatch({ type: 'persistence-succeeded' });
        const co = outcome.result.completionOutcome;
        if (co) {
          dispatch({
            type: 'completion-outcome-received',
            xp: co.xp,
            currency: co.currency,
            deltas: co.deltas,
          });
        }
      } else {
        dispatch({
          type: 'persistence-failed',
          message: String(outcome.error),
        });
      }
    });
  }, [
    state.phase,
    state.profile,
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.trackCount,
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
      dispatchContinuation({ type: 'resume' });
    }
  }, [session, dispatchContinuation]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    goBack();
  }, [session, goBack]);

  const handleTapCell = useCallback((index: number, event?: GestureResponderEvent) => {
    const current = stateRef.current;
    const observed = windowRef.current;
    const presented = presentedCueRef.current;
    if (readStatus() !== 'active' || current.phase !== 'respond' || current.roundScored ||
        !ownsContinuation(current, renderedCue) || observed === null || observed.startedAtMs === null ||
        presented === null || !ownsContinuation(current, presented)) return;
    const nativePress = event?.nativeEvent;
    if (nativePress != null) {
      if (deliveredPresses.current.has(nativePress)) return;
      deliveredPresses.current.add(nativePress);
    }
    if (readWindowElapsed(observed, clock.now()) >= respondDeadlineMs) {
      dispatch({ type: 'respond-deadline', stamp: renderedCue });
      return;
    }
    // Empty, stale and duplicate deliveries produce no optimistic tap cue.
    if (dispatch({ type: 'tap-cell', index, stamp: renderedCue }) !== null) liveAudioHaptics.feedback('tap');
  }, [renderedCue, readStatus, clock, respondDeadlineMs, dispatch]);

  const handleSubmit = useCallback(() => {
    const current = stateRef.current;
    const observed = windowRef.current;
    const presented = presentedCueRef.current;
    if (readStatus() !== 'active' || current.phase !== 'respond' || current.roundScored ||
        !ownsContinuation(current, renderedCue) || observed === null || observed.startedAtMs === null ||
        presented === null || !ownsContinuation(current, presented)) return;
    dispatch({ type: readWindowElapsed(observed, clock.now()) >= respondDeadlineMs ? 'respond-deadline' : 'submit', stamp: renderedCue });
  }, [renderedCue, readStatus, clock, respondDeadlineMs, dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    if ((current.phase !== "intro" && current.phase !== "results") || current.paused || current.tutorialOpen) return;
    // A result may be claimed before its finalization effect commits.
    // Restart only after the old SDK lifecycle is terminal, never replace it.
    const status = session.status();
    if (status !== null && status !== 'completed' && status !== 'abandoned') return;
    const seed = current.seedOverride ?? resolveSessionSeed(sessionSeed);
    const identity = session.begin();
    dispatch({
      type: 'start-session',
      seed,
      sessionId: identity.sessionId,
      startedAtMs: identity.startedAtMs,
    });
  }, [session, sessionSeed, dispatch]);

  const handleRestart = handleStart;

  // ---- Tutorial controls.
  const openTutorial = useCallback(() => {
    tutorial.requestReplay(GAME_ID);
    dispatch({ type: 'tutorial-open' });
  }, [tutorial, dispatch]);

  const completeTutorial = useCallback(() => {
    tutorial.complete(GAME_ID);
    dispatch({ type: 'tutorial-close' });
  }, [tutorial, dispatch]);

  const skipTutorial = useCallback(() => {
    tutorial.skipForQa(GAME_ID);
    dispatch({ type: 'tutorial-close' });
  }, [tutorial, dispatch]);

  // ---- Cell visuals. Stable across per-round re-renders; depends only on
  // round-transition state, never on observe ticks, so the memoized board skips
  // re-rendering cells whose visual is unchanged.
  const visualFor = useCallback(
    (index: number): CellVisualState => {
      if (state.phase === 'observe') {
        const symbolId = state.observeBoard[index];
        return symbolId !== undefined && state.trackedSymbolIds.includes(symbolId)
          ? 'target'
          : 'idle';
      }
      if (state.phase === 'respond') {
        const symbolId = state.respondBoard[index];
        return symbolId !== undefined && state.selections.includes(symbolId)
          ? 'selected'
          : 'idle';
      }
      if (state.phase === 'roundResult') {
        const symbolId = state.respondBoard[index] ?? -1;
        const isTracked = state.trackedSymbolIds.includes(symbolId);
        const isSelected = state.selections.includes(symbolId);
        if (isSelected && !isTracked) {
          return 'error';
        }
        if (isTracked) {
          return 'correct';
        }
        return 'idle';
      }
      return 'idle';
    },
    [state.phase, state.observeBoard, state.respondBoard, state.selections, state.trackedSymbolIds],
  );

  const board =
    state.phase === 'observe' ? state.observeBoard : state.respondBoard;

  const view =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  return (
    <GameHost
      gameId={GAME_ID}
      sessionId={state.sessionId}
      description={gameDefinition.description}
      view={view}
      paused={state.paused}
      difficulty={state.difficulty}
      onSelectDifficulty={(level) => dispatch({ type: 'select-difficulty', level })}
      onStart={handleStart}
      onHelp={openTutorial}
      onPause={pauseSession}
      onResume={resumeSession}
      onQuit={quitToLibrary}
      interceptBack={inSession}
      score={String(state.stats.score)}
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
      header={
        <>
          <ThemedText
            type="subtitle"
            testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}
           themeColor="stageInk">
            Round {state.roundIndex + 1}/{rounds}
          </ThemedText>
          {state.phase === 'observe' ? (
            <ThemedText
              type="small"
              themeColor="stageMuted"
              testID={testId(GAME_ID, 'observe-status')}
            >
              Track {state.trackCount} symbols
            </ThemedText>
          ) : null}
        </>
      }
      qaPanel={
        <QaPanel
          onForceWin={forceWin}
          onForceLose={forceLose}
          onForceTimeout={forceTimeout}
        />
      }
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
          {/* Live score: count-up readout visible through every session phase;
          the prompt/stem below stays mounted, so feedback never covers it. */}
          <View
            style={styles.scoreRow}
            accessibilityLabel={`Score ${state.stats.score}`}>
            <ThemedText type="caption" themeColor="textSecondary">
              Score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeral"
              testID={testId(GAME_ID, 'score-live')}
            />
          </View>
          {state.phase === 'observe' ? (
            <>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'reveal-status')}
              >
                Memorize the highlighted symbols…
              </ThemedText>
              <Board
                gridSize={gridSize}
                board={board}
                testID={testId(GAME_ID, 'observe-board')}
                visualFor={visualFor}
                disabled
                onPressCell={handleTapCell}
              />
            </>
          ) : null}

          {state.phase === 'respond' ? (
            <>
              <View style={styles.statusRow}>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'respond-status')}
                >
                  Pick out the tracked symbols
                </ThemedText>
                <View
                  style={styles.dots}
                  testID={testId(GAME_ID, 'progress')}
                  accessibilityLabel={`${state.selections.length} of ${state.trackCount} symbols selected`}
                >
                  {Array.from({ length: state.trackCount }, (_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            i < state.selections.length
                              ? theme.attention
                              : theme.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID={testId(GAME_ID, 'respond-budget')}
                >
                  {Math.round(respondDeadlineMs / 1000)}s to answer
                </ThemedText>
              </View>
              <Board
                gridSize={gridSize}
                board={board}
                testID={testId(GAME_ID, 'respond-board')}
                visualFor={visualFor}
                onPressCell={handleTapCell}
              />
              <GameButton
                testID={testId(GAME_ID, 'submit')}
                label="Check answer"
                onPress={handleSubmit}
              />
            </>
          ) : null}

          {state.phase === 'roundResult' ? (
            <View
              style={styles.section}
              testID={testId(GAME_ID, 'round-result')}
            >
              <ThemedText
                type="headline"
                themeColor={
                  state.roundOutcome === 'passed' ? 'success' : 'danger'
                }
                testID={testId(
                  GAME_ID,
                  state.roundOutcome === 'passed'
                    ? 'round-passed'
                    : 'round-failed',
                )}
              >
                {state.roundOutcome === 'passed'
                  ? 'All tracked!'
                  : 'Not quite'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You found {state.roundCorrectTargets} of{' '}
                {state.trackCount} tracked symbols
                {state.roundWrongTaps > 0
                  ? ` (${state.roundWrongTaps} wrong pick${state.roundWrongTaps > 1 ? 's' : ''})`
                  : ''}
              </ThemedText>
              {state.respondTimedOut ? (
                <ThemedText
                  type="small"
                  themeColor="warning"
                  testID={testId(GAME_ID, 'respond-timeout')}
                >
                  Time ran out — your picks were submitted as they stood.
                </ThemedText>
              ) : null}
              <Board
                gridSize={gridSize}
                board={board}
                testID={testId(GAME_ID, 'round-result-board')}
                visualFor={visualFor}
                disabled
                onPressCell={handleTapCell}
              />
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={handleContinue}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {state.phase === 'results' ? (
        <GameResults
          reward={{
            xp: state.authoritativeXp ?? state.xp,
            coins: state.authoritativeCurrency ?? 0,
          }}
          gameId={GAME_ID}
          normalizedResult={state.normalized ?? undefined}
          forced={state.forced}
          persistState={state.persistState}
          lastError={state.lastError}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          {/* Count-up final score beside the existing rows; StatRows stay untouched. */}
          <View
            style={styles.scoreHero}
            accessibilityLabel={`Final score ${state.stats.score}`}>
            <ThemedText type="caption" themeColor="textSecondary">
              Final score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeralLg"
              testID={testId(GAME_ID, 'score-animated')}
            />
          </View>
          <StatRow
            label="Accuracy"
            value={`${Math.round(
              (state.stats.roundsPlayed > 0
                ? state.stats.roundsPassed / state.stats.roundsPlayed
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Rounds passed"
            value={`${state.stats.roundsPassed}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'rounds-passed')}
          />
          <StatRow
            label="Best recall"
            value={String(state.stats.bestRecall)}
            testID={testId(GAME_ID, 'best-recall')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="XP"
            value={String(state.authoritativeXp ?? state.xp)}
            testID={testId(GAME_ID, 'xp')}
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  scoreHero: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.oneHalf,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
