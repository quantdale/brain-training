/**
 * TriggerButton — the large tap target of the Reaction Time game.
 *
 * While waiting (`active=false`) it reads as a neutral surface; the moment the
 * GO signal is displayed (`active=true`) it fills with the accent color and
 * flips its label. The visual change is the signal the player reacts to, so
 * the screen captures the monotonic clock reading at the exact render where
 * `active` turns true (see screen.tsx `goAtMs`).
 */
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TriggerButtonProps {
  /** True when the GO signal is displayed (accent fill + "GO!" label). */
  active: boolean;
  disabled?: boolean;
  /** Stable tap handler (memoized button skips re-renders). */
  onPress: () => void;
  /** Semantic testID of the trigger surface. */
  testID: string;
}

export const TriggerButton = memo(function TriggerButton({
  active,
  disabled = false,
  onPress,
  testID,
}: TriggerButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={active ? 'GO — tap now' : 'Tap when the signal appears'}
      accessibilityState={{ disabled, busy: false }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.trigger,
        {
          backgroundColor: active ? theme.accent : theme.surface,
          borderColor: active ? theme.accent : theme.border,
        },
        (pressed || disabled) && styles.dim,
      ]}>
      <ThemedText
        type="title"
        style={{ color: active ? '#FFFFFF' : theme.textSecondary }}>
        {active ? 'GO!' : 'Tap when it turns green'}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'stretch',
    minHeight: 220,
    borderRadius: Radii.large,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dim: {
    opacity: 0.75,
  },
});
