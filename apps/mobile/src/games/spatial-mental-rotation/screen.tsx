/**
 * SpatialScreen — the Mental Rotation game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Mental-Rotation-specific — the reducer wiring, the round-clock
 * polling (250 ms interval reading the shared lifecycle's active elapsed
 * time), the scoring/persistence pipeline, and the board view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer — and therefore the
 * round budget, because the poll derives remaining time from lifecycle
 * elapsed time — and covers the board with the opaque shared `PauseOverlay`,
 * hidden from the accessibility tree while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { isDevBuild, liveAudioHaptics, noopXpRatingHook, systemClock, testId } from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { GameButton, StatRow } from '@/components/game-ui';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameInterval,
  useGameSession,
} from '@/components/game-host';

import { BlockShape } from './components/block-shape';
import { AnswerButton } from './components/button';
import { QaPanel } from './components/qa-panel';
import { TimerBar } from './components/timer-bar';
import { Tutorial } from './components/tutorial';
import { sessionChallengeRating, spatialParamsFromProfile } from './difficulty';
import { gameDefinition } from './game-definition';
import { createSpatialQaForceStateHooks, createSpatialTutorialLifecycle } from './hooks';
import { spatialGameReducer } from './reducer';
import { normalizeSpatialResult, speedOf } from './scoring';
import {
  buildSessionRecord,
  buildSpatialRawResult,
  dbSessionPersister,
  persistSpatialSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialSpatialState } from './types';
import type { RoundKind } from './types';
import { SCORING_VERSION } from './versions';

export interface SpatialScreenProps {
  /** Injectable clock for session timing (tests); defaults to the system clock. */
  clock?: Clock;
  /** Injectable tutorial persistence (tests); defaults to an in-memory store. */
  tutorialStore?: TutorialStore;
  /** Fixed session seed (tests); defaults to a random per-session seed. */
  sessionSeed?: string | number;
  /** Injectable session persister (tests); defaults to the db layer. */
  persistSession?: SessionPersistence;
  /** Injectable XP/rating hook; defaults to the shared no-op (Phase 2 real impl). */
  xpHook?: XpRatingHook;
}

/** Round-clock polling period in ms. */
const CLOCK_TICK_MS = 250;

