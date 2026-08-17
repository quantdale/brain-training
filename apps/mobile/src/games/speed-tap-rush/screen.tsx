/**
 * TapRushScreen — the Tap Rush game (rapid serial response variant).
 *
 * Renders a pure state machine (`tapRushGameReducer`) and owns the side
 * effects: the per-target window-expiry timer (scheduled against the
 * monotonic `deadlineMs`), the SDK `SessionLifecycle` (start/pause/resume/
 * complete/abandon), auto-pause on backgrounding, the tutorial, the dev-only
 * QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer and cancels the expiry
 * timer; resuming re-schedules expiry with the exact remaining time
 * (`deadlineMs - clock.now()`). The field is covered by the opaque
 * `PauseOverlay` and hidden from the accessibility tree while paused.
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
import { Countdown } from './components/countdown';
import { PauseOverlay } from './components/pause-overlay';
import { Playfield } from './components/playfield';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { sessionChallengeRating, tapRushParamsFromProfile } from './difficulty';
import { gameDefinition } from './game-definition';
import { createTapRushQaForceStateHooks, createTapRushTutorialLifecycle } from './hooks';
import { tapRushGameReducer } from './reducer';
import { normalizeTapRushResult } from './scoring';
import {
  buildSessionRecord,
  buildTapRushRawResult,
  dbSessionPersister,
  persistTapRushSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialTapRushState } from './types';
import { SCORING_VERSION } from './versions';

export interface TapRushScreenProps {
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

export default function TapRushScreen(props: TapRushScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const theme = useTheme();
  const router = useRouter();
  const [state, dispatch] = useReducer(tapRushGameReducer, undefined, createInitialTapRushState);

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  /** Window time left when pausing; the resume action re-anchors from it. */
  const pauseRemainingRef = useRef(0);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(() => createTapRushTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createTapRushQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? tapRushParamsFromProfile(state.profile) : null;
  const count = params?.count ?? 10;
  const rounds = params?.rounds ?? 4;
  const radius = params?.targetRadius ?? 0.075;
  const inSession = state.phase === 'active' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // ---- Window expiry: one timer per live target, scheduled from the
  // monotonic deadline. Pause cancels the timer; resume re-schedules with the
  // remaining time (deadline - now), so pausing never buys extra time.
  useEffect(() => {
    if (state.phase !== 'active' || state.paused || state.deadlineMs === null) {
      return;
    }
    const remaining = state.deadlineMs - clock.now();
    if (remaining <= 0) {
      // The deadline already passed (e.g. resume after a long background
      // pause): resolve immediately instead of waiting.
      dispatch({ type: 'target-expired', nowMs: clock.now() });
      return;
    }
    const timer = setTimeout(() => {
      dispatch({ type: 'target-expired', nowMs: clock.now() });
    }, remaining);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, state.deadlineMs, state.targetIndex, clock, dispatch]);

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
    const resolvedParams = tapRushParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.windowMs);

    const raw = buildTapRushRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      finalWindowMs: state.windowMs,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeTapRushResult(raw, context);
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
    void persistTapRushSession(record, persistSession).then((outcome) => {
      dispatch(
        outcome.ok
          ? { type: 'persistence-succeeded' }
          : { type: 'persistence-failed', message: String(outcome.error) },
      );
    });
  }, [
    state.phase,
    state.profile,
    state.sessionId,
    state.startedAtMs,
    state.seed,
    state.stats,
    state.forced,
    state.windowMs,
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
        spawnedAtMs: clock.now(),
      });
    },
    [clock, dispatch],
  );

  const pauseSession = useCallback(() => {
    const current = stateRef.current;
    if (
      !(current.phase === 'active' || current.phase === 'roundResult') ||
      current.paused
    ) {
      return;
    }
    // Freeze the live target's window: the remaining time is what resume
    // re-anchors the deadline from, so pausing never buys or loses time.
    pauseRemainingRef.current =
      current.deadlineMs !== null
        ? Math.max(0, current.deadlineMs - clock.now())
        : 0;
    lifecycleRef.current?.pause();
    dispatch({ type: 'pause' });
  }, [clock, dispatch]);

  const resumeSession = useCallback(() => {
    lifecycleRef.current?.resume();
    dispatch({
      type: 'resume',
      nowMs: clock.now(),
      remainingMs: pauseRemainingRef.current,
    });
  }, [clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle !== null && (lifecycle.status === 'active' || lifecycle.status === 'paused')) {
      lifecycle.abandon();
    }
    router.back();
  }, [router]);

  const handleFieldTap = useCallback(
    (x: number, y: number) => {
      const current = stateRef.current;
      if (current.phase !== 'active' || current.paused) {
        return;
      }
      if (current.deadlineMs !== null && clock.now() > current.deadlineMs) {
        return; // window already closed; the expiry timer owns the resolution
      }
      dispatch({ type: 'tap', x, y, nowMs: clock.now() });
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

  const liveTarget = state.phase === 'active' ? state.targets[state.targetIndex] ?? null : null;

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

            {state.phase === 'active' ? (
              <>
                <View style={styles.statusRow}>
                  <ThemedText
                    type="bodyLarge"
                    themeColor="text"
                    testID={testId(GAME_ID, 'active-status')}>
                    Tap the target!
                  </ThemedText>
                  <ThemedText
                    type="smallBold"
                    themeColor={state.stats.streak > 0 ? 'accent' : 'textSecondary'}
                    testID={testId(GAME_ID, 'streak')}>
                    Streak {state.stats.streak}
                  </ThemedText>
                </View>
                <Countdown
                  deadlineMs={state.deadlineMs ?? clock.now()}
                  windowMs={state.windowMs}
                  clock={clock}
                  testID={testId(GAME_ID, 'countdown')}
                />
                <Playfield
                  target={liveTarget}
                  radius={radius}
                  targetTestID={testId(GAME_ID, 'target', String(state.targetIndex))}
                  testID={testId(GAME_ID, 'field')}
                  onTap={handleFieldTap}
                />
              </>
            ) : null}

            {state.phase === 'roundResult' ? (
              <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
                <ThemedText
                  type="headline"
                  themeColor={state.roundOutcome === 'passed' ? 'success' : 'danger'}
                  testID={testId(GAME_ID, state.roundOutcome === 'passed' ? 'round-passed' : 'round-failed')}>
                  {state.roundOutcome === 'passed' ? 'Round passed!' : 'Round failed'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {state.roundHits} hit · {state.roundMisses} missed · {state.roundWrongs} wrong
                </ThemedText>
                {state.roundOutcome === 'passed' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Perfect round — the next window shrinks to {state.windowMs} ms.
                  </ThemedText>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    The window holds at {state.windowMs} ms.
                  </ThemedText>
                )}
                <GameButton
                  testID={testId(GAME_ID, 'next-round')}
                  label={isLastRound ? 'See results' : 'Next round'}
                  onPress={() => dispatch({ type: 'next-round', spawnedAtMs: clock.now() })}
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
                (state.stats.targetsHit + state.stats.targetsMissed > 0
                  ? state.stats.targetsHit / (state.stats.targetsHit + state.stats.targetsMissed)
                  : 0) * 100,
              )}%`}
              testID={testId(GAME_ID, 'accuracy')}
            />
            <StatRow
              label="Targets hit"
              value={`${state.stats.targetsHit}/${state.stats.targetsHit + state.stats.targetsMissed}`}
              testID={testId(GAME_ID, 'targets-hit')}
            />
            <StatRow
              label="Best streak"
              value={String(state.stats.bestStreak)}
              testID={testId(GAME_ID, 'best-streak')}
            />
            <StatRow
              label="Perfect rounds"
              value={`${state.stats.perfectRounds}/${state.stats.roundsPlayed}`}
              testID={testId(GAME_ID, 'perfect-rounds')}
            />
            <StatRow
              label="Best reaction"
              value={
                state.stats.reactions.length > 0
                  ? `${Math.round(Math.min(...state.stats.reactions))} ms`
                  : '—'
              }
              testID={testId(GAME_ID, 'best-reaction')}
            />
            <StatRow label="XP" value={String(state.xp)} testID={testId(GAME_ID, 'xp')} />

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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
