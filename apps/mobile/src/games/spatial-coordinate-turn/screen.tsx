/**
 * SpatialCoordinateTurnScreen — the Spatial Coordinate Turn game.
 *
 * Renders a pure state machine (`gameReducer`) and owns the side effects:
 * the SDK `SessionLifecycle` (start/pause/resume/complete/abandon),
 * auto-pause on backgrounding, the tutorial, the dev-only QA panel, and result
 * persistence.
 *
 * Round flow: intro → start → brief (read commands + compass) → next-round →
 * choice (options revealed) → select-answer → roundResult → next-round → …
 * The route renders this component with no props; every prop is an optional
 * injection seam for deterministic tests. Pause freezes the lifecycle timer;
 * the board is covered by the opaque `PauseOverlay` while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  SessionLifecycle,
  assertDevOnly,
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, DifficultyLevel, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { DifficultySelector, SessionHeader, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { GameButton } from './components/button';
import { CompassView, CommandList, OptionArrow, OptionCoord } from './components/compass';
import { PauseOverlay } from './components/pause-overlay';
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

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  /** Monotonic timestamp (clock.now()) of when the choice became active. */
  const choiceStartedAtRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
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
  useEffect(() => {
    if (
      state.phase !== 'results' ||
      finalizedRef.current ||
      state.profile === null ||
      state.sessionId === null ||
      state.startedAtMs === null
    ) {
      return;
    }
    finalizedRef.current = true;

    const lifecycle = lifecycleRef.current;
    if (
      lifecycle !== null &&
      lifecycle.status !== 'completed' &&
      lifecycle.status !== 'abandoned'
    ) {
      lifecycle.complete();
    }
    const activeDurationMs = lifecycle?.elapsedMs() ?? 0;
    const pausedDurationMs = lifecycle?.pausedDurationMs() ?? 0;
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
    xpHook,
    persisterProp,
  ]);

  // Session controls.
  const startSession = useCallback(
    (seed: string) => {
      finalizedRef.current = false;
      lifecycleRef.current = new SessionLifecycle({ clock });
      lifecycleRef.current.start();
      dispatch({
        type: 'start-session',
        seed,
        sessionId: newSessionId(),
        startedAtMs: Date.now(),
      });
    },
    [clock, dispatch],
  );

  const pauseSession = useCallback(() => {
    const current = stateRef.current;
    if (
      !(current.phase === 'brief' || current.phase === 'choice' || current.phase === 'roundResult') ||
      current.paused ||
      current.round === null
    ) {
      return;
    }
    lifecycleRef.current?.pause();
    dispatch({ type: 'pause' });
  }, [dispatch]);

  const resumeSession = useCallback(() => {
    lifecycleRef.current?.resume();
    dispatch({ type: 'resume' });
  }, [dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle !== null && (lifecycle.status === 'active' || lifecycle.status === 'paused')) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

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
    const seed = current.seedOverride ?? (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
    startSession(seed);
  }, [startSession, sessionSeed]);

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

  // Auto-pause when the app leaves the foreground (constitution §11).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

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

  return (
    <View style={styles.screen} testID={testId(GAME_ID, 'screen')}>
      <View
        style={styles.content}
        importantForAccessibility={state.paused ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={state.paused}
        accessible={false}>
        {/* ---- Intro phase ---- */}
        {state.phase === 'intro' ? (
          <View style={styles.section} testID={testId(GAME_ID, 'intro')}>
            <ThemedText type="small" themeColor="textSecondary">
              {gameDefinition.description}
            </ThemedText>

            <ThemedText type="caption" themeColor="textSecondary">
              Difficulty
            </ThemedText>
            <DifficultySelector
              gameId={GAME_ID}
              selected={state.difficulty}
              onSelect={(level) => dispatch({ type: 'select-difficulty', level })}
            />

            <View style={styles.buttonRow}>
              <GameButton testID={testId(GAME_ID, 'start')} label="Start" onPress={handleStart} />
              <GameButton
                testID={testId(GAME_ID, 'help')}
                label="How to play"
                variant="secondary"
                onPress={openTutorial}
              />
            </View>

            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={forceTimeout}
              />
            ) : null}
          </View>
        ) : null}

        {inSession && state.round !== null ? (
          <View style={styles.section}>
            <SessionHeader>
              <ThemedText
                type="subtitle"
                testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
                {`Round ${state.roundIndex + 1}/${rounds}`}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'score')}>
                {`Score ${state.stats.score}`}
              </ThemedText>
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, 'pause')}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>

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

            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={forceTimeout}
              />
            ) : null}
          </View>
        ) : null}

        {state.phase === 'results' ? (
          <View style={styles.section} testID={testId(GAME_ID, 'results')}>
            <ThemedText type="title">Session complete</ThemedText>
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

            {state.persistState === 'failed' ? (
              <ThemedText
                type="small"
                themeColor="danger"
                testID={testId(GAME_ID, 'persist-error')}>
                {`Your session could not be saved. ${state.lastError ?? ''}`}
              </ThemedText>
            ) : null}
            {state.forced ? (
              <ThemedText
                type="caption"
                themeColor="warning"
                testID={testId(GAME_ID, 'forced-badge')}>
                QA-forced session
              </ThemedText>
            ) : null}

            <View style={styles.buttonRow}>
              <GameButton testID={testId(GAME_ID, 'restart')} label="Play again" onPress={handleRestart} />
              <GameButton
                testID={testId(GAME_ID, 'quit')}
                label="Done"
                variant="secondary"
                onPress={quitToLibrary}
              />
            </View>
          </View>
        ) : null}
      </View>

      {state.paused && inSession ? (
        <PauseOverlay onResume={resumeSession} onQuit={quitToLibrary} />
      ) : null}

      {state.tutorialOpen ? (
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.three,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
});
