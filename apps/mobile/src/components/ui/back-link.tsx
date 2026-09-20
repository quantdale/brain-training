/**
 * `BackLink` — the pushed-route back affordance.
 *
 * Every pushed screen needs the same control: a chevron plus a short label
 * that is comfortably tappable. Hand-rolled versions (a bare text node inside
 * a pressable) measured 20 dp tall in the campaign-024 hierarchy audit, i.e.
 * below the 44 dp floor even though the touch slop compensated.
 *
 * This primitive makes the target real rather than virtual: a 44 dp row with
 * the label vertically centred, a chevron, and an explicit accessible name.
 */

import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/theme/tokens';
import { Tappable } from './tappable';

/** Props accepted by {@link BackLink}. */
export interface BackLinkProps {
  onPress: () => void;
  /** Visible label; defaults to `Back`. */
  label?: string;
  /** Accessible name; defaults to `Go back`. */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Pure empty-stack decision (unit-tested): go back when the stack allows
 * it, otherwise fall back to a route that is always reachable.
 */
export function backOrFallback(canGoBack: boolean): 'back' | 'replace' {
  return canGoBack ? 'back' : 'replace';
}

/**
 * Back with an empty-stack fallback for cold deep-link landings (058): a
 * bare `router.back()` no-ops when nothing is on the stack, stranding the
 * user. Normal pushed flows are byte-identical (`canGoBack() === true`).
 */
export function useSafeBack(fallbackHref: Href): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (backOrFallback(router.canGoBack()) === 'back') {
      router.back();
    } else {
      router.replace(fallbackHref);
    }
  }, [router, fallbackHref]);
}

export function BackLink({
  onPress,
  label = 'Back',
  accessibilityLabel = 'Go back',
  testID,
}: BackLinkProps) {
  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={styles.row}
      // The row is already 44 dp tall, so the press feedback only needs to
      // read as movement, not as a size change.
      pressedScale={0.97}>
      <ThemedText type="bodySmall" themeColor="accentText">
        ‹ {label}
      </ThemedText>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingRight: Spacing.three,
    // A chevron-plus-label row reads as a control once it has a hit area; the
    // wrapper keeps its natural width so headers stay left-aligned.
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
