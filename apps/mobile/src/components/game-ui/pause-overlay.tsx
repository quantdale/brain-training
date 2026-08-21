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
 * Reachability contract (campaign 009 device findings, grid-nav harness):
 * - The root is intentionally NOT `accessible` (grouping would collapse
 *   Resume/Quit into one unfocusable blob) and explicitly opts back INTO the
 *   Android tree (`importantForAccessibility="yes"`) so it stays reachable
 *   even under an ancestor's hiding attribute.
 * - On show, the paused state is announced and the screen-reader cursor is
 *   parked on Resume, so TalkBack users land inside the overlay instead of
 *   stranded behind it; a polite live region backs the announcement on
 *   Android where imperative announces can be dropped.
 */
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

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
    // Android announces via the root's polite live region (below); firing the
    // imperative announce there too would double-speak. iOS/web have no live
    // region, so they get the imperative announcement.
    if (Platform.OS !== 'android') {
      announce(spec.accessibilityLabel);
    }
    requestAccessibilityFocus(resumeRef);
  }, [spec.accessibilityLabel]);

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.background }]}
      testID={spec.testID}
      accessibilityLabel={spec.accessibilityLabel}
      accessibilityLiveRegion="polite"
      importantForAccessibility="yes"
      accessibilityViewIsModal>
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
