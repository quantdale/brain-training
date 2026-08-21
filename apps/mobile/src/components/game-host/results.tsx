/**
 * `<GameResults>` — shared results-view chrome for GameHost-based games
 * (campaign 010, architecture-debt D1).
 *
 * Owns the results layout every game duplicated: the headline, an optional
 * game-specific badge slot (e.g. Reaction Time's "ended early" notice), the
 * game's stat rows, the persistence-failure error line, the QA-forced badge,
 * and the Play again / Done actions. Games pass their stat rows as children.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { trackSessionPersist } from '@/sdk/perf';
import type { PerfMeasure } from '@/sdk/perf';
import { ThemedText } from '@/components/themed-text';
import { GameButton } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

/** Persistence lifecycle mirrored from the game reducers' `persistState`. */
export type GameResultsPersistState = 'idle' | 'started' | 'succeeded' | 'failed';

export interface GameResultsProps {
  readonly gameId: string;
  /** Headline; defaults to "Session complete". */
  readonly title?: string;
  /** Optional game-specific notice rendered directly under the headline. */
  readonly badge?: React.ReactNode;
  /** True when the session ended via a dev-only QA force hook. */
  readonly forced?: boolean;
  readonly persistState?: GameResultsPersistState;
  /** Persistence failure detail (shown alongside the error line). */
  readonly lastError?: string | null;
  readonly onRestart: () => void;
  readonly onQuit: () => void;
  /** Stat rows (`StatRow`/`ResultRow`). */
  readonly children: React.ReactNode;
}

export function GameResults({
  gameId,
  title = 'Session complete',
  badge,
  forced = false,
  persistState = 'idle',
  lastError = null,
  onRestart,
  onQuit,
  children,
}: GameResultsProps) {
  // Dev-only perf seam (campaign 010, debt D4): bracket the session-completion
  // DB write as observed through the persistence lifecycle — from the first
  // render showing 'started' to the terminal 'succeeded'/'failed', or back to
  // 'idle' when a restart supersedes an in-flight write. Includes a little
  // React scheduling slack around the awaited write; unmounting mid-write
  // drops the sample instead of recording a truncated duration.
  const persistMeasureRef = useRef<PerfMeasure | null>(null);
  useEffect(() => {
    if (persistState === 'started') {
      if (persistMeasureRef.current === null) {
        persistMeasureRef.current = trackSessionPersist(gameId);
      }
      return;
    }
    const open = persistMeasureRef.current;
    if (open !== null) {
      persistMeasureRef.current = null;
      open.end({ outcome: persistState === 'idle' ? 'superseded' : persistState });
    }
  }, [persistState, gameId]);

  return (
    <View style={styles.section} testID={testId(gameId, 'results')}>
      <ThemedText type="title">{title}</ThemedText>
      {badge}
      {children}

      {persistState === 'failed' ? (
        <ThemedText type="small" themeColor="danger" testID={testId(gameId, 'persist-error')}>
          Your session could not be saved. {lastError ?? ''}
        </ThemedText>
      ) : null}
      {forced ? (
        <ThemedText type="caption" themeColor="warning" testID={testId(gameId, 'forced-badge')}>
          QA-forced session
        </ThemedText>
      ) : null}

      <View style={styles.buttonRow}>
        <GameButton testID={testId(gameId, 'restart')} label="Play again" onPress={onRestart} />
        <GameButton
          testID={testId(gameId, 'quit')}
          label="Done"
          variant="secondary"
          onPress={onQuit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
