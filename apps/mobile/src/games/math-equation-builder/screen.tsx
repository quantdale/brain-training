/**
 * MathEquationBuilderScreen — the Equation Builder game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Equation-Builder-specific — the reducer wiring, the per-round
 * budget ticker, the scoring/persistence pipeline, and the build view.

 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the budget
 * ticker; resuming continues the remaining budget (never a restart). The
 * board is covered by the opaque shared `PauseOverlay` and hidden from the
 * accessibility tree while paused. The 3-step tutorial demo flow (with its
 * deterministic TUTORIAL_DEMO_SEED puzzle) and the undo behavior live in the
 * reducer/tutorial components and are unchanged by this migration.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { isDevBuild, liveAudioHaptics, noopXpRatingHook, systemClock, testId } from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameInterval,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { EquationDisplay } from './components/equation-display';
import { GameButton } from './components/button';
import { NumberPad } from './components/number-pad';
import { OperatorPad } from './components/operator-pad';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { mathEquationBuilderParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createMathEquationBuilderQaForceStateHooks,
  createMathEquationBuilderTutorialLifecycle,
} from './hooks';
import { mathEquationBuilderGameReducer } from './reducer';
import { normalizeMathEquationBuilderResult } from './scoring';
import {
  buildMathEquationBuilderRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistMathEquationBuilderSession,
} from './session';
import type { SessionPersistence } from './session';
import {
  GAME_ID,
  createInitialMathEquationBuilderState,
} from './types';
import type { Operator } from './types';
import { SCORING_VERSION } from './versions';

export interface MathEquationBuilderScreenProps {
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

export default function MathEquationBuilderScreen(props: MathEquationBuilderScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    mathEquationBuilderGameReducer,
    undefined,
    createInitialMathEquationBuilderState,
  );

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
      return (
        (current.phase === 'playing' || current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(
    () => createMathEquationBuilderTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createMathEquationBuilderQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params = state.profile !== null ? mathEquationBuilderParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 5;
  const inSession = state.phase === 'playing' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Budget ticker: one second per tick while playing; pause deactivates
  // the interval (timers frozen); resume continues the remaining budget. The
  // reducer transitions the round when the budget reaches zero.
  useGameInterval(
    state.phase === 'playing' && !state.paused && state.timeRemainingMs > 0,
    () => dispatch({ type: 'tick-timer' }),
    1000,
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
    const resolvedParams = mathEquationBuilderParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.numbersCount,
    );

    const raw = buildMathEquationBuilderRawResult({
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
    const normalized = normalizeMathEquationBuilderResult(raw, context);
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
    void persistMathEquationBuilderSession(record, persistSession).then((outcome) => {
      if (outcome.ok) {
        dispatch({ type: 'persistence-succeeded' });
        // Use the authoritative outcome from the rating pipeline for display.
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

  const handleNumberPress = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'playing' || current.paused) return;
      liveAudioHaptics.playSfx('memory-tile-correct');
      liveAudioHaptics.haptic('light');
      dispatch({ type: 'add-number', numberIndex: index });
    },
    [dispatch],
  );

  const handleOperatorPress = useCallback(
    (operator: Operator) => {
      const current = stateRef.current;
      if (current.phase !== 'playing' || current.paused) return;
      liveAudioHaptics.playSfx('memory-tile-correct');
      liveAudioHaptics.haptic('light');
      dispatch({ type: 'add-operator', operator });
    },
    [dispatch],
  );

  const handleGroup = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.paused) return;
    dispatch({ type: 'group' });
  }, [dispatch]);

  const handleUndo = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.paused) return;
    dispatch({ type: 'undo' });
  }, [dispatch]);

  const handleClear = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.paused) return;
    dispatch({ type: 'clear' });
  }, [dispatch]);

  const handleSubmit = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.paused) return;
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

  const canInteract = state.phase === 'playing' && !state.paused;
  const canGroup = canInteract && state.equationTokens.length >= 3;

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
        <>
          <ThemedText
            type="subtitle"
            testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
            Round {state.roundIndex + 1}/{rounds}
          </ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID={testId(GAME_ID, 'score')}>
            Score {state.stats.score}
          </ThemedText>
          <ThemedText
            type="small"
            themeColor={state.timeRemainingMs < 10_000 ? 'danger' : 'textSecondary'}
            testID={testId(GAME_ID, 'timer')}>
            {Math.max(0, Math.ceil(state.timeRemainingMs / 1000))}s
          </ThemedText>
        </>
      }
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial
          onComplete={completeTutorial}
          onSkip={isDevBuild() ? skipTutorial : undefined}
        />
      }>
      {inSession ? (
        <>
          <EquationDisplay
            target={state.target}
            tokens={state.equationTokens}
            result={state.phase === 'roundResult' ? state.roundResult : null}
            isCorrect={state.phase === 'roundResult' ? state.roundCorrect : null}
          />

          {state.phase === 'playing' ? (
            <>
              <NumberPad
                numbers={state.availableNumbers}
                usedIndices={state.usedNumberIndices}
                disabled={!canInteract}
                onNumberPress={handleNumberPress}
              />
              <OperatorPad
                operators={state.allowedOperators}
                disabled={!canInteract || !state.expectOperator}
                onOperatorPress={handleOperatorPress}
              />
              <View style={styles.actionRow}>
                <GameButton
                  small
                  testID={testId(GAME_ID, 'group')}
                  label="Group ( )"
                  variant="secondary"
                  disabled={!canGroup}
                  onPress={handleGroup}
                />
                <GameButton
                  small
                  testID={testId(GAME_ID, 'undo')}
                  label="Undo"
                  variant="secondary"
                  disabled={!canInteract || state.equationTokens.length === 0}
                  onPress={handleUndo}
                />
                <GameButton
                  small
                  testID={testId(GAME_ID, 'clear')}
                  label="Clear"
                  variant="secondary"
                  disabled={!canInteract || state.equationTokens.length === 0}
                  onPress={handleClear}
                />
                <GameButton
                  testID={testId(GAME_ID, 'submit')}
                  label="Submit"
                  disabled={
                    !canInteract ||
                    state.usedNumberIndices.length !== state.availableNumbers.length
                  }
                  onPress={handleSubmit}
                />
              </View>
            </>
          ) : null}

          {state.phase === 'roundResult' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={state.roundCorrect ? 'success' : 'danger'}
                testID={testId(
                  GAME_ID,
                  state.roundCorrect ? 'round-passed' : 'round-failed',
                )}>
                {state.roundCorrect ? 'Correct!' : state.roundResult !== null ? 'Wrong answer' : 'Time\'s up!'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Target was {state.target}
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

/** One label/value row on the results screen is provided by the shared `StatRow`. */

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
});
