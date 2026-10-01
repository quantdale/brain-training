/**
 * `<GameHost>` — shared game screen shell (campaign 010, architecture-debt
 * D1; campaign-024 reference-grade chrome).
 *
 * Every game screen renders through this host, so the intro/session/results
 * chrome is written once and inherits the app-wide design language: a
 * game-world Stage with the identity kicker and name, one rules block, one
 * primary action, and a single-row instrument strip during play.
 *
 * Contracts preserved: pause overlay opacity/focus behaviour, hardware-back
 * interception, dev-only QA panel placement, tutorial overlay anchoring, and
 * every `testId(gameId, …)` the automation harness depends on.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { isDevBuild, testId } from '@/sdk';
import type { DifficultyLevel, GameCategory } from '@/sdk';
import { markGameFirstInteraction } from '@/sdk/perf';
import { ThemedText } from '@/components/themed-text';
import {
  getGameIdentity,
  type GameIdentitySource,
} from '@/components/discovery/game-identity';
import { GameStage } from '@/components/discovery/game-stage';
import {
  DifficultySelector,
  GameButton,
  PauseOverlay,
  SessionHeader,
} from '@/components/game-ui';
import { Button } from '@/components/ui';
import { getGameDefinition } from '@/registry/registry';
import { Spacing, type DomainName } from '@/constants/theme';
import type { ThemeColor } from '@/theme/tokens';
import { useTheme } from '@/hooks/use-theme';
import { getDb } from '@/db';
import { useWorkoutSessionLaunch } from '@/workout/session-launch-context';

/** Which chrome the host renders around the game's content. */
export type GameHostView = 'intro' | 'session' | 'results';

/**
 * Registry category → domain identity colour key. Categories are player-facing
 * labels ("Logic & Problem Solving"), domain keys are single words, so the
 * mapping is explicit instead of a case-fold that silently misses one.
 */
const DOMAIN_BY_CATEGORY: Record<string, DomainName> = {
  Memory: 'memory',
  Attention: 'attention',
  Speed: 'speed',
  Math: 'math',
  Language: 'language',
  'Logic & Problem Solving': 'logic',
  Flexibility: 'flexibility',
  Spatial: 'spatial',
};

function domainTone(category: string | undefined): DomainName | null {
  if (category === undefined) return null;
  return DOMAIN_BY_CATEGORY[category] ?? null;
}

/** Keep the intro's rule readable at a glance while leaving full detail to the tutorial. */
function conciseMechanic(description: string | undefined): string | undefined {
  if (description === undefined) return undefined;
  const firstSentence = description.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  return firstSentence && firstSentence.length > 0 ? firstSentence : description;
}

/** Player-facing label for the selected difficulty on the intro meta strip. */
const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  expert: 'Expert',
  adaptive: 'Adaptive',
};

export interface GameHostProps {
  /** Stable game id (testIDs, pause overlay spec). */
  readonly gameId: string;
  /** Game description shown on the intro view (optional in game.json). */
  readonly description?: string;
  /** Top-level view to render; `results` renders `children` verbatim. */
  readonly view: GameHostView;
  /** True while the session is paused (freezes + obscures the challenge). */
  readonly paused: boolean;
  /** Intro difficulty selection. */
  readonly difficulty: DifficultyLevel | null;
  readonly onSelectDifficulty: (level: DifficultyLevel) => void;
  readonly onStart: () => void;
  /** "How to play" — opens the tutorial replay. */
  readonly onHelp: () => void;
  /** Pause button + hardware-back guard target. */
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onQuit: () => void;
  /** Left slot of the in-session header (round/problem label). */
  readonly header?: React.ReactNode;
  /** Score line rendered in the in-session header (`Score <value>`). */
  readonly score?: string;
  /**
   * Rounds completed / planned, rendered as the HUD progress bar. Games that
   * do not report progress simply omit it.
   */
  readonly roundProgress?: { value: number; total: number };
  /** Estimated reward shown on the intro meta strip (e.g. `up to 40 XP`). */
  readonly rewardHint?: string;
  /**
   * Per-game QA panel (built on the shared `QaPanelShell`). Rendered by the
   * host ONLY behind `isDevBuild()`, in the intro and session views.
   */
  readonly qaPanel?: React.ReactNode;
  /**
   * Placement of the dev-only QA panel in the session view. `'above'` (the
   * default) renders before the game children so tall boards cannot push the
   * panel out of the automation-reachable viewport on short screens;
   * `'below'` renders after them. Production builds never render the panel.
   */
  readonly qaPanelPosition?: 'above' | 'below';
  /** Tutorial element; mounted by the host while `tutorialOpen`. */
  readonly tutorial?: React.ReactNode;
  readonly tutorialOpen?: boolean;
  /** True during an active session: hardware back pauses instead of leaving. */
  readonly interceptBack?: boolean;
  /** Session body (`view === 'session'`) or results content (`results`). */
  readonly children?: React.ReactNode;
}

