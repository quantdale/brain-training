/**
 * Entitlement seam types (campaign 010, W19; constitution §23).
 *
 * A deliberately lightweight abstraction for "may the caller use feature X"
 * that exists early so a REAL PROVIDER CAN PLUG IN LATER without touching
 * call sites. This module implements no product decision: no billing
 * provider, no pricing, no tiers, no free-tier usage limits — all of those
 * are registered deferred decisions (docs/DEFERRED_DECISIONS.md). Today
 * everything is free/unlocked, expressed by the local default provider in
 * `local-provider.ts`.
 *
 * PLUG-IN POINT for a future provider: implement {@link EntitlementProvider}
 * over the billing/licensing SDK's latest known state and inject it at app
 * bootstrap wherever screens resolve features (nothing is wired yet by
 * design). The interface is synchronous ON PURPOSE: providers are expected to
 * refresh their state out of band and answer from a snapshot, so UI code
 * never awaits a store round-trip mid-render. While loading or offline, a
 * provider answers from its last snapshot or falls back to
 * `{ granted: false, source: 'unknown' }` — never by throwing.
 */

/**
 * Version of this seam's contract surface (types + resolve semantics). Bump
 * when the meaning of an entitlement changes so historical diagnostics stay
 * interpretable.
 */
export const ENTITLEMENTS_SEAM_VERSION = '1.0.0';

/**
 * Stable keys for the feature areas the product may someday gate. This union
 * is the UI/diagnostics contract — screens key off these values, never off
 * prose. New areas are ADDITIVE: append a key, extend the local default
 * provider, done.
 *
 * - `training`: normal gameplay, workouts, progression. Constitution §23:
 *   basic training must never require payment or AI credits, so the local
 *   default grants it unconditionally and future providers are expected to
 *   keep it that way.
 * - `cosmetics`: themes/avatars/effects surfaces.
 * - `data-portability`: backup/export/import/deletion (§7) — user data
 *   ownership stays free.
 * - `ai-assistant`: future advisory assistant (§22). May become metered via
 *   {@link FeatureEntitlement.remainingUses} (AI credits) later; economics
 *   are deferred.
 */
export type EntitlementFeatureKey =
  | 'training'
  | 'cosmetics'
  | 'data-portability'
  | 'ai-assistant';

/** Where an entitlement decision came from (diagnostics + UI provenance). */
export type EntitlementSource =
  /** Built-in offline default: everything unlocked, as shipped today. */
  | 'local-default'
  /** Granted by a one-time purchase (future; provider-defined). */
  | 'purchase'
  /** Granted by an active subscription (future; provider-defined). */
  | 'subscription'
  /** Granted via promo/redeem/override (future; provider-defined). */
  | 'promo'
  /** Provider could not determine state (loading/offline/error). */
  | 'unknown';

/** The resolved answer for one feature at one moment. */
export interface FeatureEntitlement {
  /** The feature this answer applies to. */
  readonly feature: EntitlementFeatureKey;
  /** Whether the feature is currently usable at all. */
  readonly granted: boolean;
  /** Which authority produced this answer. */
  readonly source: EntitlementSource;
  /**
   * Remaining metered uses, for future credit-style features. `null` means
   * unmetered (plain grant/deny). Metering must never apply to `training`
   * (constitution §23).
   */
  readonly remainingUses: number | null;
}

/**
 * The pluggable authority for entitlement answers. Pure seam: implement this
 * to introduce a real provider (see module header); the local default
 * implementation lives in `local-provider.ts`.
 */
export interface EntitlementProvider {
  /**
   * Stable provider identity for diagnostics ('local-default' for the
   * built-in one).
   */
  readonly id: string;
  /** Resolve a single feature. Must not throw, must not block. */
  resolve(feature: EntitlementFeatureKey): FeatureEntitlement;
  /**
   * Resolve several features at once. Without arguments resolves ALL known
   * keys. Order follows the input (or {@link ALL_FEATURE_KEYS} order) so
   * output is deterministic.
   */
  resolveAll(
    features?: readonly EntitlementFeatureKey[],
  ): readonly FeatureEntitlement[];
}
