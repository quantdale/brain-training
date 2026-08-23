/**
 * CodeCrackerScreen — the Code Cracker game (Mastermind-style deduction).
 *
 * GameHost-based slice: shared session lifecycle, auto-pause, tutorial/QA
 * gating, intro/pause/results chrome and the Android back-guard live in
 * `@/components/game-host`; this module keeps only what is Code-Cracker-
 * specific — the reducer wiring, the reveal/input/result phase views, the
 * scoring/persistence pipeline, and the guess flow. Solver validation and
 * generator logic are untouched.
 *
 * Pause semantics: pausing freezes the lifecycle timer; resuming continues
 * from the same position. The board is covered by the opaque shared
 * `PauseOverlay` and hidden from the accessibility tree while paused.
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
import { StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { ColorPicker } from './components/color-picker';
import { CurrentGuess } from './components/current-guess';
import { GameButton } from './components/button';
import { GuessHistory } from './components/guess-history';
import { QaPanel } from './components/qa-panel';
import { SecretReveal } from './components/secret-reveal';
import { Tutorial } from './components/tutorial';
import { codeCrackerParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createCodeCrackerQaForceStateHooks, createCodeCrackerTutorialLifecycle } from './hooks';
import { codeCrackerGameReducer } from './reducer';
import { normalizeCodeCrackerResult } from './scoring';
import {
  buildCodeCrackerRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistCodeCrackerSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialCodeCrackerState } from './types';
import { SCORING_VERSION } from './versions';

export interface CodeCrackerScreenProps {
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

export default function CodeCrackerScreen(props: CodeCrackerScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(codeCrackerGameReducer, undefined, createInitialCodeCrackerState);

  const stateRef = useRef(state);

  // Keep a ref of the latest state for event handlers.
  useEffect(() => {
    stateRef.current = state;
  });

  // Every in-session phase is pausable (reveal / input / round result).
  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'roundReveal' ||
          current.phase === 'input' ||
          current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createCodeCrackerTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createCodeCrackerQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? codeCrackerParamsFromProfile(state.profile) : null;
  const codeLength = params?.codeLength ?? 4;
  const colorCount = params?.colorCount ?? 6;
  const guessBudget = params?.guessBudget ?? 10;
  const rounds = params?.rounds ?? 4;
  const inSession =
    state.phase === 'roundReveal' || state.phase === 'input' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

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
    const resolvedParams = codeCrackerParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.stats.roundsSolved,
      state.stats.totalGuessesUsed,
      state.stats.totalGuessesBudget,
    );

    const raw = buildCodeCrackerRawResult({
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
      guessHistory: [],
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeCodeCrackerResult(raw, context);
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
    void persistCodeCrackerSession(record, persistSession).then((outcome) => {
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

  const handleSelectColor = useCallback(
    (colorIndex: number) => {
      const current = stateRef.current;
      if (current.phase !== 'input' || current.paused) {
        return;
      }
      liveAudioHaptics.playSfx('memory-tile-correct');
      liveAudioHaptics.haptic('light');
      dispatch({ type: 'select-color', colorIndex });
    },
    [dispatch],
  );

  const handleClearGuess = useCallback(() => {
    dispatch({ type: 'clear-current-guess' });
  }, [dispatch]);

  const handleSubmitGuess = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'input' || current.paused) {
      return;
    }
    liveAudioHaptics.playSfx('memory-tile-correct');
    dispatch({ type: 'submit-guess' });
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
    tutorial.skipForQa(GAME_ID); // dev-only (assertDevOnly inside)
    dispatch({ type: 'tutorial-close' });
  }, [tutorial, dispatch]);

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
        <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={state.phase === 'input' ? String(state.stats.score) : undefined}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {state.phase === 'roundReveal' ? (
        <View style={styles.section} testID={testId(GAME_ID, 'round-reveal')}>
          <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'reveal-status')}>
            Get ready to crack the code…
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'reveal-start')}
            label="Start guessing"
            onPress={() => dispatch({ type: 'reveal-code' })}
          />
        </View>
      ) : null}

      {state.phase === 'input' ? (
        <View style={styles.section} testID={testId(GAME_ID, 'input')}>
          <CurrentGuess
            currentGuess={state.currentGuess}
            codeLength={codeLength}
            showClear
            onClear={handleClearGuess}
          />

          <ColorPicker
            colorCount={colorCount}
            onSelectColor={handleSelectColor}
          />

          <GameButton
            testID={testId(GAME_ID, 'submit-guess')}
            label="Submit guess"
            disabled={state.currentGuess.length !== codeLength}
            onPress={handleSubmitGuess}
          />

          {state.roundGuesses.length > 0 ? (
            <GuessHistory
              guesses={state.roundGuesses}
              guessesUsed={state.guessesUsed}
              guessBudget={guessBudget}
            />
          ) : null}
        </View>
      ) : null}

      {state.phase === 'roundResult' ? (
        <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
          <ThemedText
            type="headline"
            themeColor={state.roundSolved ? 'success' : 'danger'}
            testID={testId(GAME_ID, state.roundSolved ? 'round-solved' : 'round-failed')}>
            {state.roundSolved ? 'Code cracked!' : 'Budget exhausted'}
          </ThemedText>

          <SecretReveal secretCode={state.secretCode} />

          {state.roundGuesses.length > 0 ? (
            <GuessHistory
              guesses={state.roundGuesses}
              guessesUsed={state.guessesUsed}
              guessBudget={guessBudget}
            />
          ) : null}

          <GameButton
            testID={testId(GAME_ID, 'next-round')}
            label={isLastRound ? 'See results' : 'Next round'}
            onPress={() => dispatch({ type: 'next-round' })}
          />
        </View>
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
              (state.stats.roundsPlayed > 0 ? state.stats.roundsSolved / state.stats.roundsPlayed : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Rounds solved"
            value={`${state.stats.roundsSolved}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'rounds-solved')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Total guesses"
            value={`${state.stats.totalGuessesUsed}/${state.stats.totalGuessesBudget}`}
            testID={testId(GAME_ID, 'total-guesses')}
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
});
