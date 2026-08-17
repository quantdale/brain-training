/**
 * CardSortScreen — the Flexibility game (rule-switching card sort).
 *
 * Renders a pure state machine (`flexibilityGameReducer`) and owns the side
 * effects: the rule-switch notice timer, response-time measurement against
 * the SDK monotonic clock, the SDK `SessionLifecycle` (start/pause/resume/
 * complete/abandon), auto-pause on backgrounding, the tutorial, the dev-only
 * QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the notice
 * timer; response time measured for the current round excludes paused time
 * (the round's start reference is shifted forward by the pause duration on
 * resume). The board is covered by the opaque `PauseOverlay` and hidden from
 * the accessibility tree while paused.
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
import { CardView } from './components/card';
import type { CardVisualState } from './components/card';
import { CardGrid } from './components/card-grid';
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { RuleBanner } from './components/rule-banner';
import { SwitchNotice } from './components/switch-notice';
import { Tutorial } from './components/tutorial';
import { flexibilityParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createFlexibilityQaForceStateHooks, createFlexibilityTutorialLifecycle } from './hooks';
import { flexibilityGameReducer } from './reducer';
import { normalizeFlexibilityResult } from './scoring';
import {
  buildFlexibilityRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistFlexibilitySession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialFlexibilityState } from './types';
import { SCORING_VERSION } from './versions';

export interface CardSortScreenProps {
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

export default function CardSortScreen(props: CardSortScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(flexibilityGameReducer, undefined, createInitialFlexibilityState);

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  /** Monotonic-clock time the current round became active (response origin). */
  const roundStartRef = useRef(0);
  /** Clock time a pause began inside the current round, or null. */
  const pauseStartRef = useRef<number | null>(null);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(
    () => createFlexibilityTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(() => createFlexibilityQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? flexibilityParamsFromProfile(state.profile) : null;
  const noticeMs = params?.noticeMs ?? 1600;
  const rounds = params?.rounds ?? 10;
  const speedTargetMs = params?.speedTargetMs ?? 5000;
  const speedPercent =
    state.stats.scoredPicks > 0
      ? Math.min(1, Math.max(0, 1 - state.stats.totalResponseMs / state.stats.scoredPicks / speedTargetMs))
      : 0;
  const inSession =
    state.phase === 'roundActive' ||
    state.phase === 'roundResult' ||
    state.phase === 'ruleSwitchNotice';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Response-time origin: reset whenever a new round becomes active.
  useEffect(() => {
    if (state.phase === 'roundActive') {
      roundStartRef.current = clock.now();
    }
  }, [state.phase, state.roundIndex, clock]);

  // ---- Rule-switch notice: one timer per notice; pause cancels it (timers
  // frozen), resume re-schedules from scratch.
  useEffect(() => {
    if (state.phase !== 'ruleSwitchNotice' || state.paused) {
      return;
    }
    const timer = setTimeout(() => dispatch({ type: 'notice-expired' }), noticeMs);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, noticeMs, dispatch]);

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
    const resolvedParams = flexibilityParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.switchEvery,
    );

    const raw = buildFlexibilityRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      finalSwitchEvery: state.switchEvery,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeFlexibilityResult(raw, context);
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
    void persistFlexibilitySession(record, persistSession).then((outcome) => {
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
    state.switchEvery,
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
      !(
        current.phase === 'roundActive' ||
        current.phase === 'roundResult' ||
        current.phase === 'ruleSwitchNotice'
      ) ||
      current.paused
    ) {
      return;
    }
    if (current.phase === 'roundActive') {
      pauseStartRef.current = clock.now();
    }
    lifecycleRef.current?.pause();
    dispatch({ type: 'pause' });
  }, [clock, dispatch]);

  const resumeSession = useCallback(() => {
    // Shift the round's response-time origin by the pause duration so the
    // player never gains or loses time on a round because of pausing.
    if (pauseStartRef.current !== null) {
      roundStartRef.current += clock.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    lifecycleRef.current?.resume();
    dispatch({ type: 'resume' });
  }, [clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle !== null && (lifecycle.status === 'active' || lifecycle.status === 'paused')) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

  const handlePick = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'roundActive' || current.paused || current.round === null) {
        return;
      }
      const responseMs = Math.max(0, clock.now() - roundStartRef.current);
      if (index === current.round.correctIndex) {
        noopAudioHaptics.playSfx('flexibility-card-correct');
        noopAudioHaptics.haptic('light');
      } else {
        noopAudioHaptics.playSfx('flexibility-card-wrong');
        noopAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'pick-card', index, responseMs });
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

  // ---- Round card visuals (see CardVisualState).
  const visualFor = (index: number): CardVisualState => {
    if (state.round === null) {
      return 'idle';
    }
    if (state.phase === 'roundResult') {
      if (index === state.round.correctIndex) {
        return 'selected';
      }
      if (state.roundOutcome === 'wrong' && index === state.lastPickIndex) {
        return 'error';
      }
    }
    return 'idle';
  };

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
              <QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />
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

            {state.phase === 'roundActive' && state.round !== null ? (
              <>
                <RuleBanner rule={state.round.rule} />
                <View style={styles.targetRow} testID={testId(GAME_ID, 'target')}>
                  <CardView
                    card={state.round.target}
                    testID={testId(GAME_ID, 'target-card')}
                    disabled
                  />
                </View>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'pick-status')}>
                  Pick the matching card
                </ThemedText>
                <CardGrid
                  candidates={state.round.candidates}
                  testID={testId(GAME_ID, 'card-grid')}
                  visualFor={visualFor}
                  onPressCard={handlePick}
                />
              </>
            ) : null}

            {state.phase === 'roundResult' && state.round !== null ? (
              <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
                <ThemedText
                  type="headline"
                  themeColor={state.roundOutcome === 'correct' ? 'success' : 'danger'}
                  testID={testId(GAME_ID, state.roundOutcome === 'correct' ? 'round-correct' : 'round-wrong')}>
                  {state.roundOutcome === 'correct' ? 'Correct!' : 'Not quite'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'round-explainer')}>
                  {state.roundOutcome === 'correct'
                    ? `Matched by ${state.round.rule}: ${describeCard(state.round.target)}`
                    : `The match was ${describeCard(
                        state.round.candidates[state.round.correctIndex],
                      )} — matched by ${state.round.rule}.`}
                </ThemedText>
                <CardGrid
                  candidates={state.round.candidates}
                  testID={testId(GAME_ID, 'round-result-grid')}
                  visualFor={visualFor}
                  disabled
                  onPressCard={handlePick}
                />
                <GameButton
                  testID={testId(GAME_ID, 'next-round')}
                  label={isLastRound ? 'See results' : 'Next round'}
                  onPress={() => dispatch({ type: 'next-round' })}
                />
              </View>
            ) : null}

            {state.phase === 'ruleSwitchNotice' ? (
              <SwitchNotice
                newRule={state.rule}
                onContinue={() => dispatch({ type: 'notice-continue' })}
              />
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
                (state.stats.roundsPlayed > 0
                  ? state.stats.correctPicks / state.stats.roundsPlayed
                  : 0) * 100,
              )}%`}
              testID={testId(GAME_ID, 'accuracy')}
            />
            <StatRow
              label="Speed"
              value={`${Math.round(speedPercent * 100)}%`}
              testID={testId(GAME_ID, 'speed')}
            />
            <StatRow
              label="After rule switches"
              value={`${Math.round(
                (state.stats.postSwitchPlayed > 0
                  ? state.stats.postSwitchCorrect / state.stats.postSwitchPlayed
                  : 0) * 100,
              )}%`}
              testID={testId(GAME_ID, 'switch-accuracy')}
            />
            <StatRow
              label="Best streak"
              value={String(state.stats.bestStreak)}
              testID={testId(GAME_ID, 'best-streak')}
            />
            <StatRow
              label="Mistakes"
              value={String(state.stats.mistakes)}
              testID={testId(GAME_ID, 'mistakes')}
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

/** Human-readable card description ("red circle"). */
function describeCard(card: { shape: string; color: string }): string {
  return `${card.color} ${card.shape}`;
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
  targetRow: {
    alignItems: 'center',
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
