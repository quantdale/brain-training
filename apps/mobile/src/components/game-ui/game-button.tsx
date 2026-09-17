/**
 * GameButton — shared game-chrome button.
 *
 * Extracted from 20 identical per-game copies; it is now a thin adapter over
 * the UI kit's `Button`, so the game chrome inherits the app-wide CTA contract
 * (press feedback, sensory-gated haptics, token colours, 44 dp floor) instead
 * of maintaining a second button implementation. Game modules keep their
 * existing prop API — `variant`, `small`, `selected`, `hint` and the
 * React-19 ref-as-prop focus seam all still work.
 *
 * Mechanics stay out: this is a dumb pressable with themed variants only.
 */
import { memo, type Ref } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui';
import type { ButtonVariant } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';

/** Game-chrome button variants (mapped onto kit variants). */
export type GameButtonVariant = 'primary' | 'secondary' | 'danger';

export interface GameButtonProps {
  label: string;
  /** Optional context line for handoff actions such as the next workout leg. */
  sublabel?: string;
  testID: string;
  onPress: () => void;
  variant?: GameButtonVariant;
  small?: boolean;
  disabled?: boolean;
  /** Marks the control as the active/selected choice (e.g. a chosen difficulty). */
  selected?: boolean;
  /** Optional screen-reader hint describing the action's result. */
  hint?: string;
  /** Host view ref for focus management (React 19 ref-as-prop). */
  ref?: Ref<View>;
  style?: StyleProp<ViewStyle>;
}

/**
 * `selected` promotes a secondary control to the primary treatment so the
 * chosen option is unambiguous, and disables the redundant press feedback
 * (re-selecting the active choice should not feel like an action).
 */
function resolveVariant(variant: GameButtonVariant, selected: boolean): ButtonVariant {
  if (selected) return 'primary';
  return variant;
}

export const GameButton = memo(function GameButton({
  label,
  sublabel,
  testID,
  onPress,
  variant = 'primary',
  small = false,
  disabled = false,
  selected = false,
  hint,
  ref,
  style,
}: GameButtonProps) {
  return (
    <Button
      ref={ref}
      label={label}
      sublabel={sublabel}
      testID={testID}
      onPress={onPress}
      variant={resolveVariant(variant, selected)}
      size={small ? 'sm' : 'md'}
      disabled={disabled}
      fullWidth={false}
      accessibilityHint={hint}
      accessibilityState={{ disabled, selected }}
      style={[styles.button, style]}
    />
  );
});

const styles: { button: ViewStyle } = {
  button: {
    // Game controls keep their own minimum so a "Pause"/"Quit" pair never
    // collapses to icon width next to a board.
    minWidth: 120,
    paddingHorizontal: Spacing.four,
  },
};
