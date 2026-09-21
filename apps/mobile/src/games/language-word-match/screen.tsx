/**
 * LanguageWordMatchScreen — the Word Match game.
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Word-Match-specific — the reducer wiring, the per-round expiry
 * timeout, the scoring/persistence pipeline, and the question view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Timing: all gameplay timing comes from the injectable SDK monotonic clock
 * (never `Date.now()`). The round deadline lives in the reducer; the screen
 * schedules one timeout per active round segment (paused segments clear it,
 * resumes re-schedule from the frozen remaining budget). Pausing freezes the
 * lifecycle timer; the challenge is covered by the opaque shared PauseOverlay
 * and hidden from the accessibility tree while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { isDevBuild, liveAudioHaptics, systemClock, testId } from '@/sdk';
import { pipelineXpRatingHook } from '@/rating/xp-hook';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, StatRow } from '@/components/game-ui';
import { AnimatedNumber, useSafeBack } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
  useGameTimeout,
} from '@/components/game-host';

import { Option } from './components/option';
import type { OptionVisualState } from './components/option';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { languageParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createLanguageQaForceStateHooks, createLanguageTutorialLifecycle } from './hooks';
import { languageGameReducer } from './reducer';
import { normalizeLanguageResult } from './scoring';
import {
  buildLanguageRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistLanguageSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialLanguageState } from './types';
import { SCORING_VERSION } from './versions';

export interface LanguageWordMatchScreenProps {
  /** Injectable clock for session timing (tests); defaults to the system clock. */
  clock?: Clock;
  /** Injectable tutorial persistence (tests); defaults to an in-memory store. */
  tutorialStore?: TutorialStore;
  /** Fixed session seed (tests); defaults to a random per-session seed. */
  sessionSeed?: string | number;
  /** Injectable session persister (tests); defaults to the db layer. */
  persistSession?: SessionPersistence;
  /** Injectable XP/rating hook; defaults to the pipeline hook for optimistic display parity. */
  xpHook?: XpRatingHook;
}

