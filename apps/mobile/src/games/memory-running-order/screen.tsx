/**
 * RunningOrderScreen — the Running Order game (working-memory update variant).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Running-Order-specific — the reducer wiring, the reveal pacing
 * timer, the scoring/persistence pipeline, and the symbol recall view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels reveal
 * pacing; resuming continues the current symbol’s remaining flash; the content is covered by
 * the opaque shared `PauseOverlay` and hidden from the accessibility tree
 * while paused.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { assertDevOnly, isDevBuild, liveAudioHaptics, systemClock, testId } from '@/sdk';
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

import { SymbolView } from './components/symbol-view';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { runningOrderParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createRunningOrderTutorialLifecycle } from './hooks';
import { runningOrderGameReducer } from './reducer';
import { normalizeRunningOrderResult } from './scoring';
import {
  buildRunningOrderRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistRunningOrderSession,
} from './session';
import type { SessionPersistence } from './session';
import { streamTarget } from './generator';
import { RUNNING_ORDER_SYMBOLS } from './symbols';
import { SCORING_VERSION } from './versions';
import { continuationStamp, ownsContinuation, GAME_ID, createInitialRunningOrderState } from './types';
import type { RunningOrderAction, ResultContinuationStamp } from './types';

export interface RunningOrderScreenProps {
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

export default function RunningOrderScreen(props: RunningOrderScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const theme = useTheme();
  const goBack = useSafeBack('/games');
  const [state, reactDispatch] = useReducer(runningOrderGameReducer, undefined, createInitialRunningOrderState);

  const stateRef = useRef(state);
  const exposureRef = useRef<ExposureWindow | null>(null);
  const deliveredPresses = useRef(new WeakSet<object>());
  // Claim accepted gameplay and lifecycle boundaries before React commits.
  // Stale events cannot act on a newly queued round or emit optimistic cues.
  const dispatch = useCallback((action: RunningOrderAction) => {
    const current = stateRef.current;
    const next = runningOrderGameReducer(current, action);
    if (next === current) return null;
    if (next.paused || next.tutorialOpen || next.sessionId !== current.sessionId ||
        next.roundIndex !== current.roundIndex || next.phase !== current.phase || next.revealedIndex !== current.revealedIndex) {
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
        (current.phase === 'reveal' || current.phase === 'input' || current.phase === 'roundResult') &&
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
    const action: RunningOrderAction = {
      type: 'next-round', stamp: renderedContinuation,
    };
    const next = runningOrderGameReducer(current, action);
    if (next === current) return;
    dispatch(action);
  };

  const tutorial = useMemo(() => createRunningOrderTutorialLifecycle(tutorialStore), [tutorialStore]);
  const forceWin = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-win' }); }, [dispatch]);
  const forceLose = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-lose' }); }, [dispatch]);

  const params = state.profile !== null ? runningOrderParamsFromProfile(state.profile) : null;
  const flashMs = params?.flashMs ?? 800;
  const rounds = params?.rounds ?? 5;
  const inSession =
    state.phase === 'reveal' || state.phase === 'input' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  const renderedCue = useMemo<ResultContinuationStamp>(() => ({ sessionId: state.sessionId, roundIndex: state.roundIndex,
    phase: state.phase, epoch: state.continuationEpoch }), [state.sessionId, state.roundIndex, state.phase, state.continuationEpoch]);
  const readStatus = session.status;

  // A new symbol receives its complete display exposure from layout commit.
  // Pause/tutorial boundaries preserve the exact remaining flash time.
  useLayoutEffect(() => {
    if (state.phase !== 'reveal' || state.paused || state.tutorialOpen || readStatus() !== 'active') return;
    const previous = exposureRef.current;
    const same = previous !== null && previous.sessionId === state.sessionId && previous.roundIndex === state.roundIndex && previous.index === state.revealedIndex;
    const window: ExposureWindow = { sessionId: state.sessionId, roundIndex: state.roundIndex, index: state.revealedIndex,
      elapsedMs: same ? previous.elapsedMs : 0, startedAtMs: clock.now() };
    exposureRef.current = window;
    return () => freezeExposure(window, clock.now());
  }, [state.phase, state.paused, state.tutorialOpen, state.sessionId, state.roundIndex, state.revealedIndex, renderedCue, readStatus, clock]);

  useEffect(() => {
    if (state.phase !== 'reveal' || state.paused || state.tutorialOpen) return;
    const observed = exposureRef.current;
    if (observed === null) return;
    const stamp = { ...renderedCue, revealedIndex: state.revealedIndex };
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      const current = stateRef.current;
      if (cancelled || readStatus() !== 'active' || exposureRef.current !== observed || !ownsContinuation(current, stamp) || current.revealedIndex !== stamp.revealedIndex) return;
      const remainingMs = flashMs - exposureMs(observed, clock.now());
      if (remainingMs > 0) timer = setTimeout(expire, remainingMs);
      else { cancelled = true; dispatch({ type: 'reveal-tick', stamp }); }
    };
    timer = setTimeout(expire, Math.max(0, flashMs - exposureMs(observed, clock.now())));
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state.phase, state.paused, state.tutorialOpen, state.revealedIndex, renderedCue, readStatus, clock, flashMs, dispatch]);

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
      !session.claimFinalize() ||
      state.profile === null ||
      state.sessionId === null ||
      state.startedAtMs === null
    ) {
      return;
    }

    session.completeIfActive();
    const activeDurationMs = session.elapsedMs();
    const pausedDurationMs = session.pausedDurationMs();
    const completedAtMs = Date.now();
    const difficulty = state.difficulty ?? 'normal';
    const resolvedParams = runningOrderParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.recallLength);

    const raw = buildRunningOrderRawResult({
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
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeRunningOrderResult(raw, context);
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
    void persistRunningOrderSession(record, persistSession).then((outcome) => {
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
        dispatch({ type: 'persistence-failed', message: String(outcome.error) });
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
    state.recallLength,
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

  const handleTapSymbol = useCallback((id: number, event?: GestureResponderEvent) => {
    const current = stateRef.current;
    if (readStatus() !== 'active' || current.phase !== 'input' || current.roundScored || !ownsContinuation(current, renderedCue)) return;
    const nativePress = event?.nativeEvent;
    if (nativePress != null) {
      if (deliveredPresses.current.has(nativePress)) return;
      deliveredPresses.current.add(nativePress);
    }
    if (dispatch({ type: 'tap-symbol', id, stamp: renderedCue }) !== null) liveAudioHaptics.feedback('tap');
  }, [renderedCue, readStatus, dispatch]);

  const handleBackspace = useCallback((event?: GestureResponderEvent) => {
    const current = stateRef.current;
    if (readStatus() !== 'active' || current.phase !== 'input' || !ownsContinuation(current, renderedCue)) return;
    const nativePress = event?.nativeEvent;
    if (nativePress != null) {
      if (deliveredPresses.current.has(nativePress)) return;
      deliveredPresses.current.add(nativePress);
    }
    if (dispatch({ type: 'backspace', stamp: renderedCue }) !== null) liveAudioHaptics.feedback('tap');
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

  const view: 'intro' | 'session' | 'results' =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  const target: number[] =
    state.phase === 'roundResult' ? streamTarget(state.stream, state.recallLength) : [];

  return (
    <GameHost
      gameId={GAME_ID}
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
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
      header={
        <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))} themeColor="stageInk">
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      qaPanel={<QaPanel onForceWin={forceWin} onForceLose={forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial clock={clock} onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
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

          {state.phase === 'reveal' ? (
            <View style={[styles.center, styles.section]} testID={testId(GAME_ID, 'reveal')}>
              <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'reveal-status')}>
                Watch the stream…
              </ThemedText>
              {state.revealedIndex >= 0 && state.revealedIndex < state.stream.length ? (
                <SymbolView
                  symbolId={state.stream[state.revealedIndex]}
                  size={80}
                  testID={testId(GAME_ID, 'reveal-symbol')}
                />
              ) : null}
              <View
                style={styles.dots}
                testID={testId(GAME_ID, 'progress')}
                accessibilityLabel={`Item ${Math.min(state.revealedIndex + 1, state.stream.length)} of ${state.stream.length}`}>
                {Array.from({ length: state.stream.length }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: i <= state.revealedIndex ? theme.memory : theme.border },
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* The prompt stays mounted through the verdict: it renders for both
              the input and round-result phases, so feedback never covers the
              stem the player was answering. */}
          {state.phase === 'input' || state.phase === 'roundResult' ? (
            <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'input-status')}>
              Recall the last {state.recallLength} in order
            </ThemedText>
          ) : null}

          {state.phase === 'input' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'input')}>
              <View style={styles.answerRow} testID={testId(GAME_ID, 'answer')}>
                {Array.from({ length: state.recallLength }, (_, i) => (
                  <View key={i} style={styles.answerSlot}>
                    {state.answer[i] !== undefined ? (
                      <SymbolView symbolId={state.answer[i]} size={40} testID={testId(GAME_ID, 'answer', String(i))} />
                    ) : null}
                  </View>
                ))}
              </View>
              <View style={styles.palette} testID={testId(GAME_ID, 'palette')}>
                {RUNNING_ORDER_SYMBOLS.map((sym) => (
                  <SymbolView
                    key={sym.id}
                    symbolId={sym.id}
                    size={40}
                    testID={testId(GAME_ID, 'palette', String(sym.id))}
                    onPress={(event) => handleTapSymbol(sym.id, event)}
                    disabled={state.answer.length >= state.recallLength}
                  />
                ))}
              </View>
              <View style={styles.buttonRow}>
                <GameButton
                  testID={testId(GAME_ID, 'backspace')}
                  label="Back"
                  variant="secondary"
                  onPress={handleBackspace}
                  disabled={state.answer.length === 0}
                />
                <GameButton
                  testID={testId(GAME_ID, 'submit')}
                  label="Submit"
                  onPress={handleSubmit}
                  disabled={state.answer.length !== state.recallLength}
                />
              </View>
            </View>
          ) : null}

          {state.phase === 'roundResult' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={state.roundOutcome === 'passed' ? 'success' : 'danger'}
                testID={testId(GAME_ID, state.roundOutcome === 'passed' ? 'round-passed' : 'round-failed')}>
                {state.roundOutcome === 'passed' ? 'Correct order!' : 'Not quite'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You recalled {state.roundCorrectTargets} of {state.recallLength} in order
              </ThemedText>
              {/* Per-position verdict, resolved from the reducer outcome: the
                  player's pick carries ✓/✕, and where it was wrong the correct
                  symbol is shown in the same slot, so the wrong pick and the
                  correct answer are distinguishable in one frame. */}
              <View style={styles.sequenceRow}>
                <ThemedText type="small" themeColor="textSecondary">Answer:</ThemedText>
                {state.answer.map((id, i) => {
                  const isCorrect = id === target[i];
                  return (
                    <View key={i} style={styles.verdictSlot}>
                      <SymbolView
                        symbolId={id}
                        size={32}
                        verdict={isCorrect ? 'correct' : 'wrong'}
                        testID={testId(GAME_ID, 'result-answer', String(i))}
                      />
                      {!isCorrect && target[i] !== undefined ? (
                        <SymbolView
                          symbolId={target[i]}
                          size={28}
                          verdict="correct"
                          testID={testId(GAME_ID, 'result-correct', String(i))}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <View style={styles.sequenceRow}>
                <ThemedText type="small" themeColor="textSecondary">Target:</ThemedText>
                {target.map((id, i) => (
                  <SymbolView key={i} symbolId={id} size={32} testID={testId(GAME_ID, 'result-target', String(i))} />
                ))}
              </View>
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
          {/* Animated final score beside the existing rows; the plain StatRow
              below stays for the harness selector and the exact value. */}
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
              (state.stats.roundsPlayed > 0 ? state.stats.roundsPassed / state.stats.roundsPlayed : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Rounds passed"
            value={`${state.stats.roundsPassed}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'rounds-passed')}
          />
          <StatRow label="Best recall" value={String(state.stats.bestRecall)} testID={testId(GAME_ID, 'best-recall')} />
          <StatRow label="Best streak" value={String(state.stats.bestStreak)} testID={testId(GAME_ID, 'best-streak')} />
          <StatRow label="XP" value={String(state.authoritativeXp ?? state.xp)} testID={testId(GAME_ID, 'xp')} />
        </GameResults>
      ) : null}
    </GameHost>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
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
  verdictSlot: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  center: {
    alignItems: 'center',
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
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  answerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  answerSlot: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  sequenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.oneHalf,
    flexWrap: 'wrap',
  },
});
