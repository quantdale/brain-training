/**
 * SentenceBuilderScreen — the Sentence Builder game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Sentence-Builder-specific — the reducer wiring, the per-sentence
 * budget timeout, the scoring/persistence pipeline, and the puzzle view.
 *
 * The route renders this component with no props; every prop is an optional
 * injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the
 * per-sentence countdown; resuming re-arms it. The puzzle is covered by the
 * opaque shared PauseOverlay and hidden from the accessibility tree while
 * paused.
 *
 * Layout stability: the word-chip field's width is captured via onLayout and
 * stored in state.fieldWidth; this width survives remounts between rounds
 * (roundResult → puzzle) because it is carried in the reducer state.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { isDevBuild, liveAudioHaptics, noopXpRatingHook, systemClock, testId } from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, StatRow } from '@/components/game-ui';
import { Radii, Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
  useGameTimeout,
} from '@/components/game-host';

import { CATEGORY_LABELS } from './content/sentence-bank';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { WordChips } from './components/word-grid';
import { paramsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createSentenceBuilderQaForceStateHooks,
  createSentenceBuilderTutorialLifecycle,
} from './hooks';
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

export default function SentenceBuilderScreen(props: SentenceBuilderScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(sentenceBuilderReducer, undefined, createInitialState);

  const stateRef = useRef(state);
  // Keep a ref of the latest state for event handlers.
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (current.phase === 'puzzle' || current.phase === 'roundResult') && !current.paused;
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(
    () => createSentenceBuilderTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createSentenceBuilderQaForceStateHooks(dispatch),
    [dispatch],
  );

  const params = state.profile !== null ? paramsFromProfile(state.profile) : null;
  const timeBudgetMs = params?.timeBudgetMs ?? 25_000;
  const rounds = params?.rounds ?? 5;
  const inSession = state.phase === 'puzzle' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Per-sentence timer: one budget timeout while the puzzle phase is
  // live; pause cancels (frozen), resume re-arms. Every round entry passes
  // through a phase transition (puzzle → roundResult → puzzle), so keying on
  // the active flag alone restarts the budget per round exactly as before.
  useGameTimeout(
    state.phase === 'puzzle' && !state.paused,
    () => dispatch({ type: 'timer-expired' }),
    timeBudgetMs,
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
    session,
    xpHook,
    persistSession,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
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

  const handleTapWord = useCallback(
    (scrambledIndex: number) => {
      const current = stateRef.current;
      if (current.phase !== 'puzzle' || current.paused) {
        return;
      }
      // Play haptic feedback.
      liveAudioHaptics.haptic('light');
      dispatch({ type: 'tap-word', index: scrambledIndex });
    },
    [dispatch],
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

  // ---- Build the player's ordered words from taps for display.
  const playerWords = useMemo(() => {
    if (state.scrambled === null) return [];
    return state.taps.map((i) => state.scrambled!.scrambled[i]);
  }, [state.taps, state.scrambled]);

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
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession && state.scrambled !== null ? (
        <>
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
        </GameResults>
      ) : null}
    </GameHost>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
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
