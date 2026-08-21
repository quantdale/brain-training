/**
 * Public surface of the entitlement seam (campaign 010, W19).
 *
 * Pure, dependency-free "may this caller use feature X" abstraction with a
 * pluggable provider interface and the shipped all-unlocked local default.
 * Nothing here performs I/O or network calls; nothing is wired into screens
 * yet (consumers come later — see types.ts for the plug-in point).
 */

export type {
  EntitlementFeatureKey,
  EntitlementProvider,
  EntitlementSource,
  FeatureEntitlement,
} from './types';
export { ENTITLEMENTS_SEAM_VERSION } from './types';
export {
  ALL_FEATURE_KEYS,
  createLocalDefaultEntitlementProvider,
  localDefaultEntitlement,
} from './local-provider';
export { isUsable, resolveEntitlement, resolveEntitlements } from './resolve';
