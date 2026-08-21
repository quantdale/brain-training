/**
 * GameButton — shared generic game button (task 10.2).
 *
 * Extracted from 20 identical per-game copies (e.g. `memory/components/button.tsx`).
 * Keep mechanics out: this is a dumb pressable with themed variants only.
 * QA/testID support via explicit `testID` prop (callers compose with `testId(gameId, ...)`).
 *
 * Touch-target contract: both variants meet the shared 44pt minimum from
 * `@/components/a11y/touch-target` (single source of truth for shell + games).
 * React 19 ref-as-prop: callers may pass `ref` to drive screen-reader focus
 * (see `@/components/a11y/focus`).
 */
import { memo, type Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '@/components/a11y/touch-target';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const filled = variant !== 'secondary';
  const backgroundColor = filled ? (variant === 'danger' ? theme.danger : theme.accent) : 'transparent';
  const foregroundColor = filled ? '#FFFFFF' : theme.accent;
  const borderColor = filled ? backgroundColor : theme.accent;

  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected, busy: false }}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor, opacity: pressed || disabled ? 0.6 : 1 },
        small && styles.small,
      ]}>
      <ThemedText type={small ? 'caption' : 'smallBold'} style={{ color: foregroundColor }}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
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
  small: {
    minWidth: 96,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: Spacing.oneHalf,
    paddingHorizontal: Spacing.three,
  },
});
