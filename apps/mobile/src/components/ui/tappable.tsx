/**
 * `Tappable` — the one pressable every interactive surface in the app is built
 * from.
 *
 * It exists so the interaction contract cannot drift per screen:
 *   - press feedback (scale + pressed styling) on every control,
 *   - a sensory-gated selection haptic,
 *   - a ≥44 dp interaction area even for visually small controls,
 *   - reduced-motion compliance,
 *   - an accessibility role by default.
 *
 * Callers pass layout styles; `pressedStyle` receives the pressed fill/border.
 */

import { forwardRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type Insets,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { hitSlopToTouchTarget } from '@/platform/touch';
import { liveAudioHaptics, type FeedbackEvent } from '@/sdk';
import { MinTouchTarget } from '@/theme/tokens';
import { PRESS_SCALE, usePressFeedback } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Props accepted by {@link Tappable}; `style` is a plain (non-function) style. */
export interface TappableProps
  extends Omit<PressableProps, 'style' | 'children' | 'onPressIn' | 'onPressOut' | 'hitSlop'> {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Style merged in while the surface is held down. */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Scale while pressed; defaults to {@link PRESS_SCALE.surface}. */
  pressedScale?: number;
  /**
   * Feedback event dispatched on press-in (sound + haptic, both gated by the
   * user's sensory settings). `false` disables feedback entirely.
   */
  feedback?: FeedbackEvent | false;
  /** Minimum interaction edge in dp; smaller visuals expand via `hitSlop`. */
  minTarget?: number;
  /** Explicit hit slop (dp) overriding {@link minTarget} enforcement. */
  hitSlop?: number | Insets;
  /** Rendered size used to compute hit-slop expansion (defaults to minTarget). */
  renderedSize?: number;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
}

/**
 * Pressable surface with the shared interaction contract. Forwards its ref to
 * the underlying `Pressable` so callers can request accessibility focus.
 */
export const Tappable = forwardRef<React.ComponentRef<typeof Pressable>, TappableProps>(function Tappable(
  {
    children,
    style,
    pressedStyle,
    pressedScale = PRESS_SCALE.surface,
    feedback = 'tap',
    minTarget = MinTouchTarget,
    hitSlop,
    renderedSize,
    onPressIn,
    onPressOut,
    disabled,
    accessibilityRole = 'button',
    ...rest
  },
  ref,
) {
  const { animatedStyle, onPressIn: handlePressIn, onPressOut: handlePressOut, pressed } = usePressFeedback({
    pressedScale,
    enabled: !disabled,
    onPressIn,
    onPressOut,
  });

  // Prefer the explicit slop; otherwise expand the surface to `minTarget`.
  const resolvedHitSlop = hitSlop ?? hitSlopToTouchTarget(renderedSize ?? minTarget) ?? undefined;

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: disabled === true, ...(rest.accessibilityState ?? {}) }}
      hitSlop={resolvedHitSlop}
      onPressIn={() => {
        if (disabled) return;
        if (feedback !== false) {
          liveAudioHaptics.feedback(feedback);
        }
        handlePressIn();
      }}
      onPressOut={handlePressOut}
      style={[style, pressed && pressedStyle, animatedStyle]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
});

/** Style helpers shared by kit surfaces that need the same pressed fill. */
export const pressStyles = StyleSheet.create({
  dimmed: { opacity: 0.72 },
});
