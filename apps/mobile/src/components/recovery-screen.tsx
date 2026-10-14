/**
 * RecoveryScreen — shared presentational recovery-safe shell (Campaign 053).
 *
 * Extracted from `StorageUnavailable` so a failed foundational bootstrap
 * stage (database, catalog registry, progression) can present the same
 * honest recovery affordances with stage-appropriate copy while the normal
 * ready shell is withheld.
 *
 * Deliberately dependency-free: plain RN primitives + STATIC token values,
 * because the provider/db layers this screen would otherwise depend on are
 * exactly what may have failed. `Colors`, `Depth`, `Radii`, and `Spacing`
 * are compile-time constants; the colour scheme comes from the OS. Font
 * scaling follows the system through 2×; scrolling keeps every recovery
 * control reachable even when diagnostic details are long.
 */
import { Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';

import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { Colors, Radii, Spacing } from '@/theme/tokens';

export interface RecoveryScreenProps {
  /**
   * Test-id prefix for the root container and its controls. `storage` keeps
   * the historical `storage-unavailable*` contract; stage-specific prefixes
   * (e.g. `bootstrap-recovery`) keep the failure identity observable.
   */
  testIDPrefix: string;
  title: string;
  message: string;
  steps: readonly string[];
  /** Diagnostic detail (error message) when available. */
  detail?: string | null;
  /** Retry button label. */
  retryLabel?: string;
  /** Re-attempts the failed initialization stage. */
  onRetry: () => void;
/**
 * Optional accessible name for the retry control; defaults to a generic
 * retry label when omitted.
 */
  retryAccessibilityLabel?: string;
  /** Accessibility hint for the retry control. */
  retryHint?: string;
}

export function RecoveryScreen({
  testIDPrefix,
  title,
  message,
  steps,
  detail,
  retryLabel = 'Retry',
  retryAccessibilityLabel,
  onRetry,
  retryHint = 'Re-attempts the initialization that failed',
}: RecoveryScreenProps) {
  // OS scheme only: the stored theme preference may live behind the layer
  // that just failed, so follow the system and read static token values.
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = Colors[scheme];
  const styles = makeStyles(theme);
  return (
    // Live region: this screen can appear (or transition to recovered) while a
    // screen reader user is waiting, so surface the state change audibly.
    <ScrollView
      testID={testIDPrefix}
      style={styles.container}
      contentContainerStyle={styles.content}
      accessibilityLiveRegion="polite">
      <View style={styles.panel}>
      <Text
        testID={`${testIDPrefix}-title`}
        style={styles.title}
        maxFontSizeMultiplier={2}>
        {title}
      </Text>
      <Text
        testID={`${testIDPrefix}-message`}
        style={styles.message}
        maxFontSizeMultiplier={2}>
        {message}
      </Text>
      <View style={styles.steps}>
        {steps.map((step) => (
          <Text key={step} style={styles.step} maxFontSizeMultiplier={2}>
            • {step}
          </Text>
        ))}
      </View>
      {detail ? (
        // Selectable: lets a user copy the diagnostic text for a bug report
        // without any share/logging infrastructure on this degraded surface.
        <Text
          testID={`${testIDPrefix}-detail`}
          style={styles.detail}
          selectable
          maxFontSizeMultiplier={2}>
          {detail}
        </Text>
      ) : null}
      <Pressable
        testID={`${testIDPrefix}-retry`}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={retryAccessibilityLabel ?? 'Retry initialization'}
        accessibilityHint={retryHint}
        // 058: plain primitives only — Tappable/Button depend on providers
        // that may have failed on this degraded surface. The 44dp floor is
        // enforced by style plus hit slop instead of the shared contract.
        hitSlop={12}
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
        <Text style={styles.retryText} maxFontSizeMultiplier={2}>
          {retryLabel}
        </Text>
      </Pressable>
      </View>
    </ScrollView>
  );
}

/** Static-token stylesheet: `theme` is a compile-time palette object, so this
 * stays callable on the degraded path (no hooks, no providers). */
function makeStyles(theme: (typeof Colors)[keyof typeof Colors]) {
  return {
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.six,
    },
    panel: { width: '100%' as const, maxWidth: 440, alignItems: 'stretch' as const },
    title: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: Spacing.two,
    },
    message: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.textSecondary,
      marginBottom: Spacing.three,
    },
    steps: {
      marginBottom: Spacing.three,
      gap: Spacing.one,
    },
    step: {
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '500' as const,
      color: theme.textSecondary,
    },
    detail: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.dangerText,
      marginBottom: Spacing.four,
    },
    retry: {
      // Explicit floor: padding arithmetic alone does not guarantee it.
      minHeight: Math.max(48, MIN_TOUCH_TARGET),
      justifyContent: 'center' as const,
      paddingVertical: Spacing.twoHalf,
      paddingHorizontal: Spacing.five,
      borderRadius: Radii.pill,
      backgroundColor: theme.accent,
    },
    retryPressed: { opacity: 0.7 },
    retryText: { fontSize: 16, lineHeight: 24, textAlign: 'center' as const, fontWeight: '600' as const, color: theme.accentOn },
  };
}
