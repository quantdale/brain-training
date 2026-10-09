/**
 * SessionHeader — the in-session instrument strip shared by every game screen.
 *
 * Reference pattern (Brilliant/Moises, `PATTERNS-PLAY` 3–4): one compact strip —
 * the game's own round/exit affordance on the leading side, progress in the
 * middle, score at the trailing end, and the pause control at the edge. Never
 * a second HUD line competing with the board.
 *
 * Campaign 055: the row is framed as a paper instrument strip (surface +
 * hairline + `Radii.medium`) so gameplay chrome reads as hardware under the
 * mechanic stage rather than another card. Semantics are unchanged.
 *
 * One implementation, no "legacy vs structured" split: a game-supplied
 * `children` node takes the leading slot (so a custom round chip keeps its own
 * testID), and every other slot renders whenever it is provided. A game that
 * passes nothing but children still gets the host's pause control, because
 * dropping it would strand the player mid-session.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ProgressBar } from '@/components/ui/progress-bar';
import { HAIRLINE } from '@/components/ui/radius';
import { useTheme } from '@/hooks/use-theme';
import { Radii, Spacing } from '@/theme/tokens';

/** Round progress shown as a segmented bar in the HUD centre. */
export interface SessionProgress {
  /** Completed units (rounds answered). */
  value: number;
  /** Total units in the session. */
  total: number;
}

/** Change 076 (lock section 1): when the strip sits on the immersive stage
 *  panel it reads in `stageInk` with translucent white separators instead of
 *  the paper instrument styling. */
export interface SessionHeaderProps {
  /** Render the strip in stage (charcoal) presentation. */
  onStage?: boolean;
  /** Custom leading content (round chip, exit control). Wins over `round`. */
  children?: React.ReactNode;
  /** Plain round label, e.g. `Round 3 of 12`. */
  round?: string;
  /** Session progress; renders the centre bar when provided. */
  progress?: SessionProgress;
  /** Formatted score, rendered as the HUD's right-hand metric. */
  score?: string;
  /**
   * testID for the score metric. Game-screen suites and the automation harness
   * address `<gameId>.score`, so the host passes it through.
   */
  scoreTestID?: string;
  /** Rendered at the right edge (the pause control). */
  trailing?: React.ReactNode;
}

/**
 * HUD strip. The score is the only numeric emphasis; the round label and the
 * progress bar carry position without shouting.
 */
export function SessionHeader({
  onStage = false,
  children,
  round,
  progress,
  score,
  scoreTestID,
  trailing,
}: SessionHeaderProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.strip,
        {
          backgroundColor: onStage ? theme.stageFill : theme.surface,
          borderColor: onStage ? theme.stageBorder : theme.border,
        },
      ]}>
      {/* 076-f defect repair (reproduced on device): the single wrapping row put
          the pause control wherever the wrap happened to land it - trailing when
          the slots fit, and at the START of the next instrument line when they
          did not. The controller observed it "moves between top-left and
          top-right" across trials of the same game. Splitting the strip into a
          wrapping INFO zone plus a pinned TRAILING zone keeps Campaign 055P's
          anti-clipping wrap (the info slots still wrap instead of overflowing)
          while the pause control stays anchored at one edge for the whole
          session. */}
      <View style={styles.info}>
        {children !== undefined ? (
          children
        ) : round !== undefined ? (
          <ThemedText
            type="label"
            themeColor={onStage ? 'stageInk' : 'textSecondary'}
            numberOfLines={1}
            style={styles.round}>
            {round}
          </ThemedText>
        ) : null}

        {progress !== undefined && progress.total > 0 ? (
          <View style={styles.progress}>
            <ProgressBar
              value={Math.min(progress.value / progress.total, 1)}
              height={8}
              tone="success"
              testID="session-progress"
              accessibilityLabel={`${progress.value} of ${progress.total} rounds complete`}
            />
          </View>
        ) : null}

        {score !== undefined ? (
          <ThemedText
            type="numeral"
            themeColor={onStage ? 'stageInk' : 'text'}
            numberOfLines={1}
            testID={scoreTestID}>
            {score}
          </ThemedText>
        ) : null}
      </View>

      {trailing !== undefined ? (
        <View style={styles.trailing} testID="session-header-trailing">
          {trailing}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.twoHalf,
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.oneHalf,
    borderRadius: Radii.medium,
    borderWidth: HAIRLINE,
  },
  // Campaign 055P's anti-clipping wrap lives here now, on the INFO slots only:
  // at compact widths or a 2x system font scale the four HUD slots exceed the
  // strip, and wrapping moves the overflow to a second instrument line instead
  // of pushing a control off-screen.
  info: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  // The pause control must never wrap away from its edge and never compress:
  // a control whose position shifts mid-session is unfindable by muscle memory
  // and was reported as a defect on device.
  trailing: {
    flexShrink: 0,
    flexGrow: 0,
  },
  round: {
    flexShrink: 1,
  },
  progress: {
    flex: 1,
    minWidth: 64,
  },
});
