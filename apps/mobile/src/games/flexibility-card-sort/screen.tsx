/**
 * CardSortScreen — the Flexibility game (rule-switching card sort).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Card-Sort-specific — the rule-switch notice timer, response-
 * time measurement with pause-shifted origins, and the scoring/persistence
 * pipeline.
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
  useGameTimeout,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { CardView } from './components/card';
import type { CardVisualState } from './components/card';
import { CardGrid } from './components/card-grid';
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

export default function CardSortScreen(props: CardSortScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(flexibilityGameReducer, undefined, createInitialFlexibilityState);

  const stateRef = useRef(state);
  /** Monotonic-clock time the current round became active (response origin). */
  const roundStartRef = useRef(0);
  /** Clock time a pause began inside the current round, or null. */
  const pauseStartRef = useRef<number | null>(null);

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
        (current.phase === 'roundActive' ||
          current.phase === 'roundResult' ||
          current.phase === 'ruleSwitchNotice') &&
        !current.paused
      );
    },
    onPause: () => {
      const current = stateRef.current;
      if (current.phase === 'roundActive') {
        pauseStartRef.current = clock.now();
      }
      dispatch({ type: 'pause' });
    },
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
  useGameTimeout(
    state.phase === 'ruleSwitchNotice' && !state.paused,
    () => dispatch({ type: 'notice-expired' }),
    noticeMs,
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
    const activeDurationMs = session.elapsedMs();
    const pausedDurationMs = session.pausedDurationMs();
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
    session,
    xpHook,
    persistSession,
  ]);

  // ---- Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    // Shift the round's response-time origin by the pause duration so the
    // player never gains or loses time on a round because of pausing.
    if (pauseStartRef.current !== null) {
      roundStartRef.current += clock.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    if (session.resumeIfPaused()) {
      dispatch({ type: 'resume' });
    }
  }, [clock, session, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handlePick = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'roundActive' || current.paused || current.round === null) {
        return;
      }
      const responseMs = Math.max(0, clock.now() - roundStartRef.current);
      if (index === current.round.correctIndex) {
        liveAudioHaptics.playSfx('flexibility-card-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('flexibility-card-wrong');
        liveAudioHaptics.haptic('warning');
      }
      dispatch({ type: 'pick-card', index, responseMs });
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

  // ---- Round card visuals (see CardVisualState). Depends only on
  // round-transition state; memoizing keeps the grid + cards from needless
  // re-renders on unrelated state changes.
  const visualFor = useCallback(
    (index: number): CardVisualState => {
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
    },
    [state.round, state.phase, state.roundOutcome, state.lastPickIndex],
  );

  const view: GameHostView =
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
      {inSession ? (
        <>
          {state.phase === 'roundActive' && state.round !== null ? (
            <>
              {/* Discovery blocks withhold the rule: inferring it from
                  keep/reject feedback is the trained skill, so no hint may
                  leak before the pick (the banner shows a placeholder). */}
              <RuleBanner rule={state.round.rule} masked={state.discoveryBlock} />
              <View style={styles.targetRow} testID={testId(GAME_ID, 'target')}>
                <CardView
                  index={-1}
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
              {state.discoveryBlock ? (
                // Discovery feedback is WCST-style: a correct sort confirms
                // silently (no rule named), a miss reveals which rule was
                // active so inference has a teaching signal.
                state.roundOutcome === 'correct' ? (
                  <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'round-explainer')}>
                    Kept — sorted correctly under the hidden rule.
                  </ThemedText>
                ) : (
                  <>
                    <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'rule-reveal')}>
                      Rejected — the match was {describeCard(
                        state.round.candidates[state.round.correctIndex],
                      )}, matched by {state.round.rule}.
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'round-explainer')}>
                      Infer the sorting rule from your keeps and rejections.
                    </ThemedText>
                  </>
                )
              ) : (
                <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'round-explainer')}>
                  {state.roundOutcome === 'correct'
                    ? `Matched by ${state.round.rule}: ${describeCard(state.round.target)}`
                    : `The match was ${describeCard(
                        state.round.candidates[state.round.correctIndex],
                      )} — matched by ${state.round.rule}.`}
                </ThemedText>
              )}
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
            // The notice masks the new rule when the incoming block is a
            // discovery stretch (state.discoveryBlock already holds the NEW
            // block's plan flag at this point).
            <SwitchNotice
              newRule={state.rule}
              masked={state.discoveryBlock}
              onContinue={() => dispatch({ type: 'notice-continue' })}
            />
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
            label="Discovery rounds"
            value={`${Math.round(
              (state.stats.discoveryPlayed > 0
                ? state.stats.discoveryCorrect / state.stats.discoveryPlayed
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'discovery-accuracy')}
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

/** Human-readable card description ("red circle"). */
function describeCard(card: { shape: string; color: string }): string {
  return `${card.color} ${card.shape}`;
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  targetRow: {
    alignItems: 'center',
  },
});
