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

/** True when the device requests reduced motion; false otherwise. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (active) {
        setReduced(value);
      }
    });
    // Seed the current value (best-effort; older platforms resolve async).
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) {
        setReduced(value);
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
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
