/**
 * Recoverable storage-unavailable screen (006R task 8.4, W13 UX wave;
 * polished in campaign 012 W12).
 *
 * Shown when the canonical local database fails to initialize at startup.
 * Per the Database Integrity spec, a storage-init failure MUST surface a
 * recoverable state with retry/diagnostic options rather than silently
 * rendering the normal app (which would later fail only on first save).
 *
 * Deliberately self-contained: plain RN primitives + STATIC token values,
 * because the provider/db layers this screen would otherwise depend on are
 * exactly what may have failed to initialize. `Colors` and the layout tokens
 * are compile-time constants (no provider, no database), and the colour
 * scheme comes from the OS (no settings read), so this screen wears the
 * shipped identity in both themes while staying renderable on the degraded
 * path. Font scaling is still capped at ~1.35 to match the rest of the app
 * so large system fonts cannot push recovery controls out of reach.
 */
import { Pressable, Text, useColorScheme, View } from 'react-native';

import { Colors, Depth, Radii, Spacing } from '@/theme/tokens';

export interface StorageUnavailableProps {
  /** The initialization error, surfaced as a diagnostic detail. */
  error: Error | null;
  /** Re-attempts database initialization. */
  onRetry: () => void;
}

const STEPS = [
  'Tap Retry below — transient open failures often clear immediately.',
  'If retry keeps failing, close and reopen the app.',
  'Your data is stored safely on device; nothing is deleted by this error.',
];

export default function StorageUnavailable({ error, onRetry }: StorageUnavailableProps) {
  // OS scheme only: the stored theme preference may live behind the database
  // that just failed, so follow the system and read static token values.
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = Colors[scheme];
  const styles = makeStyles(theme);
  return (
    // Live region: this screen can appear (or transition to recovered) while a
    // screen reader user is waiting, so surface the state change audibly.
    <View testID="storage-unavailable" style={styles.container} accessibilityLiveRegion="polite">
      <Text
        testID="storage-unavailable-title"
        style={styles.title}
        maxFontSizeMultiplier={1.35}
      >
        Storage Unavailable
      </Text>
      <Text
        testID="storage-unavailable-message"
        style={styles.message}
        maxFontSizeMultiplier={1.35}
      >
        Your local data store could not be opened. Until this is resolved, progress cannot be
        saved. Your data is not lost — retry to reconnect to the local store.
      </Text>
      <View style={styles.steps}>
        {STEPS.map((step) => (
          <Text key={step} style={styles.step} maxFontSizeMultiplier={1.35}>
            • {step}
          </Text>
        ))}
      </View>
      {error ? (
        // Selectable: lets a user copy the diagnostic text for a bug report
        // without any share/logging infrastructure on this degraded surface.
        <Text
          testID="storage-unavailable-detail"
          style={styles.detail}
          selectable
          maxFontSizeMultiplier={1.35}
        >
          {error.message}
        </Text>
      ) : null}
      <Pressable
        testID="storage-unavailable-retry"
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry opening the local data store"
        accessibilityHint="Re-attempts the storage initialization that failed"
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
      >
        <Text style={styles.retryText} maxFontSizeMultiplier={1.35}>
          Retry
        </Text>
      </Pressable>
    </View>
  );
}

/** Static-token stylesheet: `theme` is a compile-time palette object, so this
 * stays callable on the degraded path (no hooks, no providers). */
function makeStyles(theme: (typeof Colors)[keyof typeof Colors]) {
  return {
    container: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: Spacing.four,
      backgroundColor: theme.background,
    },
    title: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '700' as const,
      color: theme.text,
      marginBottom: Spacing.two,
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.textSecondary,
      textAlign: 'center' as const,
      marginBottom: Spacing.three,
      maxWidth: 320,
    },
    steps: {
      marginBottom: Spacing.three,
      maxWidth: 320,
      gap: Spacing.one,
    },
    step: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '500' as const,
      color: theme.textMuted,
    },
    detail: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.dangerText,
      textAlign: 'center' as const,
      marginBottom: Spacing.four,
      maxWidth: 320,
    },
    retry: {
      paddingVertical: Spacing.twoHalf,
      paddingHorizontal: Spacing.five,
      borderRadius: Radii.large,
      backgroundColor: theme.accent,
      borderBottomWidth: 4,
      borderBottomColor: Depth.lip,
    },
    retryPressed: { opacity: 0.7 },
    retryText: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, color: theme.accentOn },
  };
}
