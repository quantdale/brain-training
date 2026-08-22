/**
 * PauseOverlay — shared opaque pause surface (task 10.2).
 *
 * Canonical pause contract: see `@/sdk/pause` (`createPauseOverlaySpec`).
 * The overlay is fully opaque so no challenge pixel peeks through; the
 * parent screen hides its content from the accessibility tree while
 * paused (importantForAccessibility / accessibilityElementsHidden).
 *
 * Theme-aware, generic: callers supply `gameId`, `onResume`, `onQuit`.
 *
 * Reachability contract (campaign 009 + 011 device findings):
 * - The root must stay a NON-grouping, unlabeled container. Adding
 *   `accessibilityLabel` (+ `importantForAccessibility="yes"`) turns the
 *   overlay into a single Android a11y leaf that absorbs Resume/Quit —
 *   uiautomator then sees a childless "Paused." node and the session becomes
 *   unresumable (reproduced on 3 games in the 011 catalog run). The paused
 *   state is announced imperatively instead, and the SR cursor is parked on
 *   Resume so TalkBack users land inside the overlay.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { createPauseOverlaySpec, testId } from '@/sdk';
import { announce } from '@/components/a11y/announcements';
import { requestAccessibilityFocus } from '@/components/a11y/focus';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GameButton } from './game-button';

export interface PauseOverlayProps {
  gameId: string;
  onResume: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ gameId, onResume, onQuit }: PauseOverlayProps) {
  const theme = useTheme();
  const spec = createPauseOverlaySpec(gameId);
  const resumeRef = useRef<View | null>(null);

  useEffect(() => {
    // No live region on the root: a labeled/grouping root collapses the
    // subtree into one a11y leaf on Android (see contract above). Announce
    // imperatively on every platform instead.
    announce(spec.accessibilityLabel);
    requestAccessibilityFocus(resumeRef);
  }, [spec.accessibilityLabel]);

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.background }]}
      testID={spec.testID}
      importantForAccessibility="auto">
      <ThemedText type="headline" testID={testId(gameId, 'pause-title')}>
        Paused
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        The challenge is hidden and the timers are frozen.
      </ThemedText>
      <View style={styles.actions}>
        <GameButton ref={resumeRef} testID={testId(gameId, 'resume')} label="Resume" onPress={onResume} />
        <GameButton testID={testId(gameId, 'quit')} label="Quit" variant="secondary" onPress={onQuit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radii.large,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
});
