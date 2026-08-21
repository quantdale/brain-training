/**
 * Local default entitlement provider (campaign 010, W19; constitution §23).
 *
 * The shipped state of the product: EVERYTHING free/unlocked, unmetered,
 * decided locally with no external authority. This is a seam placeholder, not
 * a monetization decision — pricing, tiers and usage limits remain deferred
 * (docs/DEFERRED_DECISIONS.md). A future provider replaces this object at
 * the (not yet existing) bootstrap injection point; call sites keep calling
 * the same {@link EntitlementProvider} interface.
 */

import type {
  EntitlementFeatureKey,
  EntitlementProvider,
  FeatureEntitlement,
} from './types';

/** Every known feature key in canonical (declaration) order. */
export const ALL_FEATURE_KEYS: readonly EntitlementFeatureKey[] = [
  'training',
  'cosmetics',
  'data-portability',
  'ai-assistant',
];

/**
 * The local default answer for one feature: granted, unmetered,
 * `local-default` provenance.
 */
export function localDefaultEntitlement(
  feature: EntitlementFeatureKey,
): FeatureEntitlement {
  return { feature, granted: true, source: 'local-default', remainingUses: null };
}

/**
 * Create the built-in provider. Deterministic and stateless: every known
 * feature resolves to {@link localDefaultEntitlement}, unknown input keys are
 * still answered (defensively) rather than thrown on, so a stale caller
 * cannot crash against a newer/older key set.
 */
export function createLocalDefaultEntitlementProvider(): EntitlementProvider {
  return {
    id: 'local-default',
    resolve: localDefaultEntitlement,
    resolveAll(features) {
      const keys = features ?? ALL_FEATURE_KEYS;
      return keys.map((feature) => localDefaultEntitlement(feature));
    },
  };
}
