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
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { testId } from '@/sdk';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Radii, Spacing } from '@/constants/theme';

export interface TutorialFrameProps extends PropsWithChildren {
  gameId: string;
  /** Long interactive steps need a bounded viewport rather than clipped choices. */
  scrollable?: boolean;
}

export function TutorialFrame({ gameId, children, scrollable = false }: TutorialFrameProps) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  return (
    <ThemedView type="surface" style={styles.card} testID={testId(gameId, 'tutorial')}>
      <View style={[styles.rail, { backgroundColor: theme.accent }]} />
      {/* An explicit height avoids the old auto-height ScrollView measuring
          cycle. Short tutorials keep intrinsic sizing; long steps can scroll
          independently inside the scrolling route, including at 2× text. */}
      {scrollable ? (
        <ScrollView testID={testId(gameId, 'tutorial-scroll')}
          style={{ height: Math.min(600, Math.max(120, height - 112)) }}
          // Game routes already scroll through ScreenShell. On Android the
          // inner demo must claim nested vertical drags, including when the
          // route is at its bottom edge, or that ancestor consumes
          // the swipe and leaves the demo's answer boards unreachable.
          nestedScrollEnabled
          contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : <View style={styles.body}>{children}</View>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.medium,
    // Keeps the full-bleed rail clipped to the card's corners.
    overflow: 'hidden',
    // Intrinsic steps must contribute their full height to ScreenShell's
    // scroll range. A percent height cap plus overflow:hidden clips the last
    // controls at large font scales. Long interactive demos retain their
    // bounded, nested ScrollView above (Campaign 077).
  },
  rail: {
    height: 3,
  },
  body: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