export function GameHost({
  gameId,
  description,
  view,
  paused,
  difficulty,
  onSelectDifficulty,
  onStart,
  onHelp,
  onPause,
  onResume,
  onQuit,
  header,
  score,
  roundProgress,
  rewardHint,
  qaPanel,
  qaPanelPosition = 'above',
  tutorial,
  tutorialOpen = false,
  interceptBack = false,
  children,
}: GameHostProps) {
  const theme = useTheme();
  // Latest paused/onPause via refs so the back subscription is mounted once.
  const backStateRef = useRef({ paused, onPause });
  useEffect(() => {
    backStateRef.current = { paused, onPause };
  });

  // Dev-only perf seam (campaign 010, debt D4): the first touch on the
  // session body closes the game-start→first-interaction latency window
  // opened by `useGameSession.begin()`. Passive observation only —
  // onTouchStart does not participate in responder negotiation, so child
  // controls behave unchanged.
  const handleSessionTouchStart = useCallback(() => {
    markGameFirstInteraction(gameId);
  }, [gameId]);

  useEffect(() => {
    if (!interceptBack) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!backStateRef.current.paused) {
        // Active session: pause (the overlay becomes the confirm dialog).
        backStateRef.current.onPause();
      }
      // Consumed in both cases: while paused, only the overlay's explicit
      // Resume/Quit may proceed — no accidental abandonment (audit B6).
      return true;
    });
    return () => subscription.remove();
  }, [interceptBack]);

  const definition = getGameDefinition(gameId);
  const tone = domainTone(definition?.primaryCategory);
  const categoryLabel = definition?.primaryCategory;
  const gameName = definition?.name ?? gameId;
  const rules = conciseMechanic(description ?? definition?.description);
  // The intro is always a GameStage. An unregistered id (bare test harness,
  // renamed game) still gets a valid identity source rather than different
  // chrome, so the same composition renders in every case.
  const stageGame: GameIdentitySource =
    definition ?? {
      id: gameId,
      name: gameName,
      // Bare-harness ids have no category; the empty string keeps
      // getGameIdentity's generic fallback instead of inventing a domain.
      primaryCategory: '' as GameCategory,
      description: rules,
    };
  const identity = getGameIdentity(stageGame);
  const workoutLaunch = useWorkoutSessionLaunch();
  // 073 §4.2 — the "Game N of M" indicator describes the PLAN's real
  // position, which comes from the stored workout row, not from the launch
  // tuple. The tuple is caller-supplied input (deep-link parameters are
  // validated for shape, not for truth), so a stale or forged leg index must
  // never be presented as the plan's position.
  //
  // A launch-gated effect rather than `useDbData`: that hook resolves the
  // store unconditionally, and GameHost is rendered by every game screen —
  // including bare harnesses where no store exists — so an unconditional read
  // would report a failure for a state that is normal here. The asserted index
  // stays the documented fallback while the row loads or when no store is
  // available; the advance path re-reads the store regardless.
  // The row key is stored WITH the position so a launch change makes the old
  // value stale by derivation instead of by a state reset inside the effect
  // (a synchronous `setState` in an effect body cascades renders).
  const [stored, setStored] = useState<{ key: string; index: number } | null>(null);
  const launchKey = workoutLaunch?.instanceKey ?? null;
  useEffect(() => {
    if (launchKey === null) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const instance = await getDb().workouts.getByDate(launchKey);
        if (!cancelled && instance) {
          setStored({ key: launchKey, index: instance.currentIndex });
        }
      } catch {
        // Store unavailable (recovery, bare harness): keep the asserted-index
        // fallback. Presentational only — nothing durable depends on this.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [launchKey]);
  const storedPosition =
    stored !== null && launchKey !== null && stored.key === launchKey
      ? stored.index
      : null;
  const workoutPosition =
    workoutLaunch?.gameId === gameId
      ? (storedPosition ?? workoutLaunch.legIndex) + 1
      : null;
  // A tutorial is a modal learning surface. Keep the intro mounted behind it
  // for a smooth dismissal, but remove its controls from the accessibility
  // tree while the tutorial owns focus; otherwise a clipped Start button can
  // be discovered behind the visible demo on compact screens.
  const contentHidden = paused || (view === 'intro' && tutorialOpen);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]} testID={testId(gameId, 'screen')}>
      <View
        style={styles.content}
        importantForAccessibility={contentHidden ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={contentHidden}
        accessible={false}>
        {view === 'intro' ? (
          // Campaign 055: the intro is a game-world Stage — world art leads,
          // the identity kicker and title follow, then workout context, rules,
          // difficulty, the Start key and How to play.
          <GameStage
            game={stageGame}
            testID={testId(gameId, 'intro')}
            artTestID={testId(gameId, 'world')}
            identityTestID="game-identity-mark"
            titleTestID="game-title"
            size="hero"
            kicker={identity.verb}
            meta={
              categoryLabel !== undefined && categoryLabel !== gameName ? (
                <ThemedText
                  type="eyebrow"
                  themeColor="textSecondary"
                  testID="game-category"
                  style={tone ? { color: theme[`${tone}Text` as ThemeColor] } : undefined}>
                  {categoryLabel}
                </ThemedText>
              ) : null
            }>
            {/* R3 residual: a cold deep link lands on the intro with an empty
                navigation stack, so the intro needs its own exit. Routes
                through the game's standard quit path (safe back to /games),
                never a bare router.back(). */}
            <Button
              testID={testId(gameId, 'intro-back')}
              label="Back to games"
              variant="ghost"
              size="sm"
              fullWidth={false}
              accessibilityHint="Leave this game and return to the games library"
              onPress={onQuit}
            />
            {workoutPosition !== null ? (
              <View
                style={styles.workoutContext}
                testID={testId(gameId, 'workout-context')}
                accessibilityLabel={`Today's workout, game ${workoutPosition}, ready to start`}>
                <ThemedText type="eyebrow" themeColor="textMuted">
                  TODAY&apos;S WORKOUT
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Game {workoutPosition} · your next game
                </ThemedText>
              </View>
            ) : null}

            {rules !== undefined && rules.length > 0 ? (
              <ThemedText type="bodyRead" themeColor="textSecondary" testID="game-description">
                {rules}
              </ThemedText>
            ) : null}

            <View style={styles.metaStrip}>
              <View style={styles.metaCell}>
                <ThemedText type="eyebrow" themeColor="textMuted">
                  Difficulty
                </ThemedText>
                <ThemedText type="numeral" themeColor="text">
                  {difficulty ? DIFFICULTY_LABEL[difficulty] : 'Normal'}
                </ThemedText>
              </View>
              {rewardHint !== undefined ? (
                <>
                  <View style={[styles.metaDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.metaCell}>
                    <ThemedText type="eyebrow" themeColor="textMuted">
                      Reward
                    </ThemedText>
                    <ThemedText type="numeral" themeColor="xp">
                      {rewardHint}
                    </ThemedText>
                  </View>
                </>
              ) : null}
            </View>

            <DifficultySelector gameId={gameId} selected={difficulty} onSelect={onSelectDifficulty} />

            <Button
              testID={testId(gameId, 'start')}
              label="Start game"
              sublabel={workoutPosition !== null ? `Game ${workoutPosition} · ready when you are` : undefined}
              size="lg"
              accessibilityHint="Begin this game"
              onPress={onStart}
            />
            {/* While the first-run tutorial is on screen it already explains
                the game and offers its own demo action, so the replay button
                would duplicate it in the same viewport. */}
            {tutorialOpen ? null : (
              <Button
                testID={testId(gameId, 'help')}
                label="How to play"
                variant="ghost"
                size="md"
                onPress={onHelp}
              />
            )}

            {isDevBuild() ? qaPanel : null}
          </GameStage>
        ) : null}

        {view === 'session' ? (
          <View style={styles.section} onTouchStart={handleSessionTouchStart}>
            <SessionHeader
              round={typeof header === 'string' ? header : undefined}
              score={score === undefined ? undefined : `Score ${score}`}
              scoreTestID={testId(gameId, 'score')}
              progress={roundProgress}
              trailing={
                <GameButton
                  small
                  variant="secondary"
                  testID={testId(gameId, 'pause')}
                  label="Pause"
                  onPress={onPause}
                />
              }>
              {/* Games that pass a non-string header (custom round chip) keep
                  the legacy row so their own composition still renders. */}
              {header !== undefined && typeof header !== 'string' ? header : null}
            </SessionHeader>

            {isDevBuild() && qaPanelPosition === 'above' ? qaPanel : null}

            <View
              style={[styles.mechanicStage, { backgroundColor: theme.surfaceSunken, borderColor: theme.border }]}
              testID={testId(gameId, 'stage')}>
              {children}
            </View>

            {isDevBuild() && qaPanelPosition === 'below' ? qaPanel : null}
          </View>
        ) : null}

        {view === 'results' ? children : null}
      </View>

      {paused && view === 'session' ? (
        <PauseOverlay gameId={gameId} onResume={onResume} onQuit={onQuit} />
      ) : null}

      {view === 'intro' && tutorialOpen && tutorial !== undefined ? (
        <View style={styles.tutorialOverlay} pointerEvents="box-none">
          {tutorial}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // Bottom-anchored overlay: guarantees tutorial controls stay reachable on
  // short viewports where stacking the card after tall intro content used to
  // clip the Skip/Done buttons off-screen (device-verified defect). The
  // bottom inset keeps the last button clear of the gesture/nav zone.
  tutorialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingBottom: Spacing.four,
  },
  content: {
    flex: 1,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.three,
  },
  mechanicStage: {
    gap: Spacing.three,
    padding: Spacing.twoHalf,
    borderWidth: 1,
    borderRadius: Spacing.two,
  },
  workoutContext: {
    gap: Spacing.half,
    marginTop: Spacing.one,
  },
  // Two-column reward box (reference: pre-game intro promises level + reward
  // in one hairline-divided strip rather than two competing cards).
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  metaCell: {
    gap: Spacing.half,
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});
