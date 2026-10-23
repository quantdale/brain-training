/**
 * SpatialFoldMatchScreen — the Spatial Fold Match game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Fold-Match-specific — the reducer wiring, the source-reveal
 * and choice-phase pacing timers, the scoring/persistence pipeline, and the
 * grid/options view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels source
 * reveal pacing; resuming continues the remaining reveal window; the board is
 * covered by the opaque shared PauseOverlay and hidden from the accessibility
 * tree while paused, so the challenge cannot be read off the UI during a pause.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

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
import { Spacing } from '@/constants/theme';
import { GameButton, StatRow } from '@/components/game-ui';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameInterval,
  useGameDeadlineTimeout,
  useGameSession,
} from '@/components/game-host';

import { GridView } from './components/grid-view';
import { OptionGrid } from './components/option-grid';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import {
  sessionChallengeRating,
  spatialFoldMatchParamsFromProfile,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createSpatialFoldMatchTutorialLifecycle,
} from './hooks';
import { gameReducer } from './reducer';
import { normalizeSpatialFoldMatchResult } from './scoring';
import {
  buildSessionRecord,
  buildSpatialFoldMatchRawResult,
  dbSessionPersister,
  persistSpatialFoldMatchSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialSpatialFoldMatchState } from './types';
import type { SpatialFoldMatchAction } from './types';
import { SCORING_VERSION } from './versions';

export interface SpatialFoldMatchScreenProps {
  /** Injectable clock for session timing (tests); defaults to the system clock. */
  clock?: Clock;
  /** Injectable tutorial persistence (tests); defaults to an in-memory store. */
  tutorialStore?: TutorialStore;
  /** Fixed session seed (tests); defaults to a random per-session seed. */
  sessionSeed?: string | number;
  /** Injectable session persister (tests); defaults to the db layer. */
  persistSession?: SessionPersistence;
  /** Injectable XP/rating hook; defaults to the pipeline-backed optimistic hook. */
  xpHook?: XpRatingHook;
}

/** Source polling paces rendering; the lifecycle measures all active time. */
const PACING_STEP_MS = 100;

