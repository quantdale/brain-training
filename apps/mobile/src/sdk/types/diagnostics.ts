/**
 * Structured diagnostic metadata (constitution §21: historical results
 * preserve scoring/generator/version metadata; §29 QA diagnostics).
 *
 * Games build one `DiagnosticMetadata` per completed session and persist it
 * with the result so any session can be replayed/audited exactly.
 */
import { SDK_VERSION } from '../version';
import type { DifficultyLevel } from './difficulty';

/** Arbitrary generator details (algorithm params, content pack ids, ...). */
export interface GeneratorInfo {
  readonly [key: string]: string | number | boolean;
}

export interface DiagnosticMetadata {
  readonly gameId: string;
  /** SDK contract version (see `SDK_VERSION`). */
  readonly sdkVersion: string;
  /** Game mechanics/content version at the time of play. */
  readonly gameVersion: string;
  /** Generator version, or null for non-procedural games. */
  readonly generatorVersion: string | null;
  /** Canonical seed (see `rng.ts`), or null when not seeded. */
  readonly seed: string | null;
  readonly difficulty: DifficultyLevel;
  /** Wall-clock session start (ms epoch). */
  readonly startedAtMs: number;
  /** Active (non-paused) duration in ms — the authoritative play time. */
  readonly activeDurationMs: number;
  /** Paused duration in ms. */
  readonly pausedDurationMs: number;
  /** Optional generator details for full reproducibility. */
  readonly generatorInfo?: GeneratorInfo;
}

/**
 * Build diagnostic metadata; `sdkVersion` defaults to the current
 * `SDK_VERSION` and can be overridden (e.g. when replaying old formats).
 */
export function createDiagnosticMetadata(
  input: Omit<DiagnosticMetadata, 'sdkVersion'> & { sdkVersion?: string },
): DiagnosticMetadata {
  return { sdkVersion: SDK_VERSION, ...input };
}