export default function LanguageWordMatchScreen(props: LanguageWordMatchScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = pipelineXpRatingHook,
  } = props;
  const goBack = useSafeBack('/games');
  const [state, dispatch] = useReducer(languageGameReducer, undefined, createInitialLanguageState);
  // Theme slots for the round-result feedback panel (soft verdict tints).
  const theme = useTheme();

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
      return current.phase === 'question' && !current.paused;
    },
    onPause: () => dispatch({ type: 'pause', nowMs: clock.now() }),
  });

  const tutorial = useMemo(() => createLanguageTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createLanguageQaForceStateHooks(dispatch), [dispatch]);

  const params = state.params;
  const rounds = params?.rounds ?? 6;
  const budgetSeconds = Math.max(1, Math.round(state.roundBudgetMs / 1000));
  const inSession = state.phase === 'question' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Round expiry: one timeout per active round segment, scheduled from
  // the monotonic deadline; pause cancels (timers frozen), resume re-schedules
  // from the frozen remaining budget.
  useGameTimeout(
    state.phase === 'question' && !state.paused && state.roundDeadlineMs !== null,
    () => dispatch({ type: 'expire-round', nowMs: clock.now() }),
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
    const resolvedParams = languageParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.currentTier);

    const raw = buildLanguageRawResult({
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
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeLanguageResult(raw, context);
    const xp = xpHook.computeXp(normalized, context);
    // Rating deltas land via the authoritative completion outcome; the
    // pipeline hook intentionally returns none here.
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
      // Rating pipeline reads the final computed challenge from the record
      // difficulty, not the SDK baseline profile (006r adaptive contract).
      difficulty: { ...state.profile, challengeRating },
      normalized,
      xp,
      startedAtMs: state.startedAtMs,
      completedAtMs,
      activeDurationMs,
    });
    dispatch({ type: 'persistence-started' });
    void persistLanguageSession(record, persistSession).then((outcome) => {
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
    goBack();
  }, [session, goBack]);

  const handleAnswer = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'question' || current.paused || current.roundDeadlineMs === null) {
        return;
      }
      const nowMs = clock.now();
      if (nowMs > current.roundDeadlineMs) {
        // Late tap: the round already expired — let the timer's timeout land.
        return;
      }
      const correct = index === current.round?.correctIndex;
      if (correct) {
        liveAudioHaptics.playSfx('language-word-match-correct');
        liveAudioHaptics.haptic('success');
      } else {
        liveAudioHaptics.playSfx('language-word-match-wrong');
        liveAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'answer-option', index, nowMs });
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

  // ---- Option visuals (see OptionVisualState). Stable across re-renders:
  // depends only on round-transition state, never on per-tick timers (the round
  // expiry uses a one-shot timeout, so there is no per-tick re-render here).
  const visualFor = useCallback(
    (index: number): OptionVisualState => {
      if (state.phase === 'question' || state.round === null) {
        return 'idle';
      }
      if (state.roundOutcome === 'correct') {
        return index === state.lastAnswerIndex ? 'correct' : 'muted';
      }
      if (index === state.round.correctIndex) {
        return 'correct';
      }
      if (index === state.lastAnswerIndex) {
        return 'wrong';
      }
      return 'muted';
    },
    [state.phase, state.round, state.roundOutcome, state.lastAnswerIndex],
  );

  const roundResultMessage =
    state.roundOutcome === 'correct'
      ? 'Correct!'
      : state.roundOutcome === 'timeout'
        ? 'Time’s up'
        : 'Not quite';

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
      roundProgress={{ value: state.roundIndex + 1, total: rounds }}
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
      {inSession ? (
        <>
          {state.phase === 'question' && state.round !== null ? (
            <View style={styles.section}>
              <View style={styles.scoreRow}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Score
                </ThemedText>
                <AnimatedNumber
                  value={state.stats.score}
                  type="numeral"
                  testID={testId(GAME_ID, 'score', 'live')}
                />
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                Pick the synonym
              </ThemedText>
              <ThemedText
                type="headline"
                testID={testId(GAME_ID, 'prompt')}
                accessibilityLabel={`Prompt word: ${state.round.prompt}`}>
                {state.round.prompt}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" testID={testId(GAME_ID, 'time-budget')}>
                Answer within {budgetSeconds}s
              </ThemedText>
              <View style={styles.options}>
                {state.round.options.map((word, index) => (
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

          {state.phase === 'roundResult' && state.round !== null ? (
            <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
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
                )}>
                {roundResultMessage}
              </ThemedText>
              <View
                style={[
                  styles.feedback,
                  {
                    backgroundColor:
                      state.roundOutcome === 'correct'
                        ? theme.successSoft
                        : state.roundOutcome === 'timeout'
                          ? theme.warningSoft
                          : theme.dangerSoft,
                  },
                ]}
                testID={testId(GAME_ID, 'round-feedback')}>
                {state.roundOutcome !== 'correct' ? (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    testID={testId(GAME_ID, 'round-answer-reveal')}>
                    The answer was {state.round.correctWord}
                  </ThemedText>
                ) : null}
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID={testId(GAME_ID, 'round-why')}>
                  {`"${state.round.correctWord}" means the same as "${state.round.prompt}"`}
                </ThemedText>
              </View>
              <View style={styles.options}>
                {state.round.options.map((word, index) => (
                  <Option
                    key={index}
                    index={index}
                    label={word}
                    visual={visualFor(index)}
                    disabled
                    onPressOption={handleAnswer}
                  />
                ))}
              </View>
              <GameButton
                testID={testId(GAME_ID, 'next-round')}
                label={isLastRound ? 'See results' : 'Next round'}
                onPress={() => dispatch({ type: 'next-round', nowMs: clock.now() })}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {state.phase === 'results' ? (
        <GameResults
          reward={{
            xp: state.authoritativeXp ?? state.xp,
            coins: state.authoritativeCurrency ?? 0,
          }}
          gameId={GAME_ID}
          normalizedResult={state.normalized ?? undefined}
          persistState={state.persistState}
          lastError={state.lastError}
          forced={state.forced}
          onRestart={handleRestart}
          onQuit={quitToLibrary}>
          <View style={styles.resultsScore}>
            <ThemedText type="caption" themeColor="textSecondary">
              Final score
            </ThemedText>
            <AnimatedNumber
              value={state.stats.score}
              type="numeralLg"
              testID={testId(GAME_ID, 'score', 'animated')}
            />
          </View>
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
  options: {
    gap: Spacing.two,
  },
  // HUD-adjacent live score: caption + tabular numeral, never covering play.
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // Inline verdict panel (PATTERNS-PLAY 7): compact, below the verdict
  // headline and above the options — the prompt stem stays visible via the
  // why-line restatement, never covered.
  feedback: {
    gap: Spacing.one,
    borderRadius: Radii.medium,
    paddingVertical: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
  },
  // Results hero: the animated final score above the metric rows.
  resultsScore: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
