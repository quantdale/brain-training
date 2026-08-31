/**
 * WordChainScreen — the Word Chain game.
 *
 * GameHost-based slice: shared session lifecycle, auto-pause, tutorial/QA
 * gating, intro/pause/results chrome and the Android back-guard live in
 * `@/components/game-host`; this module keeps only what is Word-Chain-
 * specific — the reducer wiring, the per-chain expiry timer, the chain view,
 * and the scoring/persistence pipeline.
 *
 * Pause semantics: pausing freezes the chain deadline (the reducer nulls it
 * and stores the remaining budget; resume rebuilds it) and tears down the
 * expiry timer; resume re-arms it for the remainder. The board is covered by
 * the opaque shared `PauseOverlay` and hidden from the accessibility tree so
 * the chain cannot be studied during a pause.
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
import type {
  Clock,
  TutorialStore,
  XpRatingHook,
} from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameTimeout,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { GameButton } from './components/button';
import { Option } from './components/option';
import type { OptionVisualState } from './components/option';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import {
  wordChainParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createWordChainQaForceStateHooks,
  createWordChainTutorialLifecycle,
} from './hooks';
import { wordChainReducer } from './reducer';
import { normalizeWordChainResult } from './scoring';
import {
  buildWordChainRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistWordChainSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialLanguageWordChainState } from './types';
import { SCORING_VERSION } from './versions';

export interface WordChainScreenProps {
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

export default function WordChainScreen(props: WordChainScreenProps = {}) {
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
    wordChainReducer,
    undefined,
    createInitialLanguageWordChainState,
  );

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  });

  // Only the question phase pauses (round result has no running clock).
  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return current.phase === 'question' && !current.paused;
    },
    onPause: () => dispatch({ type: 'pause', nowMs: clock.now() }),
  });

  const tutorial = useMemo(
    () => createWordChainTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(
    () => createWordChainQaForceStateHooks(dispatch),
    [dispatch],
  );

  const rounds = state.params?.rounds ?? 6;
  const budgetSeconds = Math.max(1, Math.round(state.roundBudgetMs / 1000));
  const inSession = state.phase === 'question' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;
  // Hoisted so the JSX below can narrow without non-null assertions.
  const round = state.currentRound;
  const activeStep =
    state.phase === 'question' && round !== null
      ? (round.steps[state.currentStepIndex] ?? null)
      : null;

  // ---- Chain expiry: one timer per question phase; paused deactivates it
  // (the reducer nulls the deadline) and resume re-arms it for the remainder.
  useGameTimeout(
    state.phase === 'question' && !state.paused && state.roundDeadlineMs !== null,
    () => {
      liveAudioHaptics.feedback('failure');
      dispatch({ type: 'expire-round', nowMs: clock.now() });
    },
    Math.max(0, state.roundDeadlineMs !== null ? state.roundDeadlineMs - clock.now() : 0),
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
      state.params === null ||
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
    const resolvedParams = wordChainParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.currentTier,
    );

    const raw = buildWordChainRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      outcomes: state.roundOutcomes,
      finalTier: state.currentTier,
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
    const normalized = normalizeWordChainResult(raw, context);
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
    void persistWordChainSession(record, persistSession).then((outcome) => {
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
    state.params,
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.currentTier,
    state.roundOutcomes,
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
      dispatch({ type: 'resume', nowMs: clock.now() });
    }
  }, [session, clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handleAnswer = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (
        current.phase !== 'question' ||
        current.paused ||
        current.currentRound === null ||
        current.roundDeadlineMs === null
      ) {
        return;
      }
      const nowMs = clock.now();
      if (nowMs > current.roundDeadlineMs) {
        // Expired — a late tap changes nothing; the expiry timer fires the
        // timeout transition instead.
        return;
      }
      const step =
        current.currentRound.steps[current.currentStepIndex];
      liveAudioHaptics.feedback(
        index === step.correctIndex ? 'correct' : 'wrong',
      );
      dispatch({ type: 'answer-step', index, nowMs });
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
      nowMs: clock.now(),
    });
  }, [session, sessionSeed, clock, dispatch]);

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

  // ---- Chain rendering: which positions are known, and option visuals.
  const activeStepPosition = activeStep?.position ?? null;

  const visualFor = useCallback(
    (index: number): OptionVisualState => {
      if (state.phase === 'question' || round === null) {
        return 'idle';
      }
      const step = round.steps[state.currentStepIndex];
      if (state.roundOutcome === 'correct') {
        return index === state.lastAnswerIndex ? 'correct' : 'muted';
      }
      if (index === step.correctIndex) return 'correct';
      if (index === state.lastAnswerIndex) return 'wrong';
      return 'muted';
    },
    [
      state.phase,
      round,
      state.currentStepIndex,
      state.roundOutcome,
      state.lastAnswerIndex,
    ],
  );

  const roundResultMessage =
    state.roundOutcome === 'correct'
      ? 'Chain complete!'
      : state.roundOutcome === 'timeout'
        ? 'Time’s up'
        : 'Broken link';

  const view: GameHostView =
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
        <ThemedText
          type="subtitle"
          testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}
        >
          Round {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
          onForceTimeout={qaHooks.forceTimeout}
        />
      }
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession && round !== null ? (
        <>
          {/* The chain: revealed words plus blanks. Unknown positions render
              as "?" (or the required first letter for the active blank), so
              the answer is never readable off the UI or accessibility tree. */}
          <View style={styles.chain} testID={testId(GAME_ID, 'chain')}>
            {round.words.map((word, index) => {
              const solved =
                round.fixed[index] ||
                (activeStepPosition !== null && index < activeStepPosition);
              const isActiveBlank = index === activeStepPosition;
              return (
                <View
                  key={index}
                  style={[
                    styles.chipWrap,
                    { borderColor: theme.border },
                    isActiveBlank && state.phase === 'question'
                      ? { borderColor: theme.accent }
                      : null,
                  ]}
                  testID={testId(GAME_ID, 'chain-word', String(index))}
                >
                  <ThemedText type="bodyLarge">
                    {solved
                      ? word
                      : isActiveBlank && state.phase === 'question' && activeStep !== null
                        ? `${activeStep.requiredFirstLetter}…`
                        : '?'}
                  </ThemedText>
                </View>
              );
            })}
          </View>

          {state.phase === 'question' && activeStep !== null ? (
            <View style={styles.section}>
              <ThemedText
                type="caption"
                themeColor="textSecondary"
                testID={testId(GAME_ID, 'time-budget')}
              >
                Answer within {budgetSeconds}s
              </ThemedText>
              <View
                style={styles.dots}
                testID={testId(GAME_ID, 'progress')}
                accessibilityLabel={`${state.currentStepIndex} of ${round.steps.length} links filled`}
              >
                {Array.from({ length: round.steps.length }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          i < state.currentStepIndex
                            ? theme.accent
                            : theme.border,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.options}>
                {activeStep.options.map((word, index) => (
                  <Option
                    key={index}
                    index={index}
                    label={word}
                    visual={visualFor(index)}
                    onPressOption={handleAnswer}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {state.phase === 'roundResult' ? (
            <View
              style={styles.section}
              testID={testId(GAME_ID, 'round-result')}
            >
              <ThemedText
                type="headline"
                themeColor={
                  state.roundOutcome === 'correct'
                    ? 'success'
                    : state.roundOutcome === 'timeout'
                      ? 'warning'
                      : 'danger'
                }
                testID={testId(
                  GAME_ID,
                  state.roundOutcome === 'correct'
                    ? 'round-correct'
                    : state.roundOutcome === 'timeout'
                      ? 'round-timeout'
                      : 'round-wrong',
                )}
              >
                {roundResultMessage}
              </ThemedText>
              {state.roundOutcome !== 'correct' ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID={testId(GAME_ID, 'round-answer-reveal')}
                >
                  The chain was {round.words.join(' → ')}
                </ThemedText>
              ) : null}
              <View style={styles.options}>
                {round.steps[state.currentStepIndex].options.map(
                  (word, index) => (
                    <Option
                      key={index}
                      index={index}
                      label={word}
                      visual={visualFor(index)}
                      disabled
                      onPressOption={handleAnswer}
                    />
                  ),
                )}
              </View>
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={() =>
                  dispatch({ type: 'next-round', nowMs: clock.now() })
                }
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
                ? state.stats.roundsCorrect / state.stats.roundsPlayed
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'accuracy')}
          />
          <StatRow
            label="Rounds correct"
            value={`${state.stats.roundsCorrect}/${state.stats.roundsPlayed}`}
            testID={testId(GAME_ID, 'rounds-correct')}
          />
          <StatRow
            label="Best streak"
            value={String(state.stats.bestStreak)}
            testID={testId(GAME_ID, 'best-streak')}
          />
          <StatRow
            label="Avg answer time"
            value={
              state.stats.roundsPlayed > 0
                ? `${(state.stats.totalAnswerMs / state.stats.roundsPlayed / 1000).toFixed(1)}s`
                : '—'
            }
            testID={testId(GAME_ID, 'avg-time')}
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
  chain: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chipWrap: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.oneHalf,
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
  options: {
    gap: Spacing.two,
  },
});
