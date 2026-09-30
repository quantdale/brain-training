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

import { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
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

/**
 * A back affordance whose LABEL names where back actually goes (Change 072
 * §4.4).
 *
 * The problem this solves is specific to a screen with several entry paths.
 * `game-detail/[id]` is pushed from Games, from Progress and from Home. Its
 * affordance said "Back to Games" unconditionally, so on a Progress or Home
 * entry the control DID go back to Progress or Home while announcing — to a
 * screen reader and to a sighted user scanning the label — that it returns to
 * Games. A label that is confidently wrong is worse than no label: it is
 * information the user will act on.
 *
 * The resolution is the same fact the fallback already depends on:
 * - when the stack can go back, back is what happens, and back goes to wherever
 *   the user came from — so the label is the honest, path-independent "Back";
 * - when it cannot (a cold deep link), the fallback destination is used, and
 *   the label NAMES it, because in that case it is knowable and true.
 *
 * `useSafeBack` is deliberately left alone: 42 game screens use it, and none of
 * them has a multi-entry ambiguity to solve.
 */
export function useSafeBackAffordance(
  fallbackHref: Href,
  labels: { back: string; fallback: string },
): { onPress: () => void; label: string; accessibilityLabel: string } {
  const router = useRouter();
  const canGoBack = router.canGoBack();
  return useMemo(() => {
    return {
      onPress: canGoBack ? () => router.back() : () => router.replace(fallbackHref),
      label: canGoBack ? labels.back : `${labels.back} to ${labels.fallback}`,
      accessibilityLabel: canGoBack
        ? `Go back`
        : `Go back to ${labels.fallback}`,
    };
  }, [canGoBack, fallbackHref, labels.back, labels.fallback, router]);
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
    minHeight: MIN_TOUCH_TARGET,
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
