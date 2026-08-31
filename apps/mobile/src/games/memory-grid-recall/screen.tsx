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
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameInterval,
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
  createGridRecallQaForceStateHooks,
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
import { GAME_ID, createInitialGridRecallState } from './types';
import { SCORING_VERSION } from './versions';

export interface GridRecallScreenProps {
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

/** Study pacing step (ms); also bounds the pause-freeze drift. */
const STUDY_TICK_MS = 100;

export default function GridRecallScreen(props: GridRecallScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(
    gridRecallGameReducer,
    undefined,
    createInitialGridRecallState,
  );

  const stateRef = useRef(state);
  // Per-round study timer baseline: tracks elapsed ACTIVE (non-paused) study time
  // so pausing freezes and resuming resumes the remaining window (not a restart).
  const studyElapsedRef = useRef(0);
  const studyRoundRef = useRef(-1);

  useEffect(() => {
    stateRef.current = state;
  });

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
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(
    () => createGridRecallTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createGridRecallQaForceStateHooks(dispatch),
    [dispatch],
  );

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

  // Reset the per-round study timer baseline when a new study round begins.
  useEffect(() => {
    if (state.phase === 'study' && studyRoundRef.current !== state.roundIndex) {
      studyRoundRef.current = state.roundIndex;
      studyElapsedRef.current = 0;
    }
  }, [state.phase, state.roundIndex]);

  // Study pacing with freeze-and-continue: a window of `studyMs` of ACTIVE
  // (non-paused) time, accumulated in STUDY_TICK_MS steps. While paused, the
  // interval is cleared so no time accrues; on resume it continues from where it
  // left off, so the board stays obscured for exactly the time the player has
  // not yet studied.
  useGameInterval(
    state.phase === 'study' && !state.paused,
    () => {
      studyElapsedRef.current = Math.min(studyMs, studyElapsedRef.current + STUDY_TICK_MS);
      if (studyElapsedRef.current >= studyMs) {
        dispatch({ type: 'study-tick' });
      }
    },
    STUDY_TICK_MS,
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
      difficulty: state.profile,
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

  const handleTapCell = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'input' || current.paused || current.roundScored) {
        return;
      }
      liveAudioHaptics.feedback('tap');
      dispatch({ type: 'tap-cell', index });
    },
    [dispatch],
  );

  const handleSubmit = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'input' || current.paused || current.roundScored) {
      return;
    }
    dispatch({ type: 'submit' });
  }, [dispatch]);

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
      header={
        <>
          <ThemedText
            type="subtitle"
            testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}
          >
            Round {state.roundIndex + 1}/{rounds}
          </ThemedText>
          {state.phase === 'study' ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              testID={testId(GAME_ID, 'study-status')}
            >
              Memorize {state.targetCount} cells
            </ThemedText>
          ) : null}
        </>
      }
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
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
                              ? theme.accent
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
          <StatRow
            label="Score"
            value={String(state.stats.score)}
            testID={testId(GAME_ID, 'score')}
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
});
