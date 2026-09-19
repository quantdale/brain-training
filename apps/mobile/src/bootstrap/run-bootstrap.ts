/**
 * Startup bootstrap orchestration (Campaign 053, H-01).
 *
 * The pre-053 root layout ran database initialization in one try block and
 * every later step (registry registration, progression seeding, preference
 * reads) in a single catch-all that logged and then marked the shell ready.
 * A failed registry or progression stage could therefore present a normal
 * ready shell whose catalog or canonical progression was not initialized.
 *
 * This module models startup as classified stages:
 *
 * - FOUNDATIONAL — `database`, `catalog-registry`, `progression`. A failure
 *   yields `recovery-required`: the shell must not invite normal play or
 *   progression-sensitive actions until the stage succeeds.
 * - ANCILLARY — `preferences`. A failure is nonfatal; the shell still becomes
 *   ready using safe defaults and records a stage-specific diagnostic.
 *
 * Durable side effects + idempotency guarantees (task 1.1):
 *
 * | Stage            | Durable side effects                                   | Retry/relaunch safety |
 * | ---------------- | ------------------------------------------------------ | --------------------- |
 * | database         | opens/migrates the SQLite file; ensures the singleton profile row | `initDatabase()` coalesces concurrent callers and re-opens the same file; `profile.ensureExists()` is create-once |
 * | catalog-registry | replaces the in-memory registered catalog (no durable write) | `registerGameDefinitions()` replaces the array module state; a cold relaunch starts from the generated registry |
 * | progression      | fingerprint-gated quest/achievement definition upserts + progress sync (idempotent) | the seed fingerprint skips upserts when already applied; sync is a pure read-and-recompute |
 * | preferences      | none (read-only profile settings)                      | safe to repeat; a failure falls back to provider defaults |
 *
 * Retry (the recovery screen's Retry action) re-runs the full pipeline from
 * the first stage; every stage above is safe to repeat, and a cold relaunch
 * simply constructs fresh module state and runs the same pipeline.
 *
 * This module is deliberately dependency-injected so every stage can be
 * fault-injected in tests without mocking native storage.
 */

/** Startup stages, in execution order. */
export type BootstrapStage =
  | 'database'
  | 'catalog-registry'
  | 'progression'
  | 'preferences';

/** Whether a stage failure blocks the ready shell or is only cosmetic. */
export type BootstrapStageClass = 'foundational' | 'ancillary';

/**
 * Foundational stages in execution order. Only these can produce a
 * `recovery-required` outcome; `preferences` is ancillary by construction.
 */
export type FoundationalBootstrapStage =
  | 'database'
  | 'catalog-registry'
  | 'progression';

/** Stage classification, single source of truth for outcome semantics. */
export const BOOTSTRAP_STAGE_CLASS: Readonly<
  Record<BootstrapStage, BootstrapStageClass>
> = {
  database: 'foundational',
  'catalog-registry': 'foundational',
  progression: 'foundational',
  preferences: 'ancillary',
};

/** Foundational stages in execution order (fail-fast pipeline). */
export const FOUNDATIONAL_BOOTSTRAP_STAGES: readonly FoundationalBootstrapStage[] = [
  'database',
  'catalog-registry',
  'progression',
];

/** Preference values bootstrap can safely hand to the settings provider. */
export interface BootstrapPreferences {
  readonly themeId?: string;
  readonly sfx?: boolean;
  readonly haptics?: boolean;
}

/** One classified stage failure, safe to log or surface as diagnostics. */
export interface BootstrapDiagnostic {
  readonly stage: BootstrapStage;
  readonly classification: BootstrapStageClass;
  readonly message: string;
}

/** Bootstrap completed; the normal shell may render. */
export interface BootstrapReady {
  readonly status: 'ready';
  readonly preferences: BootstrapPreferences;
  /** Ancillary failures recorded while the shell still became ready. */
  readonly diagnostics: readonly BootstrapDiagnostic[];
}

/** A foundational stage failed; only the recovery-safe shell may render. */
export interface BootstrapRecoveryRequired {
  readonly status: 'recovery-required';
  readonly failedStage: FoundationalBootstrapStage;
  readonly error: Error;
  readonly diagnostics: readonly BootstrapDiagnostic[];
}

export type BootstrapOutcome = BootstrapReady | BootstrapRecoveryRequired;

/** Injectable stage implementations (production wiring lives in `_layout`). */
export interface BootstrapDependencies {
  /** Open/migrate the canonical database (idempotent, coalesced). */
  initializeDatabase(): Promise<void>;
  /** Register the generated game catalog (replaces module state; no durable write). */
  registerCatalog(): void;
  /** Seed versioned progression definitions and sync progress (idempotent). */
  initializeProgression(now: Date): Promise<void>;
  /** Read ancillary preference values; may reject without blocking the shell. */
  readPreferences(): Promise<BootstrapPreferences>;
  /** Clock seam for stage arguments; defaults to the system clock. */
  now?(): Date;
}

/** Normalize an unknown thrown value into an Error with a usable message. */
export function toBootstrapError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function diagnosticFor(
  stage: BootstrapStage,
  error: unknown,
): BootstrapDiagnostic {
  return {
    stage,
    classification: BOOTSTRAP_STAGE_CLASS[stage],
    message: toBootstrapError(error).message,
  };
}

/**
 * Run the classified startup pipeline.
 *
 * Foundational stages run in order and fail fast: the first failure returns
 * `recovery-required` naming the stage, and later stages are not attempted
 * (they may depend on the failed one). Ancillary stages run only after every
 * foundational stage succeeds; their failure is recorded and degraded to safe
 * defaults. The function never throws for stage failures.
 */
export async function runBootstrap(
  deps: BootstrapDependencies,
): Promise<BootstrapOutcome> {
  const diagnostics: BootstrapDiagnostic[] = [];
  const now = deps.now?.() ?? new Date();

  for (const stage of FOUNDATIONAL_BOOTSTRAP_STAGES) {
    try {
      if (stage === 'database') {
        await deps.initializeDatabase();
      } else if (stage === 'catalog-registry') {
        deps.registerCatalog();
      } else {
        await deps.initializeProgression(now);
      }
    } catch (error) {
      const diagnostic = diagnosticFor(stage, error);
      diagnostics.push(diagnostic);
      return {
        status: 'recovery-required',
        failedStage: stage,
        error: toBootstrapError(error),
        diagnostics,
      };
    }
  }

  let preferences: BootstrapPreferences = {};
  try {
    preferences = await deps.readPreferences();
  } catch (error) {
    // Ancillary isolation: a cosmetic preference read must never block the
    // shell; record the stage-specific diagnostic and use safe defaults.
    diagnostics.push(diagnosticFor('preferences', error));
  }

  return { status: 'ready', preferences, diagnostics };
}
