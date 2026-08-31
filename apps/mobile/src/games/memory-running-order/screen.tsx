/**
 * RunningOrderScreen — the Running Order game (working-memory update variant).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Running-Order-specific — the reducer wiring, the reveal pacing
 * timer, the scoring/persistence pipeline, and the symbol recall view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels reveal
 * pacing; resuming re-flashes the current symbol; the content is covered by
 * the opaque shared `PauseOverlay` and hidden from the accessibility tree
 * while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { isDevBuild, liveAudioHaptics, noopXpRatingHook, systemClock, testId } from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameDeadlineTimeout,
  useGameSession,
} from '@/components/game-host';

import { SymbolView } from './components/symbol-view';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { runningOrderParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createRunningOrderQaForceStateHooks, createRunningOrderTutorialLifecycle } from './hooks';
import { runningOrderGameReducer } from './reducer';
import { normalizeRunningOrderResult } from './scoring';
import {
  buildRunningOrderRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistRunningOrderSession,
} from './session';
import type { SessionPersistence } from './session';
import { streamTarget } from './generator';
import { RUNNING_ORDER_SYMBOLS } from './symbols';
import { GAME_ID, createInitialRunningOrderState } from './types';
import { SCORING_VERSION } from './versions';

export interface RunningOrderScreenProps {
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

export default function RunningOrderScreen(props: RunningOrderScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(runningOrderGameReducer, undefined, createInitialRunningOrderState);

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'reveal' || current.phase === 'input' || current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createRunningOrderTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createRunningOrderQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? runningOrderParamsFromProfile(state.profile) : null;
  const flashMs = params?.flashMs ?? 800;
  const rounds = params?.rounds ?? 5;
  const inSession =
    state.phase === 'reveal' || state.phase === 'input' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Reveal pacing: one tick per symbol. The deadline preserves the
  // current symbol's remaining flash time across pause/resume.
  useGameDeadlineTimeout(
    state.phase === 'reveal' && !state.paused,
    () => dispatch({ type: 'reveal-tick' }),
    flashMs,
    clock,
    `reveal:${state.sessionId ?? 'idle'}:${state.roundIndex}:${state.revealedIndex}`,
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
    const resolvedParams = runningOrderParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.recallLength);

    const raw = buildRunningOrderRawResult({
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
    const normalized = normalizeRunningOrderResult(raw, context);
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
    void persistRunningOrderSession(record, persistSession).then((outcome) => {
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
    state.recallLength,
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

  const handleTapSymbol = useCallback(
    (id: number) => {
      const current = stateRef.current;
      if (current.phase !== 'input' || current.paused || current.roundScored) {
        return;
      }
      liveAudioHaptics.feedback('tap');
      dispatch({ type: 'tap-symbol', id });
    },
    [dispatch],
  );

  const handleBackspace = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'input' || current.paused || current.roundScored) {
      return;
    }
    liveAudioHaptics.feedback('tap');
    dispatch({ type: 'backspace' });
  }, [dispatch]);

  const handleSubmit = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'input' || current.paused || current.roundScored) {
      return;
    }
    if (current.answer.length !== current.recallLength) {
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

  const view: 'intro' | 'session' | 'results' =
    state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session';

  const target: number[] =
    state.phase === 'roundResult' ? streamTarget(state.stream, state.recallLength) : [];

  return (
    <GameHost
      gameId={GAME_ID}
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
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
          {state.phase === 'reveal' ? (
            <View style={[styles.center, styles.section]} testID={testId(GAME_ID, 'reveal')}>
              <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'reveal-status')}>
                Watch the stream…
              </ThemedText>
              {state.revealedIndex >= 0 && state.revealedIndex < state.stream.length ? (
                <SymbolView
                  symbolId={state.stream[state.revealedIndex]}
                  size={80}
                  testID={testId(GAME_ID, 'reveal-symbol')}
                />
              ) : null}
              <View
                style={styles.dots}
                testID={testId(GAME_ID, 'progress')}
                accessibilityLabel={`Item ${Math.min(state.revealedIndex + 1, state.stream.length)} of ${state.stream.length}`}>
                {Array.from({ length: state.stream.length }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: i <= state.revealedIndex ? theme.accent : theme.border },
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {state.phase === 'input' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'input')}>
              <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'input-status')}>
                Recall the last {state.recallLength} in order
              </ThemedText>
              <View style={styles.answerRow} testID={testId(GAME_ID, 'answer')}>
                {Array.from({ length: state.recallLength }, (_, i) => (
                  <View key={i} style={styles.answerSlot}>
                    {state.answer[i] !== undefined ? (
                      <SymbolView symbolId={state.answer[i]} size={40} testID={testId(GAME_ID, 'answer', String(i))} />
                    ) : null}
                  </View>
                ))}
              </View>
              <View style={styles.palette} testID={testId(GAME_ID, 'palette')}>
                {RUNNING_ORDER_SYMBOLS.map((sym) => (
                  <SymbolView
                    key={sym.id}
                    symbolId={sym.id}
                    size={40}
                    testID={testId(GAME_ID, 'palette', String(sym.id))}
                    onPress={() => handleTapSymbol(sym.id)}
                    disabled={state.answer.length >= state.recallLength}
                  />
                ))}
              </View>
              <View style={styles.buttonRow}>
                <GameButton
                  testID={testId(GAME_ID, 'backspace')}
                  label="Back"
                  variant="secondary"
                  onPress={handleBackspace}
                  disabled={state.answer.length === 0}
                />
                <GameButton
                  testID={testId(GAME_ID, 'submit')}
                  label="Submit"
                  onPress={handleSubmit}
                  disabled={state.answer.length !== state.recallLength}
                />
              </View>
            </View>
          ) : null}

          {state.phase === 'roundResult' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
              <ThemedText
                type="headline"
                themeColor={state.roundOutcome === 'passed' ? 'success' : 'danger'}
                testID={testId(GAME_ID, state.roundOutcome === 'passed' ? 'round-passed' : 'round-failed')}>
                {state.roundOutcome === 'passed' ? 'Correct order!' : 'Not quite'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You recalled {state.roundCorrectTargets} of {state.recallLength} in order
              </ThemedText>
              <View style={styles.sequenceRow}>
                <ThemedText type="small" themeColor="textSecondary">Answer:</ThemedText>
                {state.answer.map((id, i) => (
                  <SymbolView key={i} symbolId={id} size={32} testID={testId(GAME_ID, 'result-answer', String(i))} />
                ))}
              </View>
              <View style={styles.sequenceRow}>
                <ThemedText type="small" themeColor="textSecondary">Target:</ThemedText>
                {target.map((id, i) => (
                  <SymbolView key={i} symbolId={id} size={32} testID={testId(GAME_ID, 'result-target', String(i))} />
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
          <StatRow label="Score" value={String(state.stats.score)} testID={testId(GAME_ID, 'score')} />
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
          <StatRow label="Best recall" value={String(state.stats.bestRecall)} testID={testId(GAME_ID, 'best-recall')} />
          <StatRow label="Best streak" value={String(state.stats.bestStreak)} testID={testId(GAME_ID, 'best-streak')} />
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
  center: {
    alignItems: 'center',
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
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  answerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  answerSlot: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  sequenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.oneHalf,
    flexWrap: 'wrap',
  },
});
