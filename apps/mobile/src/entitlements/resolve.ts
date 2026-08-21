/**
 * Entitlement resolve API (campaign 010, W19).
 *
 * The functions UI code will call once a consumer exists. They add nothing
 * beyond the provider interface except the shared usability rule, so screens
 * never re-implement "granted AND not exhausted" per call site.
 */

import type {
  EntitlementFeatureKey,
  EntitlementProvider,
  FeatureEntitlement,
} from './types';
import { ALL_FEATURE_KEYS } from './local-provider';

/** Resolve one feature through the active provider. */
export function resolveEntitlement(
  provider: EntitlementProvider,
  feature: EntitlementFeatureKey,
): FeatureEntitlement {
  return provider.resolve(feature);
}

/**
 * Resolve several features (all known keys when omitted). Deterministic:
 * output order follows the input order.
 */
export function resolveEntitlements(
  provider: EntitlementProvider,
  features: readonly EntitlementFeatureKey[] = ALL_FEATURE_KEYS,
): readonly FeatureEntitlement[] {
  return provider.resolveAll(features);
}

/**
 * Shared usability rule: granted AND not exhausted. `remainingUses === null`
 * means unmetered; zero/negative remaining uses denies even a granted
 * entitlement.
 */
export function isUsable(entitlement: FeatureEntitlement): boolean {
  if (!entitlement.granted) {
    return false;
  }
  return entitlement.remainingUses === null || entitlement.remainingUses > 0;
}
