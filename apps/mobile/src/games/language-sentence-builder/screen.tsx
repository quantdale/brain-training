/**
 * SentenceBuilderScreen — the Sentence Builder game.
 *
 * Renders a pure state machine (`sentenceBuilderReducer`) and owns the side
 * effects: per-sentence timer, the SDK `SessionLifecycle` (start/pause/resume/
 * complete/abandon), auto-pause on backgrounding, the tutorial, the dev-only
 * QA panel, and result persistence.
 *
 * The route renders this component with no props; every prop is an optional
 * injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the
 * per-sentence countdown; resuming continues the timer from where it left off.
 * The puzzle is covered by the opaque PauseOverlay and hidden from the
 * accessibility tree while paused.
 *
 * Layout stability: the word-chip field's width is captured via onLayout and
 * stored in state.fieldWidth; this width survives remounts between rounds
 * (roundResult → puzzle) because it is carried in the reducer state.
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
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { CATEGORY_LABELS } from './content/sentence-bank';
import { GameButton } from './components/button';
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { WordChips } from './components/word-grid';
import { paramsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createSentenceBuilderQaForceStateHooks, createSentenceBuilderTutorialLifecycle } from './hooks';
import { sentenceBuilderReducer } from './reducer';
import { normalizeSentenceBuilderResult } from './scoring';
import {
  buildRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSession as persistSessionFn,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialState } from './types';
import { SCORING_VERSION } from './versions';

export interface SentenceBuilderScreenProps {
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

function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function SentenceBuilderScreen(props: SentenceBuilderScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(sentenceBuilderReducer, undefined, createInitialState);

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref of the latest state for event handlers.
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(() => createSentenceBuilderTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createSentenceBuilderQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? paramsFromProfile(state.profile) : null;
  const timeBudgetMs = params?.timeBudgetMs ?? 25_000;
  const rounds = params?.rounds ?? 5;
  const inSession = state.phase === 'puzzle' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Per-sentence timer: countdown in the puzzle phase.
  useEffect(() => {
    // Clear any existing timer.
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (state.phase !== 'puzzle' || state.paused) {
      return;
    }

    timerRef.current = setTimeout(() => {
      dispatch({ type: 'timer-expired' });
    }, timeBudgetMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.phase, state.paused, state.roundIndex, timeBudgetMs]);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

  // ---- Session finalization.
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
    const resolvedParams = paramsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.stats.longestSentence);

    // Compute avg word length factor from stats.
    const avgWl = state.stats.roundsPlayed > 0
      ? (state.stats.totalTaps / state.stats.roundsPlayed) / state.stats.roundsPlayed * 3
      : 4;
    const awlf = Math.min(1, Math.max(0, (avgWl - 3) / 5));

    const raw = buildRawResult({
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
      avgWordLengthFactor: awlf,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeSentenceBuilderResult(raw, context);
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
    void persistSessionFn(record, persistSession).then((outcome) => {
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
    if (!(current.phase === 'puzzle' || current.phase === 'roundResult') || current.paused) {
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

  const handleTapWord = useCallback(
    (scrambledIndex: number) => {
      const current = stateRef.current;
      if (current.phase !== 'puzzle' || current.paused) {
        return;
      }
      // Play haptic feedback.
      noopAudioHaptics.haptic('light');
      dispatch({ type: 'tap-word', index: scrambledIndex });
    },
    [dispatch],
  );

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
    tutorial.skipForQa(GAME_ID);
    dispatch({ type: 'tutorial-close' });
  }, [tutorial, dispatch]);

  // ---- Auto-pause when the app leaves the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

  // ---- Build the player's ordered words from taps for display.
  const playerWords = useMemo(() => {
    if (state.scrambled === null) return [];
    return state.taps.map((i) => state.scrambled!.scrambled[i]);
  }, [state.taps, state.scrambled]);

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

        {inSession && state.scrambled !== null ? (
          <View style={styles.section}>
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

            {/* Category hint */}
            <ThemedText
              type="caption"
              themeColor="textSecondary"
              testID={testId(GAME_ID, 'category-hint')}>
              {CATEGORY_LABELS[state.scrambled.category] ?? state.scrambled.category}
            </ThemedText>

            {/* Player's ordered words (the sentence being built) */}
            <View style={styles.playerSentence} testID={testId(GAME_ID, 'player-sentence')}>
              {playerWords.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Tap the words below in the correct order…
                </ThemedText>
              ) : (
                playerWords.map((word, i) => (
                  <ThemedText key={i} type="bodyLarge" testID={testId(GAME_ID, 'placed-word', String(i))}>
                    {word}
                  </ThemedText>
                ))
              )}
            </View>

            {/* Scrambled word chips */}
            <WordChips
              words={state.scrambled.scrambled}
              tappedIndices={state.taps}
              disabled={state.phase === 'roundResult'}
              testID={testId(GAME_ID, 'word-grid')}
              onTapWord={handleTapWord}
            />

            {/* Round result */}
            {state.phase === 'roundResult' ? (
              <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
                <ThemedText
                  type="headline"
                  themeColor={state.roundOutcome === 'passed' ? 'success' : 'danger'}
                  testID={testId(GAME_ID, state.roundOutcome === 'passed' ? 'round-passed' : 'round-failed')}>
                  {state.roundOutcome === 'passed' ? 'Round passed!' : 'Round failed'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {state.roundOutcome === 'failed'
                    ? `Correct order: ${state.scrambled.original.join(' ')}`
                    : `+${state.stats.score} points`}
                </ThemedText>
                <GameButton
                  testID={testId(GAME_ID, 'next-round')}
                  label={isLastRound ? 'See results' : 'Next round'}
                  onPress={() => dispatch({ type: 'next-round' })}
                />
              </View>
            ) : null}

            {isDevBuild() ? (
              <QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />
            ) : null}
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
                (state.stats.roundsPlayed > 0 ? state.stats.roundsPassed / state.stats.roundsPlayed : 0) * 100,
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
              label="Longest sentence"
              value={`${state.stats.longestSentence} words`}
              testID={testId(GAME_ID, 'longest-sentence')}
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
  playerSentence: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.oneHalf,
    padding: Spacing.two,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: '#00000022',
    minHeight: 48,
    alignItems: 'center',
  },
});
