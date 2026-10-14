/**
 * GridRecallScreen — the Grid Recall game (simultaneous pattern-recall variant).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Grid-Recall-specific — the reducer wiring, the study pacing
 * timer, the scoring/persistence pipeline, and the board view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels study
 * pacing; resuming re-shows the pattern for the remaining study window; the
 * board is covered by the opaque shared PauseOverlay and hidden from the
 * accessibility tree while paused, so the answer cannot be read off the UI
 * during a pause.
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
import { GameButton, StatRow } from '@/components/game-ui';
import { AnimatedNumber, useSafeBack } from '@/components/ui';
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
  gridRecallParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createGridRecallTutorialLifecycle,
} from './hooks';
import { gridRecallGameReducer } from './reducer';
import { normalizeGridRecallResult } from './scoring';
import {
  buildGridRecallRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistGridRecallSession,
} from './session';
import type { SessionPersistence } from './session';
import { SCORING_VERSION } from './versions';
import { continuationStamp, ownsContinuation, GAME_ID, createInitialGridRecallState } from './types';
import type { GridRecallAction, ResultContinuationStamp } from './types';

export interface GridRecallScreenProps {
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

/** Study notice cadence only; measured display exposure owns the deadline. */
const STUDY_TICK_MS = 100;

interface ExposureWindow {
  readonly sessionId: string | null;
  readonly roundIndex: number;
  readonly index: number;
  elapsedMs: number;
  startedAtMs: number | null;
}
function exposureMs(window: ExposureWindow, nowMs: number): number {
  return window.elapsedMs + (window.startedAtMs === null ? 0 : Math.max(0, nowMs - window.startedAtMs));
}
function freezeExposure(window: ExposureWindow | null, nowMs: number): void {
  if (window === null || window.startedAtMs === null) return;
  window.elapsedMs = exposureMs(window, nowMs);
  window.startedAtMs = null;
}

