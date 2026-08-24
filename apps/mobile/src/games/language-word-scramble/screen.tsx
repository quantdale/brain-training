/**
 * WordScrambleScreen — the Word Scramble game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Word-Scramble-specific — option selection/submit handling,
 * option visuals, and the scoring/persistence pipeline.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
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
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { OptionButton } from './components/option-button';
import { QaPanel } from './components/qa-panel';
import { ScrambledDisplay } from './components/scrambled-display';
import { Tutorial } from './components/tutorial';
import { wordScrambleParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createWordScrambleQaForceStateHooks, createWordScrambleTutorialLifecycle } from './hooks';
import { wordScrambleGameReducer } from './reducer';
import { normalizeWordScrambleResult } from './scoring';
import {
  buildWordScrambleRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistWordScrambleSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialWordScrambleState } from './types';
import { SCORING_VERSION } from './versions';

export interface WordScrambleScreenProps {
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

export default function WordScrambleScreen(props: WordScrambleScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(
    wordScrambleGameReducer,
    undefined,
    createInitialWordScrambleState,
  );

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
      return (current.phase === 'play' || current.phase === 'roundResult') && !current.paused;
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createWordScrambleTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createWordScrambleQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? wordScrambleParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 5;
  const inSession =
    state.phase === 'play' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

  // ---- Session finalization: complete the lifecycle, run the SDK scoring
  // pipeline, and persist atomically. `claimFinalize()` guards against double
  // submission (once per session).
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
    const resolvedParams = wordScrambleParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, resolvedParams.optionsCount);

    const raw = buildWordScrambleRawResult({
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
    const normalized = normalizeWordScrambleResult(raw, context);
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
    void persistWordScrambleSession(record, persistSession).then((outcome) => {
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

  const handleSelectOption = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'play' || current.paused || current.submitted) {
        return;
      }
      dispatch({ type: 'select-option', index });
    },
    [dispatch],
  );

  const handleSubmit = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'play' || current.paused || current.submitted) {
      return;
    }
    if (current.currentRound !== null) {
      const correct = current.selectedIndex === current.currentRound.correctIndex;
      if (correct) {
        liveAudioHaptics.playSfx('memory-tile-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('memory-tile-wrong');
        liveAudioHaptics.haptic('warning');
      }
    }
    dispatch({ type: 'submit-answer' });
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

  // ---- Option visual state for the current round. Stable across re-renders:
  // depends only on round-transition state (no per-tick timer drives this screen).
  const optionVisualFor = useCallback(
    (index: number): 'idle' | 'selected' | 'correct' | 'wrong' => {
      if (state.phase === 'play') {
        return index === state.selectedIndex ? 'selected' : 'idle';
      }
      if (state.phase === 'roundResult' && state.currentRound !== null) {
        if (index === state.currentRound.correctIndex) {
          return 'correct';
        }
        if (index === state.selectedIndex && state.roundOutcome === 'failed') {
          return 'wrong';
        }
      }
      return 'idle';
    },
    [state.phase, state.selectedIndex, state.roundOutcome, state.currentRound],
  );

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
      score={String(state.stats.score)}
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
          {state.phase === 'play' && state.currentRound !== null ? (
            <>
              <ScrambledDisplay
                scrambled={state.currentRound.scrambled}
                category={state.currentRound.category}
              />
              <View style={styles.optionsGrid}>
                {state.currentRound.options.map((option, i) => (
                  <OptionButton
                    key={`${state.roundIndex}-${i}`}
                    index={i}
                    label={option}
                    visual={optionVisualFor(i)}
                    onPressOption={handleSelectOption}
                  />
                ))}
              </View>
              <GameButton
                testID={testId(GAME_ID, 'submit')}
                label="Submit"
                disabled={state.selectedIndex < 0}
                onPress={handleSubmit}
              />
            </>
          ) : null}

          {state.phase === 'roundResult' && state.currentRound !== null ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={state.roundOutcome === 'passed' ? 'success' : 'danger'}
                testID={testId(GAME_ID, state.roundOutcome === 'passed' ? 'round-passed' : 'round-failed')}>
                {state.roundOutcome === 'passed' ? 'Correct!' : 'Wrong!'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Answer: {state.currentRound.answer}
              </ThemedText>
              <View style={styles.optionsGrid}>
                {state.currentRound.options.map((option, i) => (
                  <OptionButton
                    key={`result-${state.roundIndex}-${i}`}
                    index={i}
                    label={option}
                    visual={optionVisualFor(i)}
                    disabled
                    onPressOption={handleSelectOption}
                  />
                ))}
              </View>
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
            label="Longest word"
            value={String(state.stats.longestWord)}
            testID={testId(GAME_ID, 'longest-word')}
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
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
});
