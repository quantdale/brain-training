/**
 * Recoverable storage-unavailable screen (006R task 8.4, W13 UX wave;
 * polished in campaign 012 W12).
 *
 * Shown when the canonical local database fails to initialize at startup.
 * Per the Database Integrity spec, a storage-init failure MUST surface a
 * recoverable state with retry/diagnostic options rather than silently
 * rendering the normal app (which would later fail only on first save).
 *
 * Deliberately self-contained: plain RN primitives + fixed colors, because the
 * theme/db layers this screen would otherwise depend on are exactly what may
 * have failed to initialize. Font scaling is still capped at ~1.35 to match
 * the rest of the app so large system fonts cannot push recovery controls
 * out of reach.
 */
import { Pressable, Text, View } from 'react-native';

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

const styles = {
  container: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
    backgroundColor: '#0b0d12',
  },
  title: { fontSize: 22, fontWeight: '700' as const, color: '#ffffff', marginBottom: 12 },
  message: {
    fontSize: 15,
    color: '#c7ccd6',
    textAlign: 'center' as const,
    marginBottom: 16,
    maxWidth: 320,
  },
  steps: {
    marginBottom: 16,
    maxWidth: 320,
    gap: 6,
  },
  step: {
    fontSize: 13,
    color: '#9aa1b5',
    lineHeight: 18,
  },
  detail: {
    fontSize: 13,
    color: '#ff8a80',
    textAlign: 'center' as const,
    marginBottom: 20,
    maxWidth: 320,
  },
  retry: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
  },
  retryPressed: { opacity: 0.7 },
  retryText: { fontSize: 16, fontWeight: '600' as const, color: '#ffffff' },
};
