/**
 * `Toast` — non-blocking confirmation surface.
 *
 * Module-level queue plus `showToast()` and `<ToastHost />`. Toasts queued
 * with no host mounted wait in the queue and flush on mount, so callers never
 * need a provider. The host shows one toast at a time above the bottom inset,
 * auto-dismissing after `Motion.celebration * 4`; the container is
 * `pointerEvents="none"` and the card is a polite live region, so toasts
 * never trap input or interrupt assistive tech.
 */

import { useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Elevation, Motion, Radii, Spacing, type ThemeColor } from '@/theme/tokens';
import { RADIUS_CAP } from './radius';

/** Options accepted by {@link showToast}. */
export interface ToastOptions {
  title: string;
  detail?: string;
  tone?: ThemeColor;
  testID?: string;
}

interface QueuedToast extends ToastOptions {
  id: number;
}

let nextToastId = 1;
const toastQueue: QueuedToast[] = [];
const toastListeners = new Set<() => void>();

/**
 * Max toasts held for a not-yet-mounted host (061). Queued bursts must
 * not accumulate unboundedly while no host exists to drain them; beyond
 * the cap the oldest unshown toast is dropped. (Bootstrap itself never
 * toasts — this is cheap insurance for failure-burst paths.)
 */
export const MAX_QUEUED_TOASTS = 8;

/** Enqueue a toast; flushed by the mounted host, or held until one mounts. */
export function showToast(options: ToastOptions): void {
  toastQueue.push({ ...options, id: nextToastId++ });
  while (toastQueue.length > MAX_QUEUED_TOASTS) {
    toastQueue.shift();
  }
  toastListeners.forEach((notify) => notify());
}

/** Empties the module queue without rendering. Test isolation only. */
export function resetToastQueueForTests(): void {
  toastQueue.length = 0;
}

/** Queued-toast titles, oldest first. Test isolation only. */
export function toastQueueTitlesForTests(): readonly string[] {
  return toastQueue.map((toast) => toast.title);
}

// Bounded visibility from the celebration token: long enough to read,
// never long enough to trap attention.
const TOAST_VISIBLE_MS = Motion.celebration * 4;

/** Renders the active toast. Mount at most once, near the app root. */
export function ToastHost({ testID }: { testID?: string }) {
  const theme = useTheme();
  // Defensive context read (not the hook) so an isolated harness without a
  // provider still renders instead of throwing.
  const insets = useContext(SafeAreaInsetsContext);
  const [active, setActive] = useState<QueuedToast | null>(null);
  // Ref mirror: the pump must read the current toast without re-subscribing,
  // and queue shifts stay out of state updaters (StrictMode double-invokes
  // updaters, which would drop toasts).
  const activeRef = useRef<QueuedToast | null>(null);
  const show = (toast: QueuedToast | null) => {
    activeRef.current = toast;
    setActive(toast);
  };

  useEffect(() => {
    const pump = () => {
      if (activeRef.current !== null) return;
      const next = toastQueue.shift();
      if (next !== undefined) show(next);
    };
    toastListeners.add(pump);
    pump();
    return () => {
      toastListeners.delete(pump);
    };
  }, []);

  useEffect(() => {
    if (active === null) return;
    const timer = setTimeout(() => {
      show(toastQueue.shift() ?? null);
    }, TOAST_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  if (active === null) return null;
  const tone = active.tone ?? 'success';

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[styles.host, { bottom: (insets?.bottom ?? 0) + Spacing.three }]}>
      <View
        testID={active.testID ?? 'toast'}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={active.detail ? `${active.title}. ${active.detail}` : active.title}
        style={[
          styles.card,
          { backgroundColor: theme.surfaceRaised, ...Elevation.overlay },
        ]}>
        <View style={[styles.dot, { backgroundColor: theme[tone] }]} />
        <View style={styles.texts}>
          <ThemedText type="label" numberOfLines={2}>
            {active.title}
          </ThemedText>
          {active.detail ? (
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
              {active.detail}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
    padding: Spacing.three,
    borderRadius: Radii.large,
  },
  dot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: RADIUS_CAP,
  },
  texts: {
    flex: 1,
    flexShrink: 1,
  },
});
