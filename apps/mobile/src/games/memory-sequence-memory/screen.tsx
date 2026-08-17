/**
 * SequenceMemoryScreen — the Sequence Memory game (Simon-style score attack).
 *
 * Renders a pure state machine (`sequenceMemoryGameReducer`) and owns the
 * side effects: reveal pacing timers, the score-attack countdown (a 250ms
 * ticker dispatches `time-up` when the monotonic time budget expires), the
 * SDK `SessionLifecycle` (start/pause/resume/complete/abandon), auto-pause on
 * backgrounding, the tutorial, the dev-only QA panel, and result persistence.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer (so the score-attack
 * budget stops too) and cancels reveal pacing; resuming re-flashes the
 * current tile and continues from the same position. The board is covered by
 * the opaque `PauseOverlay` and hidden from the accessibility tree while
 * paused.
 *
 * Countdown semantics: the budget runs during every in-session phase
 * (reveal/input/round-result) and freezes while paused; a round still being
 * performed when time expires counts as failed.
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
import { SequencePad } from './components/pad';
import type { PadTileVisualState } from './components/tile';
import { PauseOverlay } from './components/pause-overlay';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import { sequenceMemoryParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import {
  createSequenceMemoryQaForceStateHooks,
  createSequenceMemoryTutorialLifecycle,
} from './hooks';
import { sequenceMemoryGameReducer } from './reducer';
import { normalizeSequenceMemoryResult } from './scoring';
import {
  buildSequenceMemoryRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistSequenceMemorySession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialSequenceMemoryState } from './types';
import { SCORING_VERSION } from './versions';

/** Countdown ticker period in ms (drives the remaining-time display). */
const COUNTDOWN_TICK_MS = 250;

