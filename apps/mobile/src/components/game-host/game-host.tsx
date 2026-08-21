/**
 * `<GameHost>` — shared game screen shell (campaign 010, architecture-debt
 * D1; xplat audit B6 back-guard seam).
 *
 * Owns the chrome every game screen previously duplicated (~450 lines per
 * game): the intro/difficulty/start layout, the in-session header row
 * (round label + score + pause), dev-gated QA panel placement, the opaque
 * pause-overlay mount, tutorial mounting, results-view handoff, and the
 * accessibility contract (challenge hidden from the accessibility tree while
 * paused). Games supply their mechanics as slotted content and reduce to
 * roughly generator + reducer + view.
 *
 * Android hardware-back seam (audit B6): while `interceptBack` is true (an
 * active session), the hardware back gesture pauses the session instead of
 * leaving it — the opaque pause overlay then acts as the confirm dialog with
 * explicit Resume/Quit choices. While already paused the event is consumed
 * so a session can never be abandoned accidentally. Intro/results views keep
 * default navigation.
 */
import { useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { isDevBuild, testId } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import {
  DifficultySelector,
  GameButton,
  PauseOverlay,
  SessionHeader,
} from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

/** Which chrome the host renders around the game's content. */
export type GameHostView = 'intro' | 'session' | 'results';

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
   * Per-game QA panel (built on the shared `QaPanelShell`). Rendered by the
   * host ONLY behind `isDevBuild()`, in the intro and session views.
   */
  readonly qaPanel?: React.ReactNode;
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
  qaPanel,
  tutorial,
  tutorialOpen = false,
  interceptBack = false,
  children,
}: GameHostProps) {
  // Latest paused/onPause via refs so the back subscription is mounted once.
  const backStateRef = useRef({ paused, onPause });
  useEffect(() => {
    backStateRef.current = { paused, onPause };
  });

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

  return (
    <View style={styles.screen} testID={testId(gameId, 'screen')}>
      <View
        style={styles.content}
        importantForAccessibility={paused ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={paused}
        accessible={false}>
        {view === 'intro' ? (
          <View style={styles.section} testID={testId(gameId, 'intro')}>
            {description !== undefined && description.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {description}
              </ThemedText>
            ) : null}

            <ThemedText type="caption" themeColor="textSecondary">
              Difficulty
            </ThemedText>
            <DifficultySelector gameId={gameId} selected={difficulty} onSelect={onSelectDifficulty} />

            <View style={styles.buttonRow}>
              <GameButton testID={testId(gameId, 'start')} label="Start" onPress={onStart} />
              <GameButton
                testID={testId(gameId, 'help')}
                label="How to play"
                variant="secondary"
                onPress={onHelp}
              />
            </View>

            {isDevBuild() ? qaPanel : null}
          </View>
        ) : null}

        {view === 'session' ? (
          <View style={styles.section}>
            <SessionHeader>
              {header}
              {score !== undefined ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID={testId(gameId, 'score')}>
                  Score {score}
                </ThemedText>
              ) : null}
              <GameButton
                small
                variant="secondary"
                testID={testId(gameId, 'pause')}
                label="Pause"
                onPress={onPause}
              />
            </SessionHeader>

            {children}

            {isDevBuild() ? qaPanel : null}
          </View>
        ) : null}

        {view === 'results' ? children : null}
      </View>

      {paused && view === 'session' ? (
        <PauseOverlay gameId={gameId} onResume={onResume} onQuit={onQuit} />
      ) : null}

      {tutorialOpen && tutorial !== undefined ? tutorial : null}
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
});
