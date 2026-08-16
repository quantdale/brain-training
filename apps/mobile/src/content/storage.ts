/**
 * Content-pack storage-management scaffold (constitution §24).
 *
 * There is no on-disk persistence yet: every known pack is bundled with the
 * app, so this seam is a deliberate no-op that keeps the shape of a real
 * storage layer. When the orchestrator adds downloaded packs, this module is
 * where install/uninstall and cache-removal behavior land — the signatures
 * below are the stable contract, so callers (Settings/storage UI) do not need
 * to change. No filesystem IO happens here today, and none may be introduced
 * outside a real persistence decision.
 */
import { getBundledPacks, getPack } from './registry';
import type { PackInfo } from './types';

/** Result of a cache-clear attempt: whether it happened, and why not. */
export interface ClearPackResult {
  readonly cleared: boolean;
  /** Human/UI-readable reason when `cleared` is false. */
  readonly reason?: string;
}

/** Packs currently available to the app: bundled packs only, for now. */
export async function listInstalledPacks(): Promise<PackInfo[]> {
  return getBundledPacks();
}

/**
 * Clear a pack's cached payload. Bundled packs ship with the app binary and
 * are never clearable, so this always reports the documented no-op result —
 * the seam exists so cache removal (constitution §24) has a home once
 * downloaded packs exist.
 */
export async function clearPackCache(packId: string): Promise<ClearPackResult> {
  void packId; // Kept for API stability; no persistence layer to act on yet.
  return { cleared: false, reason: 'not-implemented' };
}

/** Estimated payload size of a pack, or `null` when the pack is unknown. */
export async function estimatedPackSizeBytes(packId: string): Promise<number | null> {
  return getPack(packId)?.sizeEstimateBytes ?? null;
}
