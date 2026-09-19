/**
 * TutorialFrame — shared tutorial step wrapper (task 10.2).
 *
 * Games keep their own tutorial content/mechanics; this component just
 * provides the consistent shell so per-game copies do not each reinvent the
 * same surface + testID wrapper. Campaign 055 restyles it as a game reveal:
 * the panel radius drops to `Radii.medium` (shape role: overlay/sheet scale
 * without the giant-rounded-card feel) and a top accent rail marks the
 * surface as the game's own voice.
 */
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Radii, Spacing } from '@/constants/theme';

export interface TutorialFrameProps extends PropsWithChildren {
  gameId: string;
}

export function TutorialFrame({ gameId, children }: TutorialFrameProps) {
  const theme = useTheme();
  return (
    <ThemedView type="surface" style={styles.card} testID={testId(gameId, 'tutorial')}>
      <View style={[styles.rail, { backgroundColor: theme.accent }]} />
      {/* Plain body: GameHost anchors this card as a bottom-anchored overlay
          with generous viewport headroom, so intrinsic sizing is safe. An
          internal ScrollView here created an auto-height measuring cycle that
          collapsed the last button's layout (device-verified: skip rendered
          with negative height and taps never landed). */}
      <View style={styles.body}>{children}</View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.medium,
    // Keeps the full-bleed rail clipped to the card's corners.
    overflow: 'hidden',
    // Pure safety valve — observed tutorials stay far below this. Keeps a
    // pathological future step from pushing controls off-screen.
    maxHeight: '88%',
  },
  rail: {
    height: 3,
  },
  body: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
