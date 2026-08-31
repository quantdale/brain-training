/**
 * LogicScreen — the Next in Sequence game (Logic & Problem Solving).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Next-in-Sequence-specific — the reducer wiring, per-round
 * response-time measurement, the scoring/persistence pipeline, and the
 * puzzle view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer, so a round's
 * response time — measured as lifecycle elapsed time at answer minus the
 * elapsed time when the round began — never includes paused time. The puzzle
 * is covered by the opaque shared PauseOverlay and hidden from the
 * accessibility tree while paused.
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

import { OptionList } from './components/option';
import type { OptionVisualState } from './components/option';
import { QaPanel } from './components/qa-panel';
import { SequenceChips } from './components/sequence';
import { Tutorial } from './components/tutorial';
import { logicParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { describePattern } from './generator';
import { createLogicQaForceStateHooks, createLogicTutorialLifecycle } from './hooks';
import { logicGameReducer } from './reducer';
import { normalizeLogicResult } from './scoring';
import {
  buildLogicRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistLogicSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialLogicState } from './types';
import { SCORING_VERSION } from './versions';

export interface LogicScreenProps {
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

export default function LogicScreen(props: LogicScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(logicGameReducer, undefined, createInitialLogicState);

  const stateRef = useRef(state);
  /** Lifecycle elapsed time (ms) when the current question round began. */
  const roundStartElapsedRef = useRef(0);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'question' || current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createLogicTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createLogicQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? logicParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 5;
  const inSession = state.phase === 'question' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  // Capture the round's start time (lifecycle elapsed) whenever a question
  // round begins. Pausing does not move the lifecycle elapsed time, so
  // response = elapsed(at answer) - elapsed(at round start) excludes pauses.
  // Keyed on the phase only (as before the GameHost migration):
  // - `session` is a per-render object; adding it would re-run on every render
  //   and reset the baseline mid-round. Its `elapsedMs` is a stable callback,
  //   so the captured reference stays valid.
  // - `state.paused` must NOT re-arm the baseline: on resume the lifecycle
  //   clock continues where it froze, so the delta still covers pre-pause
  //   thinking time while excluding the paused span itself.
  useEffect(() => {
    if (state.phase === 'question' && !state.paused) {
      roundStartElapsedRef.current = session.elapsedMs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

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
      state.profile === null ||
      state.sessionId === null ||
      state.startedAtMs === null ||
      !session.claimFinalize()
    ) {
      return;
    }

    session.completeIfActive();
    const activeDurationMs = session.elapsedMs();
    const pausedDurationMs = session.pausedDurationMs();
    const completedAtMs = Date.now();
    const difficulty = state.difficulty ?? 'normal';
    const resolvedParams = logicParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(difficulty, state.profile, state.tier);

    const raw = buildLogicRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      challengeRating,
      finalTier: state.tier,
      seed: state.seed,
      stats: state.stats,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeLogicResult(raw, context);
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
    void persistLogicSession(record, persistSession).then((outcome) => {
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
    state.tier,
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

  const handleAnswer = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'question' || current.paused || current.selection !== null) {
        return;
      }
      const responseMs = Math.max(0, session.elapsedMs() - roundStartElapsedRef.current);
      const correct = current.puzzle?.answerIndex === index;
      if (correct) {
        liveAudioHaptics.playSfx('logic-option-correct');
        liveAudioHaptics.haptic('success');
      } else {
        liveAudioHaptics.playSfx('logic-option-wrong');
        liveAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'answer-option', index, responseMs });
    },
    [session, dispatch],
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

  // ---- Option visuals. Two stable resolvers; neither depends on per-tick
  // state (this game has no tick timer during question/roundResult), so the
  // memoized option list skips re-rendering when unrelated state changes.
  const idleVisualFor = useCallback((): OptionVisualState => 'idle', []);
  const visualFor = useCallback(
    (index: number): OptionVisualState => {
      if (state.puzzle === null) {
        return 'dim';
      }
      if (index === state.puzzle.answerIndex) {
        return 'correct';
      }
      return index === state.selection ? 'wrong' : 'dim';
    },
    [state.puzzle, state.selection],
  );

  const puzzle = state.puzzle;
  const view =
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
      {inSession && puzzle !== null ? (
        <>
          {state.phase === 'question' ? (
            <View style={styles.section} testID={testId(GAME_ID, 'question')}>
              <ThemedText type="small" themeColor="textSecondary">
                Find the pattern, then pick the next term.
              </ThemedText>
              <SequenceChips
                terms={puzzle.terms}
                nextValue={null}
                testID={testId(GAME_ID, 'sequence')}
              />
              <View style={styles.options}>
                <OptionList
                  options={puzzle.options}
                  visualFor={idleVisualFor}
                  onPressOption={handleAnswer}
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
                {state.roundOutcome === 'passed' ? 'Correct!' : 'Not quite'}
              </ThemedText>
              <SequenceChips
                terms={puzzle.terms}
                nextValue={puzzle.answer}
                testID={testId(GAME_ID, 'result-sequence')}
              />
              <ThemedText
                type="small"
                themeColor="textSecondary"
                testID={testId(GAME_ID, 'pattern-hint')}>
                The next term is {puzzle.answer} — {describePattern(puzzle.family, puzzle.params)}
              </ThemedText>
              <View style={styles.options}>
                <OptionList
                  options={puzzle.options}
                  visualFor={visualFor}
                  disabled
                  onPressOption={handleAnswer}
                />
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
            label="Fastest answer"
            value={state.stats.fastestMs === null ? '—' : `${state.stats.fastestMs} ms`}
            testID={testId(GAME_ID, 'fastest-answer')}
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