export default function SpatialScreen(props: SpatialScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(spatialGameReducer, undefined, createInitialSpatialState);

  const stateRef = useRef(state);

  // Keep a ref of the latest state for event handlers (timers, guards).
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (current.phase === 'play' || current.phase === 'roundResult') && !current.paused;
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createSpatialTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createSpatialQaForceStateHooks(dispatch), [dispatch]);

  const inSession = state.phase === 'play' || state.phase === 'roundResult';

  // ---- Round clock: poll the lifecycle's active elapsed time and feed the
  // reducer. Pausing deactivates the poll AND freezes the lifecycle clock, so
  // the budget freezes too; resume re-schedules from the same round anchor.
  useGameInterval(
    state.phase === 'play' && !state.paused,
    () => {
      const current = stateRef.current;
      if (current.phase !== 'play') {
        return;
      }
      const spent = session.elapsedMs() - current.roundStartedElapsedMs;
      const remaining = Math.max(0, Math.floor(current.timeBudgetMs - spent));
      dispatch({ type: 'clock-tick', remainingMs: remaining });
    },
    CLOCK_TICK_MS,
  );

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

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
    const resolvedParams = spatialParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.adaptivePosition,
    );

    const raw = buildSpatialRawResult({
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
    const normalized = normalizeSpatialResult(raw, context);
    const xp = xpHook.computeXp(normalized, context);
    // Phase-2 seam: rating deltas are computed but unused while the shared
    // hook is a no-op.
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
      difficulty: state.profile,
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: 'persistence-started' });
    void persistSpatialSession(record, persistSession).then((outcome) => {
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
    state.adaptivePosition,
    state.difficulty,
    session,
    xpHook,
    persistSession,
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
    router.back();
  }, [session, router]);

  const handleAnswer = useCallback(
    (answer: RoundKind) => {
      const current = stateRef.current;
      if (current.phase !== 'play' || current.paused) {
        return;
      }
      if (answer === current.kind) {
        liveAudioHaptics.playSfx('spatial-answer-correct');
        liveAudioHaptics.haptic('success');
      } else {
        liveAudioHaptics.playSfx('spatial-answer-wrong');
        liveAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'answer', answer });
    },
    [dispatch],
  );

  const handleNextRound = useCallback(() => {
    dispatch({
      type: 'next-round',
      roundStartedElapsedMs: session.elapsedMs(),
    });
  }, [session, dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
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
    tutorial.skipForQa(GAME_ID); // dev-only (assertDevOnly inside)
    dispatch({ type: 'tutorial-close' });
  }, [tutorial, dispatch]);

  const outcomeText =
    state.roundOutcome === 'passed'
      ? 'Correct!'
      : state.roundOutcome === 'timeout'
        ? 'Time’s up'
        : 'Not quite';

  return (
    <GameHost
      gameId={GAME_ID}
      description={gameDefinition.description}
      view={inSession ? 'session' : state.phase === 'results' ? 'results' : 'intro'}
      paused={state.paused}
      difficulty={state.difficulty}
      onSelectDifficulty={(level) => dispatch({ type: 'select-difficulty', level })}
      onStart={handleStart}
      onHelp={openTutorial}
      onPause={pauseSession}
      onResume={resumeSession}
      onQuit={quitToLibrary}
      interceptBack={inSession}
      header={
        <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
          Round {state.roundIndex + 1}/{state.rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
          onForceTimeout={qaHooks.forceTimeout}
        />
      }
      // Dev-only QA controls anchored ABOVE the tall board content so they
      // stay reachable by automation (the board pushes anything rendered
      // below it past several viewport-heights).
      qaPanelPosition="above"
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
          {state.phase === 'play' ? (
            <>
              <TimerBar
                remainingMs={state.timeRemainingMs}
                budgetMs={state.timeBudgetMs}
                testID={testId(GAME_ID, 'timer')}
              />
              <ThemedText
                type="bodyLarge"
                themeColor="text"
                testID={testId(GAME_ID, 'play-status')}>
                Is the candidate the target rotated?
              </ThemedText>
              <View style={styles.shapesRow}>
                <View style={styles.shapeSlot}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Target
                  </ThemedText>
                  <BlockShape blocks={state.target} kind="target" />
                </View>
                <View style={styles.shapeSlot}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Candidate
                  </ThemedText>
                  <BlockShape blocks={state.candidate} kind="candidate" />
                </View>
              </View>
              <View style={styles.answerRow}>
                <AnswerButton
                  testID={testId(GAME_ID, 'same')}
                  label="Same"
                  answer="same"
                  onPressAnswer={handleAnswer}
                />
                <AnswerButton
                  testID={testId(GAME_ID, 'different')}
                  label="Different"
                  variant="secondary"
                  answer="different"
                  onPressAnswer={handleAnswer}
                />
              </View>
            </>
          ) : null}

          {state.phase === 'roundResult' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={
                  state.roundOutcome === 'passed' ? 'success' : state.roundOutcome === 'timeout' ? 'warning' : 'danger'
                }
                testID={testId(GAME_ID, state.roundOutcome === 'passed' ? 'round-passed' : 'round-failed')}>
                {outcomeText}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {state.roundOutcome === 'passed'
                  ? `Correct — the candidate is ${state.kind === 'same' ? 'a rotation of' : 'not a rotation of'} the target.`
                  : state.roundOutcome === 'timeout'
                    ? `The timer ran out. The correct answer was ${state.kind === 'same' ? '“Same”' : '“Different”'}.`
                    : `The correct answer was ${state.kind === 'same' ? '“Same”' : '“Different”'}.`}
              </ThemedText>
              <View style={styles.shapesRow}>
                <View style={styles.shapeSlot}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Target
                  </ThemedText>
                  <BlockShape blocks={state.target} kind="target" />
                </View>
                <View style={styles.shapeSlot}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Candidate
                  </ThemedText>
                  <BlockShape blocks={state.candidate} kind="candidate" />
                </View>
              </View>
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={state.roundIndex + 1 >= state.rounds ? 'See results' : 'Next round'}
                onPress={handleNextRound}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {state.phase === 'results' ? (
        <GameResults
          gameId={GAME_ID}
          persistState={state.persistState}
          lastError={state.lastError}
          forced={state.forced}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          <StatRow
            label="Score"
            value={String(state.stats.score)}
            testID={testId(GAME_ID, 'score')}
          />
          <StatRow
            label="Accuracy"
            value={`${Math.round(
              (state.stats.roundsPlayed > 0 ? state.stats.roundsPassed / state.stats.roundsPlayed : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Speed"
            value={`${Math.round(speedOf(state.stats.totalRemainingMs, state.stats.totalBudgetMs) * 100)}%`}
            testID={testId(GAME_ID, 'speed')}
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
            label="Correct answers"
            value={`${state.stats.correctAnswers}/${state.stats.totalAnswers}`}
            testID={testId(GAME_ID, 'correct-answers')}
          />
          <StatRow
            label="Timeouts"
            value={String(state.stats.timeouts)}
            testID={testId(GAME_ID, 'timeouts')}
          />
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
  shapesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  shapeSlot: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  answerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
