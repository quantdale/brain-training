/**
 * Shared motion plumbing for the UI kit.
 *
 * Two contracts everything in the app relies on:
 *   1. Motion never delays input — presses fire immediately, animation only
 *      draws what already happened.
 *   2. Decorative motion collapses under the platform's reduced-motion
 *      preference (`usePrefersReducedMotion`), which is why every helper takes
 *      the flag and returns a static presentation when it is set.
 *
 * Implemented on RN `Animated` with the native driver so transform/opacity
 * work stays off the JS thread during list scrolling and dense screens.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';

import { usePrefersReducedMotion } from '@/components/a11y/reduced-motion';
import { Motion, Springs } from '@/theme/tokens';

/** Press-scale values by interaction class. */
export const PRESS_SCALE = {
  /** List rows, cards, chips. */
  surface: 0.97,
  /** Board cells, tiles and other dense grids. */
  cell: 0.94,
  /** Full-width hero CTAs — barely perceptible, still felt. */
  cta: 0.98,
} as const;

/** Options for {@link usePressFeedback}. */
export interface PressFeedbackOptions {
  /** Scale applied while pressed. */
  pressedScale?: number;
  /** When false the scale animation is skipped entirely. */
  enabled?: boolean;
  /** Optional press-in hook (e.g. to set local pressed state). */
  onPressIn?: () => void;
  /** Optional press-out hook. */
  onPressOut?: () => void;
}

/** Animated style + handlers to spread onto a pressable surface. */
export interface PressFeedback {
  animatedStyle: Animated.WithAnimatedObject<ViewStyle>;
  onPressIn: () => void;
  onPressOut: () => void;
  /** True while the surface is held down (drives pressed-state styling). */
  pressed: boolean;
}

/**
 * Press physics for a surface: scale in fast, settle back with a short spring,
 * and report the pressed flag so callers can swap fill/border at the same time.
 * Under reduced motion the value stays at 1 and only `pressed` changes.
 */
export function usePressFeedback(options: PressFeedbackOptions = {}): PressFeedback {
  const { pressedScale = PRESS_SCALE.surface, enabled = true, onPressIn, onPressOut } = options;
  const reducedMotion = usePrefersReducedMotion();
  // Lazy state (not a ref) so the animated value is created once but never
  // read through a ref during render.
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState(false);
  const animate = enabled && !reducedMotion;

  // 061: track drivers so a new press stops the in-flight one (rapid
  // taps must not accumulate drivers) and unmount stops everything. A
  // mid-press re-render (e.g. the press opens a sheet and the surface
  // unmounts) must not leave the surface stuck at the pressed scale.
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const runDriver = (animation: Animated.CompositeAnimation) => {
    animRef.current?.stop();
    animRef.current = animation;
    animation.start(() => {
      if (animRef.current === animation) {
        animRef.current = null;
      }
    });
  };
  useEffect(() => {
    return () => {
      animRef.current?.stop();
      animRef.current = null;
      scale.setValue(1);
    };
  }, [scale]);

  const handlePressIn = () => {
    setPressed(true);
    if (animate) {
      runDriver(
        Animated.timing(scale, {
          toValue: pressedScale,
          duration: Motion.press,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      );
    }
    onPressIn?.();
  };

  const handlePressOut = () => {
    setPressed(false);
    if (animate) {
      runDriver(
        Animated.spring(scale, {
          toValue: 1,
          ...Springs.press,
          useNativeDriver: true,
        }),
      );
    }
    onPressOut?.();
  };

  return {
    animatedStyle: { transform: [{ scale }] },
    onPressIn: handlePressIn,
    onPressOut: handlePressOut,
    pressed,
  };
}

/** Options for {@link useEntranceTransition}. */
export interface EntranceOptions {
  /** Position in a staggered group; multiplied by `Motion.stagger`. */
  index?: number;
  /** Set false for surfaces that must appear instantly (e.g. above the fold). */
  enabled?: boolean;
}

/**
 * Fade + short rise used when a screen's content mounts. The stagger keeps a
 * dense screen from arriving as one block without ever delaying interaction:
 * every child is mounted and hit-testable from the first frame.
 */
export function useEntranceTransition(options: EntranceOptions = {}): Animated.WithAnimatedObject<ViewStyle> {
  const { index = 0, enabled = true } = options;
  const reducedMotion = usePrefersReducedMotion();
  const [progress] = useState(() => new Animated.Value(enabled && !reducedMotion ? 0 : 1));

  useEffect(() => {
    if (!enabled || reducedMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: Motion.entrance,
      delay: Math.min(index, 6) * Motion.stagger,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enabled, index, progress, reducedMotion]);

  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [Motion.travel, 0],
        }),
      },
    ],
  };
}

/**
 * Value that animates toward `target` whenever it changes — used by meters and
 * rings so a progress change reads as movement rather than a jump.
 *
 * The animated node is driven on the JS thread (width/percentage cannot use the
 * native driver); callers that only need the visual fill should map it to a
 * `scaleX` transform, which IS native-driver friendly. Pass
 * `withNumericValue` when a component needs the interpolated number for text
 * or accessibility, and it will re-render per frame — keep that to small
 * subtrees.
 */
export function useAnimatedProgress(
  target: number,
  options: { duration?: number; enabled?: boolean; withNumericValue?: boolean } = {},
): { value: Animated.Value; numericValue: number | null } {
  const { duration = Motion.entrance, enabled = true, withNumericValue = false } = options;
  const reducedMotion = usePrefersReducedMotion();
  const [animated] = useState(() => new Animated.Value(target));
  const [numericValue, setNumericValue] = useState<number | null>(withNumericValue ? target : null);
  // The initial Animated.Value already equals `target`, so a mount-time timing
  // run would only burn frames (and re-render `withNumericValue` consumers)
  // without any visual change. Only animate genuine transitions.
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!withNumericValue) return;
    const subscription = animated.addListener(({ value }) => setNumericValue(value));
    return () => animated.removeListener(subscription);
  }, [animated, withNumericValue]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      animated.setValue(target);
      return;
    }
    if (!enabled || reducedMotion) {
      animated.setValue(target);
      return;
    }
    const animation = Animated.timing(animated, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animated, duration, enabled, reducedMotion, target, withNumericValue]);

  // Under reduced motion the value is the target by definition, so the mirror
  // is derived rather than written back through state inside an effect.
  const mirroredValue = !enabled || reducedMotion ? target : numericValue;
  return { value: animated, numericValue: withNumericValue ? mirroredValue : null };
}

/**
 * Fire-and-forget animation with unmount safety (061). Starts the driver
 * and returns an effect cleanup that stops it, so fast navigation (Done /
 * Next / dismiss mid-flight) cannot orphan drivers writing to unmounted
 * values. Effect authors use it as:
 * `useEffect(() => launchAnimation(Animated.timing(...)), [...])`.
 */
export function launchAnimation(animation: Animated.CompositeAnimation): () => void {
  animation.start();
  return () => animation.stop();
}
