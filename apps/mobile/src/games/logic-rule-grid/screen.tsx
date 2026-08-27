/**
 * RuleGridScreen — the Rule Grid game (Latin-square constraint inference).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Rule-Grid-specific — the reducer wiring, the per-round timeout,
 * the scoring/persistence pipeline, and the grid view.
 *
 * The route (`app/game/[id].tsx`) renders this component with no props; every
 * prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer; resuming continues
 * from the same position (the per-round timeout re-arms with its full budget,
 * matching the pre-migration behavior). The board is covered by the opaque
 * shared `PauseOverlay` and hidden from the accessibility tree while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { isDevBuild, liveAudioHaptics, noopXpRatingHook, systemClock, testId } from '@/sdk';
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

import { Grid } from './components/grid';
import { QaPanel } from './components/qa-panel';
import { SymbolOptions } from './components/symbol-options';
import { Tutorial } from './components/tutorial';
import { ruleGridParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createRuleGridQaForceStateHooks, createRuleGridTutorialLifecycle } from './hooks';
import { ruleGridGameReducer } from './reducer';
import { normalizeRuleGridResult } from './scoring';
import {
  buildRuleGridRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistRuleGridSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, createInitialRuleGridState } from './types';
import { SCORING_VERSION } from './versions';

export interface RuleGridScreenProps {
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

export default function RuleGridScreen(props: RuleGridScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(ruleGridGameReducer, undefined, createInitialRuleGridState);

  const stateRef = useRef(state);
  const roundStartedAtRef = useRef<number>(0);

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
        (current.phase === 'showGrid' || current.phase === 'roundResult') &&
        !current.paused
      );
    },
    onPause: () => dispatch({ type: 'pause' }),
  });

  const tutorial = useMemo(() => createRuleGridTutorialLifecycle(tutorialStore), [tutorialStore]);
  const qaHooks = useMemo(() => createRuleGridQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? ruleGridParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 7;
  const inSession = state.phase === 'showGrid' || state.phase === 'roundResult';
  const isLastRound = state.roundIndex + 1 >= rounds;

  const renderSymbol = useCallback((v: number) => String(v + 1), []);

  // ---- First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

  // ---- Per-round timeout: auto-answer null when the budget is exhausted.
  // Kept as a plain effect (not `useGameTimeout`): it deliberately restarts on
  // every activation — including resume — anchoring `roundStartedAtRef` to the
  // current monotonic time, which is exactly the pre-migration behavior.
  useEffect(() => {
    if (state.phase !== 'showGrid' || state.paused || state.currentRound === null || state.profile === null) {
      return;
    }
    const resolved = ruleGridParamsFromProfile(state.profile);
    roundStartedAtRef.current = clock.now();
    const handle = setTimeout(() => {
      dispatch({
        type: 'answer',
        selectedValue: null,
        elapsedMs: clock.now() - roundStartedAtRef.current,
      });
    }, resolved.roundTimeMs);
    return () => clearTimeout(handle);
  }, [state.phase, state.roundIndex, state.paused, state.currentRound, state.profile, clock, dispatch]);

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
    const resolvedParams = ruleGridParamsFromProfile(state.profile);
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      state.stats.roundsCorrect,
      state.stats.roundsPlayed,
      state.stats.totalElapsedMs,
      state.stats.totalBudgetMs,
    );

    const raw = buildRuleGridRawResult({
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
    const normalized = normalizeRuleGridResult(raw, context);
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
    void persistRuleGridSession(record, persistSession).then((outcome) => {
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

  const handleSelectSymbol = useCallback(
    (value: number) => {
      const current = stateRef.current;
      if (current.phase !== 'showGrid' || current.paused) {
        return;
      }
      liveAudioHaptics.playSfx('memory-tile-correct');
      liveAudioHaptics.haptic('light');
      dispatch({
        type: 'answer',
        selectedValue: value,
        elapsedMs: clock.now() - roundStartedAtRef.current,
      });
    },
    [dispatch, clock],
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
      qaPanel={<QaPanel onForceWin={qaHooks.forceWin} onForceLose={qaHooks.forceLose} />}
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {state.phase === 'showGrid' && state.currentRound !== null ? (
        <View style={styles.section} testID={testId(GAME_ID, 'show-grid')}>
          <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'rule-prompt')}>
            {state.currentRound.blanks.length > 1
              ? 'Several cells are hidden. Deduce the marked one (?) by chaining row and column constraints.'
              : 'One symbol is missing. Which fits?'}
          </ThemedText>

          <Grid
            size={state.currentRound.size}
            square={state.currentRound.square}
            blankIndex={state.currentRound.blankIndex}
            blanks={state.currentRound.blanks}
            renderSymbol={renderSymbol}
            testIdCell={(i) => testId(GAME_ID, 'cell', String(i))}
          />

          <SymbolOptions
            options={state.currentRound.options}
            onSelect={handleSelectSymbol}
            renderSymbol={renderSymbol}
          />
        </View>
      ) : null}

      {state.phase === 'roundResult' && state.currentRound !== null ? (
        <View style={styles.section} testID={testId(GAME_ID, 'round-result')}>
          <ThemedText
            type="headline"
            themeColor={state.roundCorrect ? 'success' : 'danger'}
            testID={testId(
              GAME_ID,
              state.roundCorrect ? 'round-correct' : state.roundOutcome === 'timeout' ? 'round-timeout' : 'round-wrong',
            )}>
            {state.roundCorrect ? 'Correct!' : state.roundOutcome === 'timeout' ? 'Time up!' : 'Not quite'}
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            The missing symbol was
          </ThemedText>
          <ThemedText
            type="bodyLarge"
            testID={testId(GAME_ID, 'correct-symbol')}>
            {renderSymbol(state.currentRound.answer)}
          </ThemedText>

          <GameButton
            testID={testId(GAME_ID, 'next-round')}
            label={isLastRound ? 'See results' : 'Next round'}
            onPress={() => dispatch({ type: 'next-round' })}
          />
        </View>
      ) : null}

      {state.phase === 'results' ? (
        <GameResults
          gameId={GAME_ID}
          persistState={state.persistState}
          lastError={state.lastError}
          forced={state.forced}
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
              (state.stats.roundsPlayed > 0 ? state.stats.roundsCorrect / state.stats.roundsPlayed : 0) * 100,
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
});
