/**
 * CodeCrackerScreen — the Code Cracker game (Mastermind-style deduction).
 *
 * Renders a pure state machine (`codeCrackerGameReducer`) and owns the side
 * effects: the SDK `SessionLifecycle` (start/pause/resume/complete/abandon),
 * auto-pause on backgrounding, the tutorial, the dev-only QA panel, and
 * result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer; resuming continues
 * from the same position. The board is covered by the opaque `PauseOverlay`
 * and hidden from the accessibility tree while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  SessionLifecycle,
  isDevBuild,
  noopAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, DifficultyLevel, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { DifficultySelector, SessionHeader, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ColorPicker } from './components/color-picker';
import { CurrentGuess } from './components/current-guess';
import { GameButton } from './components/button';
import { GuessHistory } from './components/guess-history';
import { PauseOverlay } from './components/pause-overlay';
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

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function CodeCrackerScreen(props: CodeCrackerScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(codeCrackerGameReducer, undefined, createInitialCodeCrackerState);

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
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
    xpHook,
    persistSession,
  ]);

  // ---- Session controls.
  const startSession = useCallback(
    (level: DifficultyLevel, seed: string) => {
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
      !(current.phase === 'roundReveal' || current.phase === 'input' || current.phase === 'roundResult') ||
      current.paused
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

  const handleSelectColor = useCallback(
    (colorIndex: number) => {
      const current = stateRef.current;
      if (current.phase !== 'input' || current.paused) {
        return;
      }
      noopAudioHaptics.playSfx('memory-tile-correct');
      noopAudioHaptics.haptic('light');
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
    noopAudioHaptics.playSfx('memory-tile-correct');
    dispatch({ type: 'submit-guess' });
  }, [dispatch]);

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    const level = current.difficulty ?? 'normal';
    const seed = current.seedOverride ?? (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
    startSession(level, seed);
  }, [startSession, sessionSeed]);

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

  // ---- Auto-pause when the app leaves the foreground (constitution §11).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

  return (
    <View style={styles.screen} testID={testId(GAME_ID, 'screen')}>
      <View
        style={styles.content}
        importantForAccessibility={state.paused ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={state.paused}
        accessible={false}>
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
              <QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />
            ) : null}
          </View>
        ) : null}

        {state.phase === 'roundReveal' ? (
          <View style={styles.section} testID={testId(GAME_ID, 'round-reveal')}>
            <SessionHeader>
              <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
                Round {state.roundIndex + 1}/{rounds}
              </ThemedText>
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, 'pause')}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>
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
            <SessionHeader>
              <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
                Round {state.roundIndex + 1}/{rounds}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'score')}>
                Score {state.stats.score}
              </ThemedText>
              <GameButton
                small
                variant="secondary"
                testID={testId(GAME_ID, 'pause')}
                label="Pause"
                onPress={pauseSession}
              />
            </SessionHeader>

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
          <View style={styles.section} testID={testId(GAME_ID, 'results')}>
            <ThemedText type="title">Session complete</ThemedText>
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

            {state.persistState === 'failed' ? (
              <ThemedText
                type="small"
                themeColor="danger"
                testID={testId(GAME_ID, 'persist-error')}>
                Your session could not be saved. {state.lastError ?? ''}
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

        {isDevBuild() && inSession ? (
          <QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />
        ) : null}
      </View>

      {state.paused && inSession ? (
        <PauseOverlay onResume={resumeSession} onQuit={quitToLibrary} />
      ) : null}

      {state.tutorialOpen ? (
        <Tutorial
          onComplete={completeTutorial}
          onSkip={isDevBuild() ? skipTutorial : undefined}
        />
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
});
