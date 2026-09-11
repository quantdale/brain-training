/**
 * SessionHeader — the in-session HUD row shared by every game screen.
 *
 * Reference pattern (Brilliant/Moises, `PATTERNS-PLAY` 3–4): one compact row —
 * exit/pause on one side, progress in the middle, score/streak cluster on the
 * other — never a second HUD line competing with the board.
 *
 * Two shapes are supported:
 *   - structured (`progress` / `round` / `score` / `onPause`) for games that
 *     adopt the shared layout,
 *   - `children` for games that still compose their own row.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spacing } from '@/theme/tokens';

/** Round progress shown as a segmented bar in the HUD centre. */
export interface SessionProgress {
  /** Completed units (rounds answered). */
  value: number;
  /** Total units in the session. */
  total: number;
}

export interface SessionHeaderProps {
  children?: React.ReactNode;
  /** Round label, e.g. `Round 3 of 12`. */
  round?: string;
  /** Session progress; renders the segmented centre bar when provided. */
  progress?: SessionProgress;
  /** Formatted score, rendered as the HUD's right-hand metric. */
  score?: string;
  /** Rendered at the right edge (the pause control). */
  trailing?: React.ReactNode;
}

/**
 * HUD row. The score is the only numeric emphasis; the round label and the
 * progress bar carry position without shouting.
 */
export function SessionHeader({ children, round, progress, score, trailing }: SessionHeaderProps) {
  if (children !== undefined && round === undefined && score === undefined) {
    return <View style={styles.legacyRow}>{children}</View>;
  }

  return (
    <View style={styles.row}>
      {round !== undefined ? (
        <ThemedText type="label" themeColor="textSecondary" numberOfLines={1} style={styles.round}>
          {round}
        </ThemedText>
      ) : null}

      {progress !== undefined && progress.total > 0 ? (
        <View style={styles.progress}>
          <ProgressBar
            value={Math.min(progress.value / progress.total, 1)}
            height={6}
            testID="session-progress"
            accessibilityLabel={`${progress.value} of ${progress.total} rounds complete`}
          />
        </View>
      ) : null}

      {score !== undefined ? (
        <ThemedText type="numeral" themeColor="text" numberOfLines={1}>
          {score}
        </ThemedText>
      ) : null}

      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  // Games that still pass their own children keep the previous wrap-friendly
  // layout; adopting the structured props is what unlocks the HUD.
  legacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  round: {
    flexShrink: 1,
  },
  progress: {
    flex: 1,
    minWidth: 64,
  },
});
