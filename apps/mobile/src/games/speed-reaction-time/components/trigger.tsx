/**
 * TriggerButton — the large tap target of the Reaction Time game.
 *
 * While waiting (`active=false`) it reads as a neutral surface; the moment the
 * GO signal is displayed (`active=true`) it fills with the accent color and
 * flips its label. On NO-GO rounds (`hold=true`, only ever with `active=true`)
 * it instead fills with the danger color and shows the ✕ DON'T TAP marker, so
 * the stimulus class is unmistakable at a glance (color is backed by text and
 * an accessibility label — never color alone). The visual change is the
 * signal the player reacts to, so the screen captures the monotonic clock
 * reading at the exact render where `active` turns true (see screen.tsx
 * `goAtMs`).
 */
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TriggerButtonProps {
  /** True when the GO signal is displayed (accent/danger fill + label). */
  active: boolean;
  /** True on NO-GO trials: danger fill + ✕ marker; the player must withhold. */
  hold?: boolean;
  disabled?: boolean;
  /** Stable tap handler (memoized button skips re-renders). */
  onPress: () => void;
  /** Semantic testID of the trigger surface. */
  testID: string;
}

export const TriggerButton = memo(function TriggerButton({
  active,
  hold = false,
  disabled = false,
  onPress,
  testID,
}: TriggerButtonProps) {
  const theme = useTheme();
  // Stimulus class drives the whole visual: neutral wait → green GO → red HOLD.
  const isGo = active && !hold;
  const isHold = active && hold;
  const fillColor = isGo ? theme.accent : isHold ? theme.danger : theme.surface;
  const borderColor = isGo ? theme.accent : isHold ? theme.danger : theme.border;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        isGo ? 'GO — tap now' : isHold ? 'NO-GO — do not tap' : 'Tap when the signal appears'
      }
      accessibilityState={{ disabled, busy: false }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.trigger,
        {
          backgroundColor: fillColor,
          borderColor,
        },
        (pressed || disabled) && styles.dim,
      ]}>
      {isHold ? (
        <ThemedText type="title" style={styles.marker}>
          ✕
        </ThemedText>
      ) : null}
      <ThemedText
        type="title"
        style={{ color: isGo || isHold ? '#FFFFFF' : theme.textSecondary }}>
        {isGo ? 'GO!' : isHold ? "DON'T TAP" : 'Tap when it turns green'}
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
    gap: Spacing.two,
  },
  marker: {
    color: '#FFFFFF',
    fontSize: 44,
    lineHeight: 52,
  },
  dim: {
    opacity: 0.6,
  },
});