export default function GridRecallScreen(props: GridRecallScreenProps = {}) {
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
    gridRecallGameReducer,
    undefined,
    createInitialGridRecallState,
  );

  const stateRef = useRef(state);
  const exposureRef = useRef<ExposureWindow | null>(null);
  const deliveredPresses = useRef(new WeakSet<object>());
  // Claim accepted gameplay and lifecycle boundaries before React commits.
  // Stale events cannot act on a newly queued round or emit optimistic cues.
  const dispatch = useCallback((action: GridRecallAction) => {
    const current = stateRef.current;
    const next = gridRecallGameReducer(current, action);
    if (next === current) return null;
    if (next.paused || next.tutorialOpen || next.sessionId !== current.sessionId ||
        next.roundIndex !== current.roundIndex || next.phase !== current.phase) {
      freezeExposure(exposureRef.current, clock.now());
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
        (current.phase === 'study' ||
          current.phase === 'input' ||
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
    const action: GridRecallAction = {
      type: 'next-round', stamp: renderedContinuation,
    };
    const next = gridRecallGameReducer(current, action);
    if (next === current) return;
    dispatch(action);
  };

  const tutorial = useMemo(
    () => createGridRecallTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const forceWin = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-win' }); }, [dispatch]);
  const forceLose = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-lose' }); }, [dispatch]);

  const params =
    state.profile !== null ? gridRecallParamsFromProfile(state.profile) : null;
  const studyMs = params?.studyMs ?? 1800;
  const gridSize = params?.gridSize ?? 16;
  const rounds = params?.rounds ?? 5;
  const inSession =
    state.phase === 'study' ||
    state.phase === 'input' ||
    state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  const renderedCue = useMemo<ResultContinuationStamp>(() => ({ sessionId: state.sessionId, roundIndex: state.roundIndex,
    phase: state.phase, epoch: state.continuationEpoch }), [state.sessionId, state.roundIndex, state.phase, state.continuationEpoch]);
  const readStatus = session.status;

  useLayoutEffect(() => {
    if (state.phase !== 'study' || state.paused || state.tutorialOpen || readStatus() !== 'active') return;
    const previous = exposureRef.current;
    const same = previous !== null && previous.sessionId === state.sessionId && previous.roundIndex === state.roundIndex;
    const window: ExposureWindow = { sessionId: state.sessionId, roundIndex: state.roundIndex, index: 0,
      elapsedMs: same ? previous.elapsedMs : 0, startedAtMs: clock.now() };
    exposureRef.current = window;
    return () => freezeExposure(window, clock.now());
  }, [state.phase, state.paused, state.tutorialOpen, state.sessionId, state.roundIndex, renderedCue, readStatus, clock]);

  // Refresh cadence only; measured display exposure owns the study window.
  useEffect(() => {
    if (state.phase !== 'study' || state.paused || state.tutorialOpen) return;
    const observed = exposureRef.current;
    if (observed === null) return;
    let cancelled = false;
    const timer = setInterval(() => {
      if (cancelled || readStatus() !== 'active' || exposureRef.current !== observed || !ownsContinuation(stateRef.current, renderedCue)) return;
      if (exposureMs(observed, clock.now()) >= studyMs) dispatch({ type: 'study-tick', stamp: renderedCue });
    }, STUDY_TICK_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [state.phase, state.paused, state.tutorialOpen, renderedCue, readStatus, clock, studyMs, dispatch]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial, dispatch]);

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
    const resolvedParams = gridRecallParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.targetCount,
    );

    const raw = buildGridRecallRawResult({
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
    const normalized = normalizeGridRecallResult(raw, context);
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
    void persistGridRecallSession(record, persistSession).then((outcome) => {
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
    state.targetCount,
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
    if (readStatus() !== 'active' || current.phase !== 'input' || current.roundScored || !ownsContinuation(current, renderedCue)) return;
    const nativePress = event?.nativeEvent;
    if (nativePress != null) {
      if (deliveredPresses.current.has(nativePress)) return;
      deliveredPresses.current.add(nativePress);
    }
    if (dispatch({ type: 'tap-cell', index, stamp: renderedCue }) !== null) liveAudioHaptics.feedback('tap');
  }, [renderedCue, readStatus, dispatch]);

  const handleSubmit = useCallback(() => {
    if (readStatus() !== 'active' || !ownsContinuation(stateRef.current, renderedCue)) return;
    dispatch({ type: 'submit', stamp: renderedCue });
  }, [renderedCue, readStatus, dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    if (current.sessionId !== renderedCue.sessionId || current.phase !== renderedCue.phase ||
        current.roundIndex !== renderedCue.roundIndex || current.continuationEpoch !== renderedCue.epoch) return;
    if ((current.phase !== 'intro' && current.phase !== 'results') || current.paused || current.tutorialOpen) return;
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
  }, [session, sessionSeed, dispatch, renderedCue]);

  const handleRestart = handleStart;

  // ---- Tutorial controls.
  const openTutorial = useCallback(() => {
    if (stateRef.current.phase !== 'intro') return;
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
  // round-transition state, never on study ticks, so the memoized board skips
  // re-rendering cells whose visual is unchanged.
  const visualFor = useCallback(
    (index: number): CellVisualState => {
      if (state.phase === 'study') {
        return state.targets.includes(index) ? 'target' : 'idle';
      }
      if (state.phase === 'input') {
        return state.selections.includes(index) ? 'selected' : 'idle';
      }
      if (state.phase === 'roundResult') {
        const isTarget = state.targets.includes(index);
        const isSelected = state.selections.includes(index);
        if (isSelected && !isTarget) {
          return 'error';
        }
        if (isTarget) {
          return 'correct';
        }
        return 'idle';
      }
      return 'idle';
    },
    [state.phase, state.targets, state.selections],
  );

  const view =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  return (
    <GameHost
      gameId={GAME_ID}
      description={gameDefinition.description}
      view={view}
      paused={state.paused}
      difficulty={state.difficulty}
      onSelectDifficulty={(level) =>
        dispatch({ type: 'select-difficulty', level })
      }
      onStart={handleStart}
      onHelp={openTutorial}
      onPause={pauseSession}
      onResume={resumeSession}
      onQuit={quitToLibrary}
      interceptBack={inSession}
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
      header={
        <>
          <ThemedText
            type="subtitle"
            testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}
           themeColor="stageInk">
            Round {state.roundIndex + 1}/{rounds}
          </ThemedText>
          {state.phase === 'study' ? (
            <ThemedText
              type="small"
              themeColor="stageMuted"
              testID={testId(GAME_ID, 'study-status')}
            >
              Memorize {state.targetCount} cells
            </ThemedText>
          ) : null}
        </>
      }
      qaPanel={<QaPanel onForceWin={forceWin} onForceLose={forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
          {/* Live score: count-up readout visible in every session phase. */}
          <View style={styles.scoreStrip}>
            <ThemedText type="small" themeColor="textSecondary">
              Score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeral"
              themeColor="text"
              testID={testId(GAME_ID, 'score-live')}
            />
          </View>
          {state.phase === 'study' ? (
            <>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'reveal-status')}
              >
                Memorize the highlighted pattern…
              </ThemedText>
              <Board
                gridSize={gridSize}
                testID={testId(GAME_ID, 'study-board')}
                visualFor={visualFor}
                disabled
                onPressCell={handleTapCell}
              />
            </>
          ) : null}

          {state.phase === 'input' ? (
            <>
              <View style={styles.statusRow}>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'input-status')}
                >
                  Rebuild the pattern
                </ThemedText>
                <View
                  style={styles.dots}
                  testID={testId(GAME_ID, 'progress')}
                  accessibilityLabel={`${state.selections.length} of ${state.targetCount} cells selected`}
                >
                  {Array.from({ length: state.targetCount }, (_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            i < state.selections.length
                              ? theme.memory
                              : theme.border,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
              <Board
                gridSize={gridSize}
                testID={testId(GAME_ID, 'input-board')}
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
                  ? 'Pattern rebuilt!'
                  : 'Not quite'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You recalled {state.roundCorrectTargets} of{' '}
                {state.targetCount} cells
                {state.roundWrongTaps > 0
                  ? ` (${state.roundWrongTaps} wrong tap${state.roundWrongTaps > 1 ? 's' : ''})`
                  : ''}
              </ThemedText>
              <Board
                gridSize={gridSize}
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
          {/* Animated final score beside the existing rows; StatRows below stay as-is. */}
          <View style={styles.finalScore}>
            <ThemedText type="small" themeColor="textSecondary">
              Final score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeralLg"
              themeColor="text"
              testID={testId(GAME_ID, 'score-final')}
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
  dots: {
    flexDirection: 'row',
    gap: Spacing.oneHalf,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scoreStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  finalScore: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