export default function SpatialFoldMatchScreen(props: SpatialFoldMatchScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const goBack = useSafeBack('/games');
  const [state, reactDispatch] = useReducer(
    gameReducer,
    undefined,
    createInitialSpatialFoldMatchState,
  );

  const stateRef = useRef(state);
  // Claim a cue's accepted transition before React commits, including pause
  // and source expiry, so stale/batched callbacks cannot create extra feedback.
  const dispatch = useCallback((action: SpatialFoldMatchAction) => {
    const current = stateRef.current;
    const next = gameReducer(current, action);
    if (next === current) return false;
    stateRef.current = next;
    reactDispatch(action);
    return true;
  }, []);
  const inputEpoch = state.inputEpoch;
  const revealStartedAtRef = useRef(0);
  const choiceStartedAtRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'source' ||
          current.phase === 'choice' ||
          current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });
  const readActiveTime = session.elapsedMs;
  const activeClock = useMemo<Clock>(() => ({ now: readActiveTime }), [readActiveTime]);

  const tutorial = useMemo(
    () => createSpatialFoldMatchTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const forceWin = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-win' }); }, [dispatch]);
  const forceLose = useCallback(() => { assertDevOnly(); dispatch({ type: 'qa/force-lose' }); }, [dispatch]);

  const params =
    state.profile !== null ? spatialFoldMatchParamsFromProfile(state.profile) : null;
  const revealMs = params?.sourceRevealMs ?? 1300;
  const rounds = params?.rounds ?? 6;
  const inSession =
    state.phase === 'source' ||
    state.phase === 'choice' ||
    state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // Active anchors reset for each displayed phase and session, never merely
  // because the player resumed. Lifecycle elapsed time already excludes pause.
  useEffect(() => {
    if (state.phase === 'source') {
      revealStartedAtRef.current = readActiveTime();
    }
  }, [state.phase, state.roundIndex, state.sessionId, readActiveTime]);

  // Source pacing with freeze-and-continue: a window of `revealMs` of ACTIVE
  // (non-paused) time. A JS stall or a fractional pause cannot buy extra study.
  useGameInterval(
    state.phase === 'source' && !state.paused,
    () => {
      const current = stateRef.current;
      if (current.phase !== 'source' || current.paused || session.status() !== 'active' || inputEpoch !== stateRef.current.inputEpoch) return;
      if (session.elapsedMs() - revealStartedAtRef.current >= revealMs) {
        dispatch({ type: 'source-tick' });
      }
    },
    PACING_STEP_MS,
  );

  // Preserve the precise remaining reveal duration after a fractional pause;
  // the poll still handles an overdue observation after a stalled JS thread.
  useGameDeadlineTimeout(
    state.phase === 'source' && !state.paused,
    () => {
      const current = stateRef.current;
      if (current.phase !== 'source' || current.paused || session.status() !== 'active' || inputEpoch !== stateRef.current.inputEpoch) return;
      if (session.elapsedMs() - revealStartedAtRef.current >= revealMs) dispatch({ type: 'source-tick' });
    },
    revealMs,
    activeClock,
    `${state.sessionId ?? 'idle'}:source:${state.roundIndex}`,
  );

  // Read the answer instant directly, including time between polling callbacks.
  useEffect(() => {
    if (state.phase === 'choice') {
      choiceStartedAtRef.current = readActiveTime();
    }
  }, [state.phase, state.roundIndex, state.sessionId, readActiveTime]);

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
    const resolvedParams = spatialFoldMatchParamsFromProfile(state.profile);
    // Adaptive sessions escalate filledCells per round; the profile carries
    // the final adapted value, which is exactly the escalation signal.
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.filledCells,
    );

    const raw = buildSpatialFoldMatchRawResult({
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
    const normalized = normalizeSpatialFoldMatchResult(raw, context);
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
      difficulty: { ...state.profile, challengeRating },
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: 'persistence-started' });
    void persistSpatialFoldMatchSession(record, persistSession).then((outcome) => {
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
      dispatch({ type: 'resume' });
    }
  }, [session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    goBack();
  }, [session, goBack]);

  const handleSelectOption = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'choice' || current.paused || session.status() !== 'active' || inputEpoch !== stateRef.current.inputEpoch || !Number.isInteger(index) || index < 0 || index >= current.options.length) {
        return;
      }
      const correct = index === current.correctOptionIndex;
      const accepted = dispatch({
        type: 'select-option',
        index,
        answerMs: Math.max(0, session.elapsedMs() - choiceStartedAtRef.current),
      });
      if (accepted) liveAudioHaptics.feedback(correct ? 'correct' : 'wrong');
    },
    [session, inputEpoch, dispatch],
  );

  const handleNextRound = useCallback(() => {
    const current = stateRef.current;
    if (current.paused || session.status() !== 'active' || inputEpoch !== stateRef.current.inputEpoch) return;
    dispatch({ type: 'next-round' });
  }, [session, inputEpoch, dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'intro' && current.phase !== 'results') return;
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

  // Options are shared by the choice and round-result phases. During the
  // choice phase nothing is highlighted or disabled (no answer leak); the
  // reveal only happens after the player has committed to an option.
  const renderOptions = (reveal: boolean) => (
    <View style={styles.options} testID={testId(GAME_ID, 'options')}>
      {state.options.map((grid, index) => (
        <OptionGrid
          key={index}
          index={index}
          grid={grid}
          selected={state.selectedOptionIndex === index}
          correct={reveal && index === state.correctOptionIndex}
          disabled={reveal}
          onPressOption={handleSelectOption}
        />
      ))}
    </View>
  );

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
      onSelectDifficulty={(level) =>
        dispatch({ type: 'select-difficulty', level })
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
          testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))} themeColor="stageInk">
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(Math.round(state.stats.score))}
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
      qaPanel={<QaPanel onForceWin={forceWin} onForceLose={forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
          {state.phase === 'source' ? (
            <>
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'reveal-status')}>
                Memorize the pattern…
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {state.foldLabel}
              </ThemedText>
              <GridView
                grid={state.sourceGrid}
                testID={testId(GAME_ID, 'source-grid')}
                accessibilityLabel="Source pattern"
              />
            </>
          ) : null}

          {state.phase === 'choice' ? (
            <>
              {/* Inference contract: the applied fold is NOT announced here —
               * the player must infer it from the candidate grids (which stay
               * visually distinct as before). The label is revealed in the
               * round-result feedback below. */}
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'choice-status')}>
                Which grid is folded correctly?
              </ThemedText>
              <View style={styles.scoreRow}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Score
                </ThemedText>
                <AnimatedNumber
                  value={state.stats.score}
                  type="numeral"
                  testID={testId(GAME_ID, 'score-live')}
                />
              </View>
              {renderOptions(false)}
            </>
          ) : null}
          {state.phase === 'roundResult' ? (
            <View
              style={styles.section}
              testID={testId(GAME_ID, 'round-result')}>
              {/* The choice prompt stays mounted through feedback: the verdict
               * must never cover the stem (Imprint rule). */}
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'choice-status')}>
                Which grid is folded correctly?
              </ThemedText>
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
                )}>
                {state.roundOutcome === 'passed'
                  ? 'Correct fold!'
                  : 'Not quite'}
              </ThemedText>
              {/* Round-result feedback is where the applied fold is named —
               * never during the choice phase itself (inference contract). */}
              <ThemedText type="small" themeColor="textSecondary">
                {state.foldLabel}
              </ThemedText>
              {renderOptions(true)}
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={handleNextRound}
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
          <AnimatedNumber
            value={state.stats.score}
            type="numeralLg"
            testID={testId(GAME_ID, 'score-animated')}
          />
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
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
