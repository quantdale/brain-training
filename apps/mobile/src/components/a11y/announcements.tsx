/**
 * Screen-reader announcement helpers.
 *
 * Two complementary mechanisms, split by platform because they behave
 * differently:
 * - `announce()` — imperative `AccessibilityInfo.announceForAccessibility`.
 *   Fires on iOS/web/Android, but on Android it can be dropped while the
 *   screen is busy, so transient status that MUST be heard uses `LiveRegion`.
 * - `LiveRegion` — an Android live-region node (`accessibilityLiveRegion`)
 *   whose text change triggers the platform announcement; renders nothing on
 *   other platforms (the imperative call already covers them), which avoids
 *   double announcements.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';

/** Announce `message` to the screen reader (polite priority). */
export function announce(message: string): void {
  if (!message) {
    return;
  }
  AccessibilityInfo.announceForAccessibility(message);
}

export interface LiveRegionProps {
  /** Message to announce whenever it changes. */
  message: string;
  /** Assertive interrupts current speech — reserve for result-grade events. */
  assertive?: boolean;
  testID?: string;
}

/**
 * Polite/assertive live-region wrapper. Android gets a real live-region node
 * (1x1, non-interactive); iOS/web get the imperative announcement and no
 * extra node.
 */
export function LiveRegion({ message, assertive = false, testID }: LiveRegionProps) {
  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    if (!isAndroid) {
      announce(message);
    }
  }, [message, isAndroid]);

  if (!isAndroid) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={styles.liveRegion}
      accessibilityLiveRegion={assertive ? 'assertive' : 'polite'}
      testID={testID}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // 1x1 keeps the node in the accessibility tree (zero-size nodes can be
  // pruned) while staying invisible and untouchable.
  liveRegion: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  text: {
    fontSize: 1,
    color: 'transparent',
  },
});
