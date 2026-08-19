/**
 * TutorialFrame — shared tutorial step wrapper (task 10.2).
 *
 * Games keep their own tutorial content/mechanics; this component just
 * provides the consistent card shell so per-game copies do not each
 * reinvent the same surface + testID wrapper.
 */
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

export interface TutorialFrameProps extends PropsWithChildren {
  gameId: string;
}

export function TutorialFrame({ gameId, children }: TutorialFrameProps) {
  return (
    <ThemedView type="surface" style={styles.card} testID={testId(gameId, 'tutorial')}>
      <View style={styles.body}>{children}</View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  body: {
    gap: Spacing.three,
  },
});
