/**
 * Bootstrap recovery screen (Campaign 053, H-01).
 *
 * Shown when a FOUNDATIONAL bootstrap stage other than database
 * initialization fails — catalog registration or canonical progression
 * initialization — so the app never presents a normal ready shell whose
 * catalog or progression is missing. The storage stage keeps its dedicated
 * `StorageUnavailable` screen and `storage-unavailable*` testIDs.
 *
 * Copy is stage-specific so the recovery state names what is unavailable
 * without leaking implementation detail; the error message stays available
 * as selectable diagnostic detail.
 */
import { RecoveryScreen } from '@/components/recovery-screen';
import type { FoundationalBootstrapStage } from '@/bootstrap/run-bootstrap';

export interface BootstrapRecoveryProps {
  /** The foundational non-storage stage that failed. */
  stage: Exclude<FoundationalBootstrapStage, 'database'>;
  /** The stage error, surfaced as a diagnostic detail. */
  error: Error | null;
  /** Re-attempts the full classified bootstrap pipeline. */
  onRetry: () => void;
}

const STEPS = [
  'Tap Retry below — transient initialization failures often clear immediately.',
  'If retry keeps failing, close and reopen the app.',
  'Your saved data is stored safely on device; nothing is deleted by this error.',
];

const STAGE_COPY: Record<BootstrapRecoveryProps['stage'], { title: string; message: string }> = {
  'catalog-registry': {
    title: 'Games Unavailable',
    message:
      'The game catalog could not be initialized, so training games cannot be started safely. Retry to finish setting up the catalog.',
  },
  progression: {
    title: 'Progress Unavailable',
    message:
      'Your training progress could not be initialized, so sessions cannot be recorded safely. Retry to reconnect to your progression data.',
  },
};

export default function BootstrapRecovery({
  stage,
  error,
  onRetry,
}: BootstrapRecoveryProps) {
  const copy = STAGE_COPY[stage];
  return (
    <RecoveryScreen
      testIDPrefix="bootstrap-recovery"
      title={copy.title}
      message={copy.message}
      steps={STEPS}
      detail={error ? error.message : null}
      retryLabel="Retry"
      retryAccessibilityLabel="Retry app initialization"
      retryHint="Re-attempts the initialization stage that failed"
      onRetry={onRetry}
    />
  );
}
