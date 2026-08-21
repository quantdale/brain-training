/**
 * RuleFlipScreen — the Flexibility game (block-based rule switching).
 *
 * Renders a pure state machine (`flexibilityRuleFlipReducer`) and owns the side
 * effects: response-time measurement against the SDK monotonic clock, the SDK
 * `SessionLifecycle` (start/pause/resume/complete/abandon), auto-pause on
 * backgrounding, the tutorial, the dev-only QA panel, the "Rule Flipped" cue,
 * the switch-arm gate, and result persistence.
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
 * `PauseOverlay` and hidden from the accessibility tree while paused.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  SessionLifecycle,
  isDevBuild,
  liveAudioHaptics,
  noopXpRatingHook,
  systemClock,
  testId,
} from '@/sdk';
import type { Clock, DifficultyLevel, TutorialStore, XpRatingHook } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { DifficultySelector, SessionHeader, StatRow } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { GameButton } from './components/button';
import { PauseOverlay } from './components/pause-overlay';
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

/** Random per-session seed — the seed is input, not generator content. */
function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

function newSessionId(): string {
  return `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  const stateRef = useRef(state);
  const finalizedRef = useRef(false);
  /** Monotonic-clock time the current trial became active (response origin). */
  const trialStartRef = useRef(0);
  /** Clock time a pause began inside the current trial, or null. */
  const pauseStartRef = useRef<number | null>(null);
  /** Clock time until which input is disabled after a rule flip (the arm window). */
  const armUntilRef = useRef<number | null>(null);

  // Keep a ref of the latest state for event handlers (AppState, timers).
  useEffect(() => {
    stateRef.current = state;
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
    xpHook,
    persistSession,
  ]);

  // Session controls.
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
      !(current.phase === 'trialActive' || current.phase === 'trialResult') ||
      current.paused
    ) {
      return;
    }
    if (current.phase === 'trialActive') {
      pauseStartRef.current = clock.now();
    }
    lifecycleRef.current?.pause();
    dispatch({ type: 'pause' });
  }, [clock, dispatch]);

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
    const level = current.difficulty ?? 'normal';
    const seed = current.seedOverride ?? (sessionSeed !== undefined ? String(sessionSeed) : randomSeed());
    startSession(level, seed);
  }, [startSession, sessionSeed]);

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

  // Auto-pause when the app leaves the foreground (constitution §11).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        pauseSession();
      }
    });
    return () => subscription.remove();
  }, [pauseSession]);

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
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={qaHooks.forceTimeout}
              />
            ) : null}
          </View>
        ) : null}

        {inSession ? (
          <View style={styles.section}>
            <SessionHeader>
              <ThemedText type="subtitle" testID={testId(GAME_ID, 'round', String(state.roundIndex + 1))}>
                Trial {state.roundIndex + 1}/{rounds}
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

            {isDevBuild() ? (
              <QaPanel
                onForceWin={qaHooks.forceWin}
                onForceLose={qaHooks.forceLose}
                onForceTimeout={qaHooks.forceTimeout}
              />
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
