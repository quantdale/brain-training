/**
 * Content-pack versioning + storage seam — shared types (constitution §24).
 *
 * The seam describes bundled (and, later, downloaded) content packs: versioned,
 * curated payloads shipped by game modules (e.g. the language game's
 * `content/pack.json`). Types here are intentionally small so the seam can
 * grow into real storage management (downloaded packs, cache removal) without
 * API churn.
 */

/** Identity + metadata of one content pack known to the app. */
export interface PackInfo {
  /** Stable, kebab-case pack id (never renamed once shipped). */
  readonly packId: string;
  /** Semantic version of the pack payload, e.g. "1.0.0". */
  readonly packVersion: string;
  /** Number of playable items in the pack (matches the pack's own itemCount). */
  readonly itemCount: number;
  /**
   * Deterministic byte-size estimate of the pack payload. Computed by the
   * documented heuristic in `registry.ts`; stable across runs and platforms.
   */
  readonly sizeEstimateBytes: number;
  /** Game module that ships this pack (its stable game id). */
  readonly sourceGameId: string;
  /** Provenance of the pack; today always 'bundled', later 'downloaded'. */
  readonly source: 'bundled';
}

/** Aggregate storage view, for Settings/storage-management UI (constitution §24). */
export interface StorageSummary {
  /** All packs currently known to the app, in registry order. */
  readonly packs: readonly PackInfo[];
  /** Sum of `itemCount` over all packs. */
  readonly totalItems: number;
  /** Sum of `sizeEstimateBytes` over all packs. */
  readonly totalSizeEstimateBytes: number;
}
