/**
 * SpatialCoordinateTurnScreen — the Spatial Coordinate Turn game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Coordinate-Turn-specific — the choice-phase answer timing,
 * compass/options view, and the scoring/persistence pipeline.
 *
 * Round flow: intro → start → brief (read commands + compass) → next-round →
 * choice (options revealed) → select-answer → roundResult → next-round → …
 * The route renders this component with no props; every prop is an optional
 * injection seam for deterministic tests. Pause freezes the lifecycle timer;
 * the board is covered by the opaque `PauseOverlay` while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  assertDevOnly,
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, DifficultyLevel, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { CompassView, CommandList, OptionArrow, OptionCoord } from './components/compass';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import {
  sessionChallengeRating,
  spatialCoordinateTurnParamsFromProfile,
} from './difficulty';
import { gameDefinition } from './game-definition';
import { createSpatialCoordinateTurnQaForceStateHooks, createSpatialCoordinateTurnTutorialLifecycle } from './hooks';
import { gameReducer } from './reducer';
import { normalizeSpatialCoordinateTurnResult } from './scoring';
import {
  buildSessionRecord,
  buildSpatialCoordinateTurnRawResult,
  dbSessionPersister,
  persistSpatialCoordinateTurnSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialSpatialCoordinateTurnState } from './types';
import type { Dir, SpatialCoordinateTurnRound } from './types';
import { SCORING_VERSION } from './versions';

export interface SpatialCoordinateTurnScreenProps {
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

export default function SpatialCoordinateTurnScreen(
  props: SpatialCoordinateTurnScreenProps = {},
) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession: persisterProp = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialSpatialCoordinateTurnState);

  const stateRef = useRef(state);
  /** Monotonic timestamp (clock.now()) of when the choice became active. */
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
        (current.phase === 'brief' ||
          current.phase === 'choice' ||
          current.phase === 'roundResult') &&
        !current.paused &&
        current.round !== null
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createSpatialCoordinateTurnTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createSpatialCoordinateTurnQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? spatialCoordinateTurnParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 0;
  const inSession = state.phase === 'brief' || state.phase === 'choice' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // Record the monotonic time when the choice becomes active (answer timing).
  useEffect(() => {
    if (state.phase === 'choice' && !state.paused) {
      choiceStartedAtRef.current = clock.now();
    }
  }, [state.phase, state.paused, clock]);

  // First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

  // Session finalization: complete the lifecycle, run the SDK scoring
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
    const resolvedParams = spatialCoordinateTurnParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.directions,
    );

    const raw = buildSpatialCoordinateTurnRawResult({
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
    const normalized = normalizeSpatialCoordinateTurnResult(raw, context);
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
      difficulty: state.profile,
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: 'persistence-started' });
    void persistSpatialCoordinateTurnSession(record, persisterProp).then((outcome) => {
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
    state.difficulty,
    session,
    xpHook,
    persisterProp,
  ]);

  // Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    session.resume();
    dispatch({ type: 'resume' });
  }, [session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleSelectAnswer = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'choice' || current.paused) {
        return;
      }
      const answerMs = clock.now() - choiceStartedAtRef.current;
      if (index === current.round?.correctIndex) {
        liveAudioHaptics.playSfx('spatial-answer-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('spatial-answer-wrong');
        liveAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'select-answer', index, answerMs });
    },
    [clock, dispatch],
  );

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

  // Tutorial controls.
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

  const forceTimeout = useCallback(() => {
    assertDevOnly();
    dispatch({ type: 'qa/force-timeout' });
  }, [dispatch]);

  const accuracyPct =
    state.stats.roundsPlayed > 0
      ? Math.round((state.stats.correctPicks / state.stats.roundsPlayed) * 100)
      : 0;
  const positionAccuracyPct =
    state.stats.positionTrials > 0
      ? Math.round((state.stats.positionCorrect / state.stats.positionTrials) * 100)
      : 0;

  const renderOptions = (round: SpatialCoordinateTurnRound) => {
    const disabled = state.phase !== 'choice';
    if (round.task === 'heading') {
      return (round.options as readonly Dir[]).map((dir, i) => (
        <OptionArrow
          key={dir}
          dir={dir}
          index={i}
          selected={state.selectedOptionIndex === i}
          correct={state.phase === 'roundResult' && i === round.correctIndex}
          disabled={disabled}
          onPress={() => handleSelectAnswer(i)}
        />
      ));
    }
    return round.options.map((coord, i) => (
      <OptionCoord
        key={i}
        coord={coord}
        index={i}
        selected={state.selectedOptionIndex === i}
        correct={state.phase === 'roundResult' && i === round.correctIndex}
        disabled={disabled}
        onPress={() => handleSelectAnswer(i)}
      />
    ));
  };

  const view: GameHostView =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  return (
    <GameHost
      gameId={GAME_ID}
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
      header={
        <ThemedText
          type="subtitle"
          testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
          {`Round ${state.roundIndex + 1}/${rounds}`}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
          onForceTimeout={forceTimeout}
        />
      }
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession && state.round !== null ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'task-label')}>
            {state.round.task === 'heading' ? 'Which way are you facing?' : 'Where did you end up?'}
          </ThemedText>

          <CompassView
            heading={state.round.startDir}
            testID={testId(GAME_ID, 'compass')}
          />
          <CommandList
            commands={state.round.commands}
            testID={testId(GAME_ID, 'command-list')}
          />

          {state.phase === 'brief' ? (
            <GameButton
              testID={testId(GAME_ID, 'choice-begin')}
              label="Show answers"
              onPress={() => dispatch({ type: 'next-round' })}
            />
          ) : null}

          {state.phase === 'choice' || state.phase === 'roundResult' ? (
            <View style={styles.optionRow} testID={testId(GAME_ID, 'options')}>
              {renderOptions(state.round)}
            </View>
          ) : null}

          {state.phase === 'roundResult' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={state.roundOutcome === 'correct' ? 'success' : 'danger'}
                testID={testId(GAME_ID, state.roundOutcome === 'correct' ? 'round-correct' : 'round-wrong')}>
                {state.roundOutcome === 'correct' ? 'Correct!' : 'Wrong!'}
              </ThemedText>
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={() => dispatch({ type: 'next-round' })}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {state.phase === 'results' ? (
        <GameResults
          gameId={GAME_ID}
          forced={state.forced}
          persistState={state.persistState}
          lastError={state.lastError}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          <StatRow label="Score" value={String(state.stats.score)} testID={testId(GAME_ID, 'score')} />
          <StatRow
            label="Accuracy"
            value={`${accuracyPct}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Speed"
            value={`${Math.round(
              (state.stats.scoredPicks > 0 ? state.stats.totalResponseMs / state.stats.scoredPicks : 0),
            )} ms`}
            testID={testId(GAME_ID, 'speed')}
          />
          <StatRow
            label="Position trials"
            value={
              state.stats.positionTrials > 0
                ? `${positionAccuracyPct}% (${state.stats.positionCorrect}/${state.stats.positionTrials})`
                : '—'
            }
            testID={testId(GAME_ID, 'position-accuracy')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Mistakes"
            value={String(state.stats.mistakes)}
            testID={testId(GAME_ID, 'mistakes')}
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
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
});
