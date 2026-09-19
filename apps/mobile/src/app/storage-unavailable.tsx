/**
 * Recoverable storage-unavailable screen (006R task 8.4, W13 UX wave;
 * polished in campaign 012 W12).
 *
 * Shown when the canonical local database fails to initialize at startup.
 * Per the Database Integrity spec, a storage-init failure MUST surface a
 * recoverable state with retry/diagnostic options rather than silently
 * rendering the normal app (which would later fail only on first save).
 *
 * Campaign 053 moved the presentational shell into the shared
 * `RecoveryScreen` so foundational catalog/progression failures can present
 * the same recovery-safe treatment; this module keeps the storage-specific
 * copy and the historical `storage-unavailable*` testID contract.
 */
import { RecoveryScreen } from '@/components/recovery-screen';

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
    <RecoveryScreen
      testIDPrefix="storage-unavailable"
      title="Storage Unavailable"
      message="Your local data store could not be opened. Until this is resolved, progress cannot be saved. Your data is not lost — retry to reconnect to the local store."
      steps={STEPS}
      detail={error ? error.message : null}
      retryLabel="Retry"
      retryAccessibilityLabel="Retry opening the local data store"
      retryHint="Re-attempts the storage initialization that failed"
      onRetry={onRetry}
    />
  );
}
