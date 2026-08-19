/**
 * SpeedColorMatchScreen — the Speed Color Match game.
 *
 * Renders a pure state machine (`speedColorMatchReducer`) and owns the side
 * effects: stimulus timeout timers, the SDK `SessionLifecycle` (start/pause/
 * resume/complete/abandon), auto-pause on backgrounding, the tutorial, the
 * dev-only QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
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

import { ColorButtonGrid } from './components/color-button';
import { GameButton } from './components/button';
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { ColorSwatch } from './components/swatch';
import { Tutorial } from './components/tutorial';
import {
  speedColorMatchParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createSpeedColorMatchQaForceStateHooks,
  createSpeedColorMatchTutorialLifecycle,
} from './hooks';
import { speedColorMatchReducer } from './reducer';
import { normalizeSpeedColorMatchResult } from './scoring';
import {
  buildSpeedColorMatchRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSpeedColorMatchSession,
} from './session';
import type { SessionPersistence } from './session';
import { COLOR_PALETTE, GAME_ID, createInitialSpeedColorMatchState } from './types';
import type { ColorName } from './types';
import { SCORING_VERSION } from './versions';

export interface SpeedColorMatchScreenProps {
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

export default function SpeedColorMatchScreen(props: SpeedColorMatchScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(speedColorMatchReducer, undefined, createInitialSpeedColorMatchState);

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);

  // Keep a ref of the latest state for event handlers.
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(() => createSpeedColorMatchTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createSpeedColorMatchQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? speedColorMatchParamsFromProfile(state.profile) : null;
  const stimulusTimeoutMs = params?.stimulusTimeoutMs ?? 4_000;
  const totalTrials = params?.trials ?? 20;
  const inSession = state.phase === 'trial' || state.phase === 'roundResult';
  const isLastTrial = state.trialIndex + 1 >= totalTrials;

  // ---- Auto-show trial when entering trial phase.
  useEffect(() => {
    if (state.phase === 'trial' && state.trialShownAtMs === null && !state.paused) {
      dispatch({ type: 'trial-shown', shownAtMs: Date.now() });
    }
  }, [state.phase, state.trialShownAtMs, state.paused]);

  // ---- Stimulus timeout: auto-fail trial on expiry.
  useEffect(() => {
    if (state.phase !== 'trial' || state.paused || state.trialShownAtMs === null) {
      return;
    }
    const remaining = stimulusTimeoutMs - (Date.now() - state.trialShownAtMs);
    if (remaining <= 0) {
      dispatch({ type: 'trial-timeout', timedOutAtMs: Date.now() });
      return;
    }
    const timer = setTimeout(() => {
      dispatch({ type: 'trial-timeout', timedOutAtMs: Date.now() });
    }, remaining);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, state.trialShownAtMs, stimulusTimeoutMs, state.trialIndex]);

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
    const resolvedParams = speedColorMatchParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      resolvedParams.incongruentRatio,
    );

    const raw = buildSpeedColorMatchRawResult({
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
    const normalized = normalizeSpeedColorMatchResult(raw, context);
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
    void persistSpeedColorMatchSession(record, persistSession).then((outcome) => {
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
    if (!(current.phase === 'trial' || current.phase === 'roundResult') || current.paused) {
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

  const handleTapColor = useCallback(
    (color: ColorName) => {
      const current = stateRef.current;
      if (current.phase !== 'trial' || current.paused || current.trialShownAtMs === null) {
        return;
      }
      const trial = current.trials[current.trialIndex];
      if (!trial) return;

      if (color === trial.swatchColor) {
        noopAudioHaptics.playSfx('memory-tile-correct');
        noopAudioHaptics.haptic('light');
      } else {
        noopAudioHaptics.playSfx('memory-tile-wrong');
        noopAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'tap-color', color, tappedAtMs: Date.now() });
    },
    [dispatch],
  );

  const handleTimerExpire = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'trial' || current.paused) return;
    dispatch({ type: 'trial-timeout', timedOutAtMs: Date.now() });
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

  const currentTrial = state.trials[state.trialIndex] ?? null;

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

        {inSession ? (
          <View style={styles.section}>
            <SessionHeader>
              <ThemedText type="subtitle" testID={testId(GAME_ID, 'trial', String(state.trialIndex + 1))}>
                Trial {state.trialIndex + 1}/{totalTrials}
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

            {state.phase === 'trial' && currentTrial ? (
              <>
                <ColorSwatch
                  swatchColor={currentTrial.swatchColor}
                  labelColor={currentTrial.labelColor}
                  testID={testId(GAME_ID, 'current-swatch')}
                />
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'trial-status')}>
                  Tap the matching color!
                </ThemedText>
                <ColorButtonGrid
                  colors={COLOR_PALETTE}
                  onPress={handleTapColor}
                  disabled={state.paused}
                />
              </>
            ) : null}

            {state.phase === 'roundResult' ? (
              <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
                <ThemedText
                  type="headline"
                  themeColor={state.currentTrialOutcome === 'correct' ? 'success' : 'danger'}
                  testID={testId(GAME_ID, state.currentTrialOutcome === 'correct' ? 'trial-correct' : 'trial-wrong')}>
                  {state.currentTrialOutcome === 'correct' ? 'Correct!' : 'Wrong!'}
                </ThemedText>
                {state.currentReactionMs !== null ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {Math.round(state.currentReactionMs)}ms
                  </ThemedText>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    Timed out
                  </ThemedText>
                )}
                <GameButton
                  testID={testId(GAME_ID, 'next-trial')}
                  label={isLastTrial ? 'See results' : 'Next trial'}
                  onPress={() => dispatch({ type: 'next-trial' })}
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
                (state.stats.trialsPlayed > 0 ? state.stats.trialsCorrect / state.stats.trialsPlayed : 0) * 100,
              )}%`}
              testID={testId(GAME_ID, 'accuracy')}
            />
            <StatRow
              label="Trials correct"
              value={`${state.stats.trialsCorrect}/${state.stats.trialsPlayed}`}
              testID={testId(GAME_ID, 'trials-correct')}
            />
            <StatRow
              label="Best streak"
              value={String(state.stats.bestStreak)}
              testID={testId(GAME_ID, 'best-streak')}
            />
            <StatRow
              label="Avg reaction"
              value={
                state.stats.avgReactionMs > 0 && state.stats.avgReactionMs < Infinity
                  ? `${Math.round(state.stats.avgReactionMs)}ms`
                  : 'N/A'
              }
              testID={testId(GAME_ID, 'avg-reaction')}
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
});
