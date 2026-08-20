/**
 * usePrefersReducedMotion — shared reduced-motion preference (task 07).
 *
 * React Native's built-in `useReducedMotion` is not available in every RN
 * version shipped by this project, so we subscribe to `AccessibilityInfo`
 * directly. Game components gate non-essential decorative motion (pulsing/
 * scale/rotation flourishes) behind this flag and fall back to a static
 * presentation when the device requests reduced motion.
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