export interface SequenceMemoryScreenProps {
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

/** Remaining budget as a "m:ss" label (ceil so the countdown hits 0 only at the end). */
function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function SequenceMemoryScreen(props: SequenceMemoryScreenProps = {}) {
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
    sequenceMemoryGameReducer,
    undefined,
    createInitialSequenceMemoryState,
  );
  // Re-render tick for the countdown display (no state payload needed).
  const [, tick] = useReducer((value: number) => value + 1, 0);

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  /**
   * Monotonic elapsed time at the moment the budget expired (set by the
   * countdown interval right before dispatching `time-up`). Finalization
   * prefers this over `lifecycle.elapsedMs()` because state updates are
   * batched: in tests the clock may have advanced past the expiry moment by
   * the time the results effect runs, and recording at detection is also the
   * more truthful "active play time" for a time-bounded session.
   */
  const timeUpElapsedMsRef = useRef<number | null>(null);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
  });

  const tutorial = useMemo(
    () => createSequenceMemoryTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(() => createSequenceMemoryQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? sequenceMemoryParamsFromProfile(state.profile) : null;
  const revealMs = params?.revealMs ?? 900;
  const tileCount = params?.tileCount ?? 4;
  const budgetMs = (params?.sessionSeconds ?? 90) * 1000;
  const inSession =
    state.phase === 'reveal' || state.phase === 'input' || state.phase === 'roundResult';

  // ---- Reveal pacing: one tick per revealMs; pause cancels (timers frozen),
  // resume re-schedules from the current tile.
  useEffect(() => {
    if (state.phase !== 'reveal' || state.paused) {
      return;
    }
    const timer = setTimeout(() => dispatch({ type: 'reveal-tick' }), revealMs);
    return () => clearTimeout(timer);
  }, [state.phase, state.paused, state.revealedIndex, revealMs, dispatch]);

  // ---- Score-attack countdown: while in session and unpaused, check the
  // monotonic budget every 250ms; expire the session when it is exhausted and
  // re-render the remaining-time label otherwise. Pausing clears the interval
  // and freezes the lifecycle timer, so the budget never drains while paused.
  useEffect(() => {
    if (!inSession || state.paused) {
      return;
    }
    const interval = setInterval(() => {
      const elapsedMs = lifecycleRef.current?.elapsedMs() ?? 0;
      if (elapsedMs >= budgetMs) {
        // Record the exact expiry instant once, then stop the ticker; the
        // self-clear keeps batched timer runs (tests) from re-dispatching.
        if (timeUpElapsedMsRef.current === null) {
          timeUpElapsedMsRef.current = elapsedMs;
        }
        clearInterval(interval);
        dispatch({ type: 'time-up' });
      } else {
        tick();
      }
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(interval);
  }, [inSession, state.paused, budgetMs, dispatch]);

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
    const activeDurationMs =
      timeUpElapsedMsRef.current ?? (lifecycle?.elapsedMs() ?? 0);
    const pausedDurationMs = lifecycle?.pausedDurationMs() ?? 0;
    const completedAtMs = Date.now();
    const difficulty = state.difficulty ?? 'normal';
    const resolvedParams = sequenceMemoryParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.length);

    const raw = buildSequenceMemoryRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      timeUp: state.timeUp,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeSequenceMemoryResult(raw, context);
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
    void persistSequenceMemorySession(record, persistSession).then((outcome) => {
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
    state.timeUp,
    state.length,
    state.difficulty,
    xpHook,
    persistSession,
  ]);

  // ---- Session controls.
  const startSession = useCallback(
    (level: DifficultyLevel, seed: string) => {
      finalizedRef.current = false;
      timeUpElapsedMsRef.current = null;
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
      !(current.phase === 'reveal' || current.phase === 'input' || current.phase === 'roundResult') ||
      current.paused
    ) {
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

  const handleTapTile = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'input' || current.paused) {
        return;
      }
      if (index === current.sequence[current.inputIndex]) {
        noopAudioHaptics.playSfx('memory-sequence-memory-tile-correct');
        noopAudioHaptics.haptic('light');
      } else {
        noopAudioHaptics.playSfx('memory-sequence-memory-tile-wrong');
        noopAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'tap-tile', index });
    },
    [dispatch],
  );

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    const level = current.difficulty ?? 'normal';
    const seed =
      current.seedOverride ?? (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
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

  // ---- Pad visuals (see PadTileVisualState).
  const visualFor = (index: number): PadTileVisualState => {
    if (state.phase === 'reveal') {
      return index === state.revealedIndex ? 'revealed' : 'idle';
    }
    if (state.phase === 'input' || state.phase === 'roundResult') {
      if (state.sequence.slice(0, state.inputIndex).includes(index)) {
        return 'selected';
      }
      if (state.roundOutcome === 'failed' && state.taps[state.taps.length - 1] === index) {
        return 'error';
      }
    }
    return 'idle';
  };

  // Remaining budget label; 0 before the lifecycle starts (intro).
  const remainingMs =
    inSession && lifecycleRef.current !== null
      ? Math.max(0, budgetMs - lifecycleRef.current.elapsedMs())
      : budgetMs;

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
                    onPress={() =>
                      dispatch({ type: 'select-difficulty', level: level as DifficultyLevel })
                    }
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
                onForcePerfect={qaHooks.forcePerfect}
              />
            ) : null}
          </View>
        ) : null}

        {inSession ? (
          <View style={styles.section}>
            <View style={styles.sessionHeader}>
              <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
                Sequence {state.roundIndex + 1}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                testID={testId(GAME_ID, 'countdown')}>
                {formatRemaining(remainingMs)}
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

            {state.phase === 'reveal' ? (
              <>
                <ThemedText
                  type="bodyLarge"
                  themeColor="text"
                  testID={testId(GAME_ID, 'reveal-status')}>
                  Watch the sequence…
                </ThemedText>
                <SequencePad
                  tileCount={tileCount}
                  testID={testId(GAME_ID, 'reveal-pad')}
                  visualFor={visualFor}
                  disabled
                  onPressTile={handleTapTile}
                />
              </>
            ) : null}

            {state.phase === 'input' ? (
              <>
                <View style={styles.statusRow}>
                  <ThemedText
                    type="bodyLarge"
                    themeColor="text"
                    testID={testId(GAME_ID, 'input-status')}>
                    Now repeat it
                  </ThemedText>
                  <View
                    style={styles.dots}
                    testID={testId(GAME_ID, 'progress')}
                    accessibilityLabel={`${state.inputIndex} of ${state.length} matched`}>
                    {Array.from({ length: state.length }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          { backgroundColor: i < state.inputIndex ? theme.accent : theme.border },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <SequencePad
                  tileCount={tileCount}
                  testID={testId(GAME_ID, 'input-pad')}
                  visualFor={visualFor}
                  onPressTile={handleTapTile}
                />
              </>
            ) : null}

            {state.phase === 'roundResult' ? (
              <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
                <ThemedText
                  type="headline"
                  themeColor={state.roundOutcome === 'passed' ? 'success' : 'danger'}
                  testID={testId(
                    GAME_ID,
                    state.roundOutcome === 'passed' ? 'round-passed' : 'round-failed',
                  )}>
                  {state.roundOutcome === 'passed' ? 'Sequence complete!' : 'Wrong tap'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Sequence length {state.length}
                  {state.roundOutcome === 'failed'
                    ? ` — expected ${state.sequence.map((tile) => tile + 1).join(' · ')}`
                    : ''}
                </ThemedText>
                <SequencePad
                  tileCount={tileCount}
                  testID={testId(GAME_ID, 'round-result-pad')}
                  visualFor={visualFor}
                  disabled
                  onPressTile={handleTapTile}
                />
                <GameButton
                  testID={testId(GAME_ID, 'next-round')}
                  label="Next sequence"
                  onPress={() => dispatch({ type: 'next-round' })}
                />
              </View>
            ) : null}

            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForcePerfect={qaHooks.forcePerfect}
              />
            ) : null}
          </View>
        ) : null}

        {state.phase === 'results' ? (
          <View style={styles.section} testID={testId(GAME_ID, 'results')}>
            <ThemedText type="title">{state.timeUp ? "Time's up!" : 'Session complete'}</ThemedText>
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
              label="Sequences passed"
              value={`${state.stats.roundsPassed}/${state.stats.roundsPlayed}`}
              testID={testId(GAME_ID, 'rounds-passed')}
            />
            <StatRow
              label="Best streak"
              value={String(state.stats.bestStreak)}
              testID={testId(GAME_ID, 'best-streak')}
            />
            <StatRow
              label="Longest sequence"
              value={String(state.stats.longestSequence)}
              testID={testId(GAME_ID, 'longest-sequence')}
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
              <GameButton
                testID={testId(GAME_ID, 'restart')}
                label="Play again"
                onPress={handleRestart}
              />
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
  dots: {
    flexDirection: 'row',
    gap: Spacing.oneHalf,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
