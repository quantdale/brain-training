/**
 * LanguageWordMatchScreen — the Word Match game.
 *
 * Renders a pure state machine (`languageGameReducer`) and owns the side
 * effects: the per-round expiry timer, the SDK `SessionLifecycle` (start/
 * pause/resume/complete/abandon), auto-pause on backgrounding, the tutorial,
 * the dev-only QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Timing: all gameplay timing comes from the injectable SDK monotonic clock
 * (never `Date.now()`). The round deadline lives in the reducer; the screen
 * schedules one timeout per active round segment (paused segments clear it,
 * resumes re-schedule from the frozen remaining budget).
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  DIFFICULTY_LABELS,
  SessionLifecycle,
  isDevBuild,
  noopAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, DifficultyLevel, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GameButton } from './components/button';
import { Option } from './components/option';
import type { OptionVisualState } from './components/option';
import { PauseOverlay } from './components/pause-overlay';
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

export default function LanguageWordMatchScreen(props: LanguageWordMatchScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(languageGameReducer, undefined, createInitialLanguageState);

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(() => createLanguageTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createLanguageQaForceStateHooks(dispatch), [dispatch]);

  const params = state.params;
  const rounds = params?.rounds ?? 6;
  const budgetSeconds = Math.max(1, Math.round(state.roundBudgetMs / 1000));
  const inSession = state.phase === 'question' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Round expiry: one timeout per active round segment; pause cancels
  // (timers frozen), resume re-schedules from the frozen remaining budget.
  useEffect(() => {
    if (state.phase !== 'question' || state.paused || state.roundDeadlineMs === null) {
      return;
    }
    const remaining = Math.max(0, state.roundDeadlineMs - clock.now());
    const timer = setTimeout(() => {
      dispatch({ type: 'expire-round', nowMs: clock.now() });
    }, remaining);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, state.roundDeadlineMs, clock, dispatch]);

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
      state.params === null ||
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
    void persistLanguageSession(record, persistSession).then((outcome) => {
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
        nowMs: clock.now(),
      });
    },
    [clock, dispatch],
  );

  const pauseSession = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'question' || current.paused) {
      return;
    }
    lifecycleRef.current?.pause();
    dispatch({ type: 'pause', nowMs: clock.now() });
  }, [clock, dispatch]);

  const resumeSession = useCallback(() => {
    lifecycleRef.current?.resume();
    dispatch({ type: 'resume', nowMs: clock.now() });
  }, [clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle !== null && (lifecycle.status === 'active' || lifecycle.status === 'paused')) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

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
        noopAudioHaptics.playSfx('language-word-match-correct');
        noopAudioHaptics.haptic('success');
      } else {
        noopAudioHaptics.playSfx('language-word-match-wrong');
        noopAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'answer-option', index, nowMs });
    },
    [clock, dispatch],
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

  // ---- Option visuals (see OptionVisualState).
  const visualFor = (index: number): OptionVisualState => {
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
  };

  const roundResultMessage =
    state.roundOutcome === 'correct'
      ? 'Correct!'
      : state.roundOutcome === 'timeout'
        ? 'Time’s up'
        : 'Not quite';

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
            <View style={styles.difficultyRow}>
              {Object.entries(DIFFICULTY_LABELS).map(([level, label]) => {
                const selected = state.difficulty === level;
                return (
                  <GameButton
                    key={level}
                    small
                    testID={testId(GAME_ID, 'difficulty', level)}
                    label={label}
                    variant={selected ? 'primary' : 'secondary'}
                    onPress={() => dispatch({ type: 'select-difficulty', level: level as DifficultyLevel })}
                  />
                );
              })}
            </View>

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
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={qaHooks.forceTimeout}
              />
            ) : null}
          </View>
        ) : null}

        {inSession ? (
          <View style={styles.section}>
            <View style={styles.sessionHeader}>
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
            </View>

            {state.phase === 'question' && state.round !== null ? (
              <View style={styles.section}>
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
                      onPress={() => handleAnswer(index)}
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
                {state.roundOutcome !== 'correct' ? (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    testID={testId(GAME_ID, 'round-answer-reveal')}>
                    The answer was {state.round.correctWord}
                  </ThemedText>
                ) : null}
                <View style={styles.options}>
                  {state.round.options.map((word, index) => (
                    <Option
                      key={index}
                      index={index}
                      label={word}
                      visual={visualFor(index)}
                      disabled
                      onPress={() => handleAnswer(index)}
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

            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={qaHooks.forceTimeout}
              />
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

      {state.paused && state.phase === 'question' ? (
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

/** One label/value row on the results screen. */
function StatRow({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID: string;
}) {
  return (
    <View style={styles.statRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="bodyLarge" testID={testID}>
        {value}
      </ThemedText>
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
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  options: {
    gap: Spacing.two,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
  },
});
