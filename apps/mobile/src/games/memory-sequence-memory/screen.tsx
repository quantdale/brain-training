/**
 * SequenceMemoryScreen — the Sequence Memory game (Simon-style score attack).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Sequence-Memory-specific — the reducer wiring, the reveal
 * pacing timers, the score-attack countdown, the scoring/persistence
 * pipeline, and the pad view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer (so the score-attack
 * budget stops too) and cancels reveal pacing; resuming re-flashes the
 * current tile and continues from the same position. The board is covered by
 * the opaque shared `PauseOverlay` and hidden from the accessibility tree
 * while paused.
 *
 * Countdown semantics: the budget runs during every in-session phase
 * (reveal/input/round-result) and freezes while paused; a round still being
 * performed when time expires counts as failed.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
  useGameInterval,
  useGameSession,
} from '@/components/game-host';

import { SequencePad } from './components/pad';
import type { PadTileVisualState } from './components/tile';
import { QaPanel } from './components/qa-panel';
import { Tutorial } from './components/tutorial';
import {
  resolveSequenceMemoryDifficulty,
  sequenceMemoryParamsFromProfile,
  sessionChallengeRating,
} from './difficulty';
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

  const stateRef = useRef(state);
  /**
   * Monotonic elapsed time at the moment the budget expired (set by the
   * countdown interval right before dispatching `time-up`). Finalization
   * prefers this over `session.elapsedMs()` because state updates are
   * batched: in tests the clock may have advanced past the expiry moment by
   * the time the results effect runs, and recording at detection is also the
   * more truthful "active play time" for a time-bounded session.
   */
  const timeUpElapsedMsRef = useRef<number | null>(null);

  // Keep a ref of the latest state for event handlers (timers, guards).
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

  const tutorial = useMemo(
    () => createSequenceMemoryTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(() => createSequenceMemoryQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? sequenceMemoryParamsFromProfile(state.profile) : null;
  const revealMs = params?.revealMs ?? 900;
  const tileCount = params?.tileCount ?? 4;
  const budgetMs = (params?.sessionSeconds ?? 90) * 1000;
  // Countdown label is state-driven (not a direct ref read during render) so
  // the screen stays rule-clean under concurrent rendering; the countdown
  // interval below keeps it in lockstep with `session.elapsedMs()`.
  // Reset on (re)start so a changed budget is reflected before the first tick.
  const [displayRemainingMs, setDisplayRemainingMs] = useState(budgetMs);
  const inSession =
    state.phase === 'reveal' || state.phase === 'input' || state.phase === 'roundResult';

  // ---- Reveal pacing: one tick per tile. The deadline preserves the current
  // tile's remaining flash time across pause/resume.
  useGameDeadlineTimeout(
    state.phase === 'reveal' && !state.paused,
    () => dispatch({ type: 'reveal-tick' }),
    revealMs,
    clock,
    `reveal:${state.sessionId ?? 'idle'}:${state.roundIndex}:${state.revealedIndex}`,
  );

  // ---- Score-attack countdown: while in session and unpaused, check the
  // monotonic budget every 250ms; expire the session when it is exhausted and
  // re-render the remaining-time label otherwise. Pausing deactivates the
  // interval and freezes the lifecycle timer, so the budget never drains
  // while paused. Duplicate expiry ticks between the dispatch and the next
  // render are inert: the reducer ignores `time-up` outside in-session
  // phases and the ref below records the first expiry instant only.
  useGameInterval(
    inSession && !state.paused,
    () => {
      const elapsedMs = session.elapsedMs();
      if (elapsedMs >= budgetMs) {
        setDisplayRemainingMs(0);
        if (timeUpElapsedMsRef.current === null) {
          timeUpElapsedMsRef.current = elapsedMs;
        }
        dispatch({ type: 'time-up' });
      } else {
        setDisplayRemainingMs(Math.max(0, budgetMs - elapsedMs));
        tick();
      }
    },
    COUNTDOWN_TICK_MS,
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
    const activeDurationMs =
      timeUpElapsedMsRef.current ?? session.elapsedMs();
    const pausedDurationMs = session.pausedDurationMs();
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
    state.timeUp,
    state.length,
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

  const handleTapTile = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'input' || current.paused) {
        return;
      }
      if (index === current.sequence[current.inputIndex]) {
        liveAudioHaptics.playSfx('memory-sequence-memory-tile-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('memory-sequence-memory-tile-wrong');
        liveAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'tap-tile', index });
    },
    [dispatch],
  );

  const handleStart = useCallback(() => {
    const current = stateRef.current;
    const level = current.difficulty ?? 'normal';
    const seed = current.seedOverride ?? resolveSessionSeed(sessionSeed);
    timeUpElapsedMsRef.current = null;
    const identity = session.begin();
    // Reset the countdown label before the first ticker tick so a restarted
    // session (e.g. "Play again") starts from the full budget, not the
    // previous run's leftover value. Derived from `level` (not the captured
    // `budgetMs` closure) so it matches exactly what the render computes for
    // the selected difficulty and is immune to memoization/batching timing.
    const startBudgetMs =
      (sequenceMemoryParamsFromProfile(resolveSequenceMemoryDifficulty(level))?.sessionSeconds ??
        90) * 1000;
    setDisplayRemainingMs(startBudgetMs);
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

  // ---- Pad visuals (see PadTileVisualState). Stable across the per-tick
  // countdown re-renders: depends only on round-transition state, never on
  // the display-remaining tick, so the memoized pad skips re-rendering tiles
  // whose visual is unchanged.
  const visualFor = useCallback(
    (index: number): PadTileVisualState => {
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
    },
    [
      state.phase,
      state.revealedIndex,
      state.sequence,
      state.inputIndex,
      state.roundOutcome,
      state.taps,
    ],
  );

  // Remaining budget label; driven by `displayRemainingMs` (state) so the ref
  // is not read during render. Equals `budgetMs` before the lifecycle starts.
  const remainingMs = displayRemainingMs;

  return (
    <GameHost
      gameId={GAME_ID}
      view={
        state.phase === 'intro' ? 'intro' : state.phase === 'results' ? 'results' : 'session'
      }
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
        <>
          <ThemedText
            type="subtitle"
            testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
            Sequence {state.roundIndex + 1}
          </ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID={testId(GAME_ID, 'countdown')}>
            {formatRemaining(remainingMs)}
          </ThemedText>
        </>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
          onForcePerfect={qaHooks.forcePerfect}
        />
      }
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
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
        </>
      ) : null}

      {state.phase === 'results' ? (
        <GameResults
          gameId={GAME_ID}
          title={state.timeUp ? "Time's up!" : 'Session complete'}
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
        </GameResults>
      ) : null}
    </GameHost>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
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
});
