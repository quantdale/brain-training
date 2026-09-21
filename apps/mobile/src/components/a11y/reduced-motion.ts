/**
 * Reduced-motion plumbing (shared).
 *
 * Single subscription implementation for the whole app; `game-ui`'s
 * `usePrefersReducedMotion` re-exports this hook so existing game imports
 * keep working. New surfaces should import from here (or the
 * `@/components/a11y` barrel).
 *
 * React Native's built-in `useReducedMotion` is not available in every RN
 * version shipped by this project, so we subscribe to `AccessibilityInfo`
 * directly. Components gate non-essential decorative motion (pulsing/scale/
 * rotation flourishes) behind the flag and fall back to a static presentation.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Module-level shared store (hardening packet, finding 2).
 *
 * The hook used to create an `AccessibilityInfo` subscription + async native
 * seed call per instance — the Games screen alone mounts dozens of controls
 * that gate motion, so a single screen issued dozens of redundant native
 * calls. One subscription and one seed now serve every consumer: the store is
 * updated on change, late consumers read the latest value, and only a
 * test-only reset tears the native subscription down.
 */
const listeners = new Set<(value: boolean) => void>();
let prefersReducedMotion = false;
let nativeSubscription: { remove: () => void } | null = null;
let nativeSeedRequested = false;

/** Update the shared value and notify every mounted consumer. */
function publish(value: boolean): void {
  prefersReducedMotion = value;
  listeners.forEach((listener) => listener(value));
}

/** Lazily open the one native subscription + seed read (idempotent). */
function ensureNativeSubscription(): void {
  if (nativeSubscription === null) {
    nativeSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      publish,
    );
  }
  if (!nativeSeedRequested) {
    nativeSeedRequested = true;
    // Seed the current value (best-effort; older platforms resolve async).
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => publish(value))
      .catch(() => undefined);
  }
}

/** True when the device requests reduced motion; false otherwise. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    listeners.add(setReduced);
    ensureNativeSubscription();
    return () => {
      listeners.delete(setReduced);
    };
  }, []);

  return reduced;
}

/**
 * Test-only: drop the shared native subscription and reset the store so each
 * suite starts from a clean, unsubscribed state.
 */
export function resetReducedMotionStoreForTests(): void {
  nativeSubscription?.remove();
  nativeSubscription = null;
  nativeSeedRequested = false;
  prefersReducedMotion = false;
  listeners.clear();
}

/**
 * Pure selector: the animated presentation when motion is OK, the static
 * fallback otherwise. Keeps call sites declarative:
 * `const scale = motionValue(reduced, pressed ? 0.96 : 1, 1);`
 */
export function motionValue<T>(reducedMotion: boolean, animated: T, reduced: T): T {
  return reducedMotion ? reduced : animated;
}

/**
 * Duration helper: decorative durations collapse to 0 under reduced motion
 * (instant state change instead of a transition). Functional durations —
 * timers that gate gameplay — must NOT pass through this; only flourish
 * lengths.
 */
export function reduceDuration(reducedMotion: boolean, durationMs: number): number {
  return reducedMotion ? 0 : durationMs;
}
