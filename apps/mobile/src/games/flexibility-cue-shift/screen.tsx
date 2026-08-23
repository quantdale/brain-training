/**
 * CueShiftScreen — the Flexibility game (cue-driven task switching).
 *
 * GameHost-based slice: shared session lifecycle, auto-pause, tutorial/QA
 * gating, intro/pause/results chrome and the Android back-guard live in
 * `@/components/game-host`; this module keeps only what is Cue-Shift-
 * specific — the reducer wiring, response-time measurement against the SDK
 * monotonic clock, the trial view, and the scoring/persistence pipeline.
 *
 * The rule cue changes EVERY trial (not in blocks), so there is no rule-switch
 * notice phase — the cue banner is simply shown beside the stimulus each
 * trial. The route (`app/game/[id].tsx`) renders this component with no props;
 * every prop is an optional injection seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer; response time measured
 * for the current trial excludes paused time (the trial's start reference is
 * shifted forward by the pause duration on resume). The board is covered by
 * the opaque shared `PauseOverlay` and hidden from the accessibility tree
 * while paused. SFX names are the campaign-009 alias fixes — keep verbatim.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  assertDevOnly,
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';
import {
  GameHost,
  GameResults,
  resolveSessionSeed,
  useGameSession,
} from '@/components/game-host';
import type { GameHostView } from '@/components/game-host';

import { QaPanel } from './components/qa-panel';
import { GameButton } from './components/button';
import { Stimulus } from './components/stimulus';
import type { StimulusVisualState } from './components/stimulus';
import { Tutorial } from './components/tutorial';
import { flexibilityCueParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createFlexibilityCueQaForceStateHooks, createFlexibilityCueTutorialLifecycle } from './hooks';
import { flexibilityCueReducer } from './reducer';
import { normalizeFlexibilityCueResult } from './scoring';
import {
  buildFlexibilityCueRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistFlexibilityCueSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, RULE_LABELS, createInitialFlexibilityCueState } from './types';
import type { Card } from './types';
import { SCORING_VERSION } from './versions';

export interface CueShiftScreenProps {
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

function describeCard(card: Card): string {
  return `${card.color} ${card.shape} ${card.number}`;
}

export default function CueShiftScreen(props: CueShiftScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(flexibilityCueReducer, undefined, createInitialFlexibilityCueState);

  const stateRef = useRef(state);
  /** Monotonic-clock time the current trial became active (response origin). */
  const trialStartRef = useRef(0);
  /** Clock time a pause began inside the current trial, or null. */
  const pauseStartRef = useRef<number | null>(null);

  // Keep a ref of the latest state for event handlers (timers, guards).
  useEffect(() => {
    stateRef.current = state;
  });

  // Trial-active and result phases pause.
  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (
        (current.phase === 'trialActive' || current.phase === 'trialResult') &&
        !current.paused
      );
    },
    onPause: () => {
      if (stateRef.current.phase === 'trialActive') {
        pauseStartRef.current = clock.now();
      }
      dispatch({ type: 'pause' });
    },
  });

  const tutorial = useMemo(
    () => createFlexibilityCueTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(() => createFlexibilityCueQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? flexibilityCueParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 10;
  const speedTargetMs = params?.speedTargetMs ?? 5000;
  const speedPercent =
    state.stats.scoredPicks > 0
      ? Math.min(1, Math.max(0, 1 - state.stats.totalResponseMs / state.stats.scoredPicks / speedTargetMs))
      : 0;
  const isLastRound = state.roundIndex + 1 >= rounds;
  const inSession =
    state.phase === 'trialActive' || state.phase === 'trialResult';

  // ---- Response-time origin: reset whenever a new trial becomes active.
  useEffect(() => {
    if (state.phase === 'trialActive') {
      trialStartRef.current = clock.now();
    }
  }, [state.phase, state.roundIndex, clock]);

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
    const resolvedParams = flexibilityCueParamsFromProfile(state.profile);
    const finalSwitchRate = resolvedParams.switchRate;
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      finalSwitchRate,
    );

    const raw = buildFlexibilityCueRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty,
      params: resolvedParams,
      finalSwitchRate,
      challengeRating,
      seed: state.seed,
      stats: state.stats,
      forced: state.forced,
      startedAtMs: state.startedAtMs,
      activeDurationMs,
      pausedDurationMs,
    });
    const context = { gameId: GAME_ID, difficulty, durationMs: activeDurationMs };
    const normalized = normalizeFlexibilityCueResult(raw, context);
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
    void persistFlexibilityCueSession(record, persistSession).then((outcome) => {
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
    // Shift the trial's response-time origin by the pause duration so the
    // player never gains or loses time on a trial because of pausing.
    if (pauseStartRef.current !== null) {
      trialStartRef.current += clock.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    if (session.resumeIfPaused()) {
      dispatch({ type: 'resume' });
    }
  }, [session, clock, dispatch]);

  const quitToLibrary = useCallback(() => {
    session.abandonIfActive();
    router.back();
  }, [session, router]);

  const handlePick = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current.phase !== 'trialActive' || current.paused || current.round === null) {
        return;
      }
      const responseMs = Math.max(0, clock.now() - trialStartRef.current);
      if (index === current.round.correctIndex) {
        // Campaign-009 SFX alias fixes — keep these literal names exactly.
        liveAudioHaptics.playSfx('flexibility-cue-correct');
        liveAudioHaptics.haptic('light');
      } else {
        liveAudioHaptics.playSfx('flexibility-cue-wrong');
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

  const forceTimeout = useCallback(() => {
    assertDevOnly();
    dispatch({ type: 'qa/force-timeout' });
  }, [dispatch]);

  // ---- Trial card visuals (see StimulusVisualState).
  const visualFor = (index: number): StimulusVisualState => {
    if (state.round === null) {
      return 'idle';
    }
    if (state.phase === 'trialResult') {
      if (index === state.round.correctIndex) {
        return 'selected';
      }
      if (state.roundOutcome === 'wrong' && index === state.lastPickIndex) {
        return 'error';
      }
    }
    return 'idle';
  };

  const cardGridTestID = testId(GAME_ID, 'card-grid');

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
          Trial {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
          onForceTimeout={forceTimeout}
        />
      }
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {state.phase === 'trialActive' && state.round !== null ? (
        <>
          <View style={styles.cueBanner} testID={testId(GAME_ID, 'rule-banner')}>
            <ThemedText
              type="headline"
              themeColor="accent"
              testID={testId(GAME_ID, 'rule-banner-text')}>
              {RULE_LABELS[state.round.rule]}
            </ThemedText>
            {state.round.isSwitch ? (
              <ThemedText type="caption" themeColor="warning" testID={testId(GAME_ID, 'rule-switch')}>
                Cue switched!
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.targetRow} testID={testId(GAME_ID, 'target')}>
            <Stimulus card={state.round.target} testID={testId(GAME_ID, 'target-card')} disabled />
          </View>
          <ThemedText
            type="bodyLarge"
            themeColor="text"
            testID={testId(GAME_ID, 'pick-status')}>
            Pick the matching card
          </ThemedText>
          <View style={styles.grid} testID={cardGridTestID}>
            {state.round.candidates.map((card, index) => (
              <Stimulus
                key={index}
                card={card}
                testID={`${cardGridTestID}.card.${index}`}
                onPress={() => handlePick(index)}
                state={visualFor(index)}
              />
            ))}
          </View>
        </>
      ) : null}

      {state.phase === 'trialResult' && state.round !== null ? (
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
          <View style={styles.grid} testID={testId(GAME_ID, 'round-result-grid')}>
            {state.round.candidates.map((card, index) => (
              <Stimulus
                key={index}
                card={card}
                testID={`${testId(GAME_ID, 'round-result-grid')}.card.${index}`}
                onPress={() => handlePick(index)}
                disabled
                state={visualFor(index)}
              />
            ))}
          </View>
          <GameButton
            testID={testId(GAME_ID, 'next-round')}
            label={isLastRound ? 'See results' : 'Next trial'}
            onPress={() => dispatch({ type: 'next-round' })}
          />
        </View>
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
              (state.stats.switchPlayed > 0
                ? state.stats.switchCorrect / state.stats.switchPlayed
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
        </GameResults>
      ) : null}
    </GameHost>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  cueBanner: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  targetRow: {
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
  },
});
