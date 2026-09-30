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
import { MIN_TOUCH_TARGET } from '@/components/a11y';
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
    minTarget = MIN_TOUCH_TARGET,
    hitSlop,
    renderedSize,
    onPressIn,
    onPressOut,
    disabled,
    accessibilityRole = 'button',
    accessibilityState,
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

  // 071 — WHY THIS IS DESTRUCTURED AND MERGED EXPLICITLY.
  //
  // The previous code computed the state here and then spread `{...rest}`
  // AFTER it. Because `accessibilityState` was still inside `rest`, that spread
  // replaced the computed value with the caller's RAW state, so the merge line
  // above it was dead code — the result depended on prop ORDER rather than on
  // the intent.
  //
  // MEASURED behaviour of each shape (2026-09-30, `Tappable` under test):
  //   caller `{ disabled: true }` on an ENABLED control
  //     before: { disabled: true }   <- announced as unpressable; WRONG
  //     after:  { disabled: false }  <- the component's own state wins
  //   caller `{ selected: true }` on a DISABLED control
  //     before: { selected: true, disabled: true }
  //     after:  { selected: true, disabled: true }  (identical)
  //
  // The second case is worth recording precisely: the audit reported that a
  // caller's state could ERASE `disabled`, and measurement shows it could not —
  // react-native's `Pressable` re-derives `accessibilityState.disabled` from its
  // own `disabled` prop, which masked that direction. The direction that was
  // genuinely broken is the one above: a caller could mark a pressable control
  // as disabled to the screen reader. Relying on that masking is a worse
  // position than owning the merge, so the merge is now explicit either way.
  //
  // Two rules make the ordering unrepeatable:
  // 1. `accessibilityState` is destructured OUT, so the rest-spread physically
  //    cannot contain it.
  // 2. The rest-spread comes FIRST, so any prop a future edit forgets to
  //    destructure loses to the explicit ones rather than silently winning.
  //
  // `disabled` is applied AFTER the caller's state and cannot be overridden: a
  // component's own accessibility truth is not the caller's to erase. A caller
  // that needs a different `disabled` must change `disabled`.
  const mergedAccessibilityState = {
    ...accessibilityState,
    disabled: disabled === true,
  };

  return (
    <AnimatedPressable
      {...rest}
      ref={ref}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={mergedAccessibilityState}
      hitSlop={resolvedHitSlop}
      onPressIn={() => {
        if (disabled) return;
        if (feedback !== false) {
          liveAudioHaptics.feedback(feedback);
        }
        handlePressIn();
      }}
      onPressOut={handlePressOut}
      style={[style, pressed && pressedStyle, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
});

/** Style helpers shared by kit surfaces that need the same pressed fill. */
export const pressStyles = StyleSheet.create({
  dimmed: { opacity: 0.72 },
});
