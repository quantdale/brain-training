/**
 * GameButton — shared generic game button (task 10.2; campaign 023 tactile
 * overhaul).
 *
 * Extracted from 20 identical per-game copies (e.g. `memory/components/button.tsx`).
 * Keep mechanics out: this is a dumb pressable with themed variants only.
 * QA/testID support via explicit `testID` prop (callers compose with `testId(gameId, ...)`).
 *
 * Campaign 023 interaction language:
 * - filled primary/danger CTAs with white bold labels and a card shadow;
 * - outlined secondary on the surface token (never transparent-on-anything);
 * - short bounded press scale (90/140 ms) that is skipped entirely under
 *   reduced motion;
 * - pressed-state color shift (`accentStrong`/`accentSoft`) so feedback is
 *   visible even without motion.
 *
 * Touch-target contract: both variants meet the shared 44pt minimum from
 * `@/components/a11y/touch-target` (single source of truth for shell + games).
 * React 19 ref-as-prop: callers may pass `ref` to drive screen-reader focus
 * (see `@/components/a11y/focus`).
 */
import { memo, useCallback, useRef, type Ref } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '@/components/a11y/touch-target';
import { ThemedText } from '@/components/themed-text';
import { Elevation, Motion, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePrefersReducedMotion } from './use-reduced-motion';

export interface GameButtonProps {
  label: string;
  testID: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
  disabled?: boolean;
  /** Marks the control as the active/selected choice (e.g. a chosen difficulty). */
  selected?: boolean;
  /** Optional screen-reader hint describing the action's result. */
  hint?: string;
  /** Host view ref for focus management (React 19 ref-as-prop). */
  ref?: Ref<View>;
}

export const GameButton = memo(function GameButton({
  label,
  testID,
  onPress,
  variant = 'primary',
  small = false,
  disabled = false,
  selected = false,
  hint,
  ref,
}: GameButtonProps) {
  const theme = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = useCallback(() => {
    if (prefersReducedMotion) {
      return;
    }
    Animated.timing(scale, {
      toValue: 0.96,
      duration: Motion.press,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [prefersReducedMotion, scale]);

  const pressOut = useCallback(() => {
    if (prefersReducedMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: 1,
      duration: Motion.quick,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [prefersReducedMotion, scale]);

  const filled = variant !== 'secondary';
  const baseFill = variant === 'danger' ? theme.danger : theme.accent;
  const pressedFill = variant === 'danger' ? theme.danger : theme.accentStrong;
  const foregroundColor = filled ? '#FFFFFF' : theme.accent;

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <Pressable
        ref={ref}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected, busy: false }}
        accessibilityHint={hint}
        disabled={disabled}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={({ pressed }) => [
          styles.button,
          filled
            ? { backgroundColor: pressed ? pressedFill : baseFill, borderColor: baseFill }
            : {
                backgroundColor: pressed || selected ? theme.accentSoft : theme.surface,
                borderColor: theme.accent,
              },
          filled ? Elevation.card : Elevation.none,
          disabled && styles.disabled,
          small && styles.small,
        ]}>
        <ThemedText
          type={small ? 'caption' : 'smallBold'}
          style={[styles.label, { color: foregroundColor }]}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  button: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    paddingVertical: Spacing.twoHalf,
    paddingHorizontal: Spacing.four,
    minWidth: 120,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  small: {
    minWidth: 96,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: Spacing.oneHalf,
    paddingHorizontal: Spacing.three,
  },
});
