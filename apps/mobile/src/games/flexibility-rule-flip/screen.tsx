/**
 * RuleFlipScreen — the Flexibility game (block-based rule switching).
 *
 * GameHost-based slice (campaign 010, architecture-debt D1): shared session
 * lifecycle, auto-pause, tutorial/QA gating, intro/pause/results chrome and
 * the Android back-guard live in `@/components/game-host`; this module keeps
 * only what is Rule-Flip-specific — the reducer wiring, the response-time
 * measurement against the monotonic clock, the "Rule Flipped" cue and its
 * switch-arm gate, the scoring/persistence pipeline, and the card grid view.
 *
 * The rule is constant within a BLOCK of trials; between blocks the rule may
 * flip. When it does, the first trial of the new block is a SWITCH trial: an
 * explicit "Rule Flipped" cue fires and input is briefly DISABLED (the
 * "arm" window, `params.switchArmMs`) so the player cannot react before they
 * have read the new rule — then input re-arms. The route (`app/game/[id].tsx`)
 * renders this component with no props; every prop is an optional injection
 * seam for deterministic tests.
 *
 * Pause semantics: pausing freezes the lifecycle timer; response time measured
 * for the current trial excludes paused time (the trial's start reference is
 * shifted forward by the pause duration on resume); the arm deadline is
 * shifted forward by the same amount. The board is covered by the opaque
 * shared `PauseOverlay` and hidden from the accessibility tree while paused.
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

import { QaPanel } from './components/qa-panel';
import { Stimulus } from './components/stimulus';
import type { StimulusVisualState } from './components/stimulus';
import { Tutorial } from './components/tutorial';
import { flexibilityRuleFlipParamsFromProfile, sessionChallengeRating } from './difficulty';
import { gameDefinition } from './game-definition';
import { createFlexibilityRuleFlipQaForceStateHooks, createFlexibilityRuleFlipTutorialLifecycle } from './hooks';
import { flexibilityRuleFlipReducer } from './reducer';
import { normalizeFlexibilityRuleFlipResult } from './scoring';
import {
  buildFlexibilityRuleFlipRawResult,
  buildSessionRecord,
  dbSessionPersister,
  persistFlexibilityRuleFlipSession,
} from './session';
import type { SessionPersistence } from './session';
import { GAME_ID, RULE_LABELS, createInitialFlexibilityRuleFlipState } from './types';
import type { Card } from './types';
import { SCORING_VERSION } from './versions';

export interface RuleFlipScreenProps {
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

export default function RuleFlipScreen(props: RuleFlipScreenProps = {}) {
  const {
    clock = systemClock,
    tutorialStore,
    sessionSeed,
    persistSession = dbSessionPersister,
    xpHook = noopXpRatingHook,
  } = props;
  const router = useRouter();
  const [state, dispatch] = useReducer(flexibilityRuleFlipReducer, undefined, createInitialFlexibilityRuleFlipState);

  const stateRef = useRef(state);
  /** Monotonic-clock time the current trial became active (response origin). */
  const trialStartRef = useRef(0);
  /** Clock time a pause began inside the current trial, or null. */
  const pauseStartRef = useRef<number | null>(null);
  /** Clock time until which input is disabled after a rule flip (the arm window). */
  const armUntilRef = useRef<number | null>(null);

  // Keep a ref of the latest state for event handlers (timers, guards).
  useEffect(() => {
    stateRef.current = state;
  });

  const session = useGameSession({
    gameId: GAME_ID,
    clock,
    canPause: () => {
      const current = stateRef.current;
      return (current.phase === 'trialActive' || current.phase === 'trialResult') && !current.paused;
    },
    onPause: () => {
      // Record when the pause began inside the current trial: resume shifts
      // the response origin (and arm deadline) forward by this duration.
      const current = stateRef.current;
      if (current.phase === 'trialActive') {
        pauseStartRef.current = clock.now();
      }
      dispatch({ type: 'pause' });
    },
  });

  const tutorial = useMemo(
    () => createFlexibilityRuleFlipTutorialLifecycle(tutorialStore),
    [tutorialStore],
  );
  const qaHooks = useMemo(() => createFlexibilityRuleFlipQaForceStateHooks(dispatch), [dispatch]);

  const params = state.profile !== null ? flexibilityRuleFlipParamsFromProfile(state.profile) : null;
  const rounds = params?.rounds ?? 10;
  const speedTargetMs = params?.speedTargetMs ?? 5000;
  const armMs = params?.switchArmMs ?? 800;
  const speedPercent =
    state.stats.scoredPicks > 0
      ? Math.min(1, Math.max(0, 1 - state.stats.totalResponseMs / state.stats.scoredPicks / speedTargetMs))
      : 0;
  const isLastRound = state.roundIndex + 1 >= rounds;
  const inSession =
    state.phase === 'trialActive' || state.phase === 'trialResult';

  // Trial start + arm window.
  useEffect(() => {
    if (state.phase === 'trialActive') {
      const isSwitch = state.round?.isSwitch ?? false;
      if (isSwitch && armMs > 0) {
        // The trial's response origin is deferred until the arm window ends, so
        // the arm time is never charged to the player's response time.
        trialStartRef.current = clock.now() + armMs;
        armUntilRef.current = trialStartRef.current;
      } else {
        trialStartRef.current = clock.now();
        armUntilRef.current = null;
      }
    }
  }, [state.phase, state.roundIndex, state.round, clock, armMs]);

  // First play: open the tutorial automatically.
  useEffect(() => {
    if (tutorial.shouldShowTutorial(GAME_ID)) {
      dispatch({ type: 'tutorial-open' });
    }
  }, [tutorial]);

  // Session finalization: complete the lifecycle, run the SDK scoring
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
    const resolvedParams = flexibilityRuleFlipParamsFromProfile(state.profile);
    const finalSwitchRate = resolvedParams.flipRate;
    const challengeRating = sessionChallengeRating(
      difficulty,
      state.profile,
      finalSwitchRate,
    );

    const raw = buildFlexibilityRuleFlipRawResult({
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
    const normalized = normalizeFlexibilityRuleFlipResult(raw, context);
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
    void persistFlexibilityRuleFlipSession(record, persistSession).then((outcome) => {
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

  // Session controls (mechanics live here; mechanics-free plumbing does not).
  const pauseSession = useCallback(() => {
    session.requestPause();
  }, [session]);

  const resumeSession = useCallback(() => {
    // Shift the trial's response-time origin (and arm deadline) by the pause
    // duration so the player never gains or loses time on a trial because of
    // pausing.
    if (pauseStartRef.current !== null) {
      const delta = clock.now() - pauseStartRef.current;
      trialStartRef.current += delta;
      if (armUntilRef.current !== null) {
        armUntilRef.current += delta;
      }
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
      // Input is disabled while the arm window after a rule flip is active.
      if (armUntilRef.current !== null && clock.now() < armUntilRef.current) {
        return;
      }
      const responseMs = Math.max(0, clock.now() - trialStartRef.current);
      if (index === current.round.correctIndex) {
        liveAudioHaptics.feedback('correct');
      } else {
        liveAudioHaptics.feedback('wrong');
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

  // Tutorial controls.
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

  // Trial card visuals (see StimulusVisualState).
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
        <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
          Trial {state.roundIndex + 1}/{rounds}
        </ThemedText>
      }
      score={String(state.stats.score)}
      qaPanel={
        <QaPanel
          onForceWin={qaHooks.forceWin}
          onForceLose={qaHooks.forceLose}
          onForceTimeout={qaHooks.forceTimeout}
        />
      }
      tutorialOpen={state.tutorialOpen}
      tutorial={
        <Tutorial onComplete={completeTutorial} onSkip={isDevBuild() ? skipTutorial : undefined} />
      }>
      {inSession ? (
        <>
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
                    Rule flipped! Get ready…
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
                {state.round.isSwitch ? 'New rule — pick the matching card' : 'Pick the matching card'}
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
            label="After rule flips"
            value={`${Math.round(
              (state.stats.switchPlayed > 0
                ? state.stats.switchCorrect / state.stats.switchPlayed
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'switch-accuracy')}
          />
          <StatRow
            label="Same-rule trials"
            value={`${Math.round(
              (state.stats.repeatPlayed > 0
                ? state.stats.repeatCorrect / state.stats.repeatPlayed
                : 0) * 100,
            )}%`}
            testID={testId(GAME_ID, 'repeat-accuracy')}
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
